# PDF テキスト分析機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF アップロード後に「PDF分析」ステップを追加し、pdfjs-dist の `getTextContent()` でページごとの文字数を表示してから PPTX 変換に進めるようにする。

**Architecture:** `src/lib/analyzer.ts` を新規作成してテキスト抽出ロジックを担当させ、`App.tsx` に分析ステップの state と UI を追加する。converter.ts は変更しない。

**Tech Stack:** React 19, TypeScript, Vite 6, pdfjs-dist 5.6.205（既存のWorker設定を再利用）

---

## ファイル構成

| 操作 | パス | 内容 |
|------|------|------|
| 新規作成 | `src/lib/analyzer.ts` | PDF テキスト抽出・ページごと文字数集計 |
| 変更 | `src/App.tsx` | 分析ステップの state・UI・ハンドラを追加 |
| 変更なし | `src/lib/converter.ts` | 変更しない |
| 変更なし | `vite.config.ts` | 変更しない |

---

## Task 1: analyzer.ts を新規作成する

**Files:**
- Create: `src/lib/analyzer.ts`

- [ ] **Step 1: analyzer.ts を以下の内容で作成する**

```ts
import * as pdfjs from 'pdfjs-dist';

// converter.ts と同じ Worker 設定を使用（既にグローバルに設定済みの場合は上書きされないが明示する）
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** 1ページあたりのテキスト情報 */
export interface PageTextInfo {
  page: number;       // ページ番号（1始まり）
  charCount: number;  // 抽出できた文字数（0 = 画像ページ）
}

/** PDF全体の分析結果 */
export interface PdfAnalysisResult {
  totalPages: number;       // 総ページ数
  pages: PageTextInfo[];    // ページごとの情報
  totalCharCount: number;   // 全ページの文字数合計
}

/**
 * PDF ファイルを分析してページごとのテキスト文字数を返す。
 * NotebookLM の PDF は画像PDFのため totalCharCount が 0 になる。
 */
export async function analyzePdf(file: File): Promise<PdfAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const pages: PageTextInfo[] = [];

  for (let i = 1; i <= totalPages; i++) {
    let charCount = 0;
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // items の各要素の str プロパティを合計してページの文字数を算出
      charCount = textContent.items.reduce((sum, item) => {
        // TextItem には str プロパティがある（TextMarkedContent にはない）
        if ('str' in item) {
          return sum + item.str.length;
        }
        return sum;
      }, 0);
    } catch {
      // 特定ページの取得に失敗した場合は 0 文字として処理継続
      charCount = 0;
    }
    pages.push({ page: i, charCount });
  }

  const totalCharCount = pages.reduce((sum, p) => sum + p.charCount, 0);

  return { totalPages, pages, totalCharCount };
}
```

- [ ] **Step 2: TypeScript コンパイルエラーがないか確認する**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter && npm run lint
```

期待される出力: エラーなし

- [ ] **Step 3: コミットする**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter
git add src/lib/analyzer.ts
git commit -m "feat: PDF テキスト分析モジュール analyzer.ts を追加"
```

---

## Task 2: App.tsx に分析ステップを追加する

**Files:**
- Modify: `src/App.tsx`

### 現在の App.tsx の構造（把握用）

- 5つの state: `file`, `isConverting`, `progress`, `error`, `resultBlob`
- `handleConvert()`: 変換処理
- `handleDownload()`: ダウンロード処理
- `reset()`: 状態リセット
- UI: アップロード → 変換ボタン → ダウンロード の流れ

- [ ] **Step 1: import 文に analyzer.ts を追加する（1行目付近）**

現在の import:
```ts
import { convertPdfToPptx, ConversionProgress } from './lib/converter';
```

変更後:
```ts
import { convertPdfToPptx, ConversionProgress } from './lib/converter';
import { analyzePdf, PdfAnalysisResult } from './lib/analyzer';
```

- [ ] **Step 2: state を2つ追加する（既存 state の直後、22行目付近）**

現在:
```ts
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

変更後:
```ts
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PdfAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: `handleAnalyze()` 関数を追加する（`handleConvert()` の直前）**

```ts
  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzePdf(file);
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      setError('PDF の分析中にエラーが発生しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };
```

- [ ] **Step 4: `reset()` 関数に分析状態のリセットを追加する**

現在:
```ts
  const reset = () => {
    setFile(null);
    setResultBlob(null);
    setError(null);
  };
```

変更後:
```ts
  const reset = () => {
    setFile(null);
    setResultBlob(null);
    setAnalysisResult(null);
    setError(null);
  };
```

- [ ] **Step 5: ファイル選択済み後のUI（変換ボタン部分）を3ステップフローに変更する**

現在の該当箇所（約216〜224行目）:
```tsx
                  ) : (
                    <button
                      onClick={handleConvert}
                      className="w-full h-14 bg-[#ff6b6b] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#ff5252] transition-all active:scale-[0.98]"
                    >
                      Convert to PPTX
                      <ArrowRight size={20} />
                    </button>
                  )}
```

変更後（分析ステップを挟む）:
```tsx
                  ) : !analysisResult ? (
                    <div className="space-y-4">
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full h-14 bg-[#ff6b6b] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#ff5252] transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <><Loader2 className="animate-spin" size={20} />PDFを分析中...</>
                        ) : (
                          <>PDFを分析する<ArrowRight size={20} /></>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 分析結果表示 */}
                      <div className="p-4 bg-[#f5f5f5] rounded-2xl space-y-2">
                        <p className="font-semibold text-sm">
                          テキスト分析結果（合計: {analysisResult.totalCharCount} 文字）
                        </p>
                        {analysisResult.totalCharCount === 0 && (
                          <p className="text-sm text-red-600 font-medium">
                            このPDFはテキストを含みません（画像PDFです）
                          </p>
                        )}
                        <div className="space-y-1">
                          {analysisResult.pages.map((p) => (
                            <div key={p.page} className="flex justify-between text-sm text-[#8e8e8e]">
                              <span>ページ {p.page}</span>
                              <span>{p.charCount} 文字</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* 変換ボタン */}
                      <button
                        onClick={handleConvert}
                        className="w-full h-14 bg-[#ff6b6b] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#ff5252] transition-all active:scale-[0.98]"
                      >
                        PPTXに変換する
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  )}
```

- [ ] **Step 6: TypeScript コンパイルエラーがないか確認する**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter && npm run lint
```

期待される出力: エラーなし

- [ ] **Step 7: コミットする**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter
git add src/App.tsx
git commit -m "feat: App.tsx にPDF分析ステップを追加（アップロード→分析→変換の3ステップフロー）"
```

---

## Task 3: 動作確認

**Files:**
- なし（確認のみ）

- [ ] **Step 1: 開発サーバーを起動する**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter && npm run dev
```

期待される出力:
```
  VITE v6.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

- [ ] **Step 2: ブラウザで http://localhost:3000 を開く**

- UI が表示されることを確認
- コンソール（F12）にエラーが出ていないことを確認

- [ ] **Step 3: サンプルPDFで分析を実行する**

- `sample_pdf/Multi-Agent_AI_Innovation.pdf` をアップロード
- 「PDFを分析する」ボタンをクリック
- 以下を確認する：
  - 6ページ分の行が表示される
  - 全ページ「0 文字」と表示される
  - 「このPDFはテキストを含みません（画像PDFです）」が表示される

- [ ] **Step 4: 変換・ダウンロードまで完了することを確認する**

- 「PPTXに変換する」ボタンをクリック
- 進捗バーが動いて「Conversion complete!」が表示される
- 「Download PowerPoint」でダウンロードできる

- [ ] **Step 5: 最終コミット（必要な場合）**

```bash
cd /mnt/storage/projects/pdf-to-powerpoint-converter
git add -A
git commit -m "feat: PDF テキスト分析機能 完了"
```

---

## トラブルシューティング

### `analyzePdf is not a function` エラー
→ `src/App.tsx` の import 文に `analyzePdf` が追加されているか確認。

### 分析ボタンを押しても何も起きない
→ `handleAnalyze` が `onClick` に正しくバインドされているか確認。`disabled={isAnalyzing}` が常に true になっていないか確認。

### TypeScript エラー: `'str' does not exist on type`
→ `'str' in item` のガード節が正しく機能しているか確認。pdfjs-dist v5 の `TextItem` 型は `str` プロパティを持つ。
