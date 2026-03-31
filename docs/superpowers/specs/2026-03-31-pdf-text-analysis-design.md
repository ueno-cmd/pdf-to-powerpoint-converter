# 設計書：PDF テキスト分析機能の追加

作成日: 2026-03-31

---

## 概要

NotebookLM からダウンロードした PDF が画像PDFであることを視覚的に示すため、
変換前に「PDF分析」ステップを追加する。

pdfjs-dist の `getTextContent()` でページごとのテキスト文字数を取得し、
「0文字 = 画像PDF」であることをユーザーに見せてからPPTX変換に進む。

---

## ゴール

- PDFアップロード後に「PDFを分析する」ボタンを押せる
- ページごとの文字数一覧が表示される
- 合計0文字の場合「このPDFはテキストを含みません（画像PDF）」と表示される
- 分析後に「PPTXに変換する」ボタンで従来の変換フローに進める

---

## 対象外

- テキストボックス付きPPTXの生成（テキストが0文字のため意味がない）
- OCR（画像からテキスト認識）
- UIのリニューアル（別フェーズで frontend-design スキルを使用）

---

## アーキテクチャ

### ファイル構成

```
src/
  lib/
    analyzer.ts   ← 新規作成：PDF分析ロジック
    converter.ts  ← 変更なし
    utils.ts      ← 変更なし
  App.tsx         ← 変更あり：3ステップフローを追加
```

---

## analyzer.ts の設計

### 型定義

```ts
/** 1ページあたりのテキスト情報 */
export interface PageTextInfo {
  page: number;      // ページ番号（1始まり）
  charCount: number; // 抽出できた文字数（0 = 画像ページ）
}

/** PDF全体の分析結果 */
export interface PdfAnalysisResult {
  totalPages: number;       // 総ページ数
  pages: PageTextInfo[];    // ページごとの情報
  totalCharCount: number;   // 全ページの文字数合計
}
```

### エントリーポイント

```ts
export async function analyzePdf(file: File): Promise<PdfAnalysisResult>
```

### 処理フロー

1. `file.arrayBuffer()` でバイナリ取得
2. `pdfjs.getDocument()` でPDF解析
3. 各ページで `page.getTextContent()` を呼び出す
4. `items` の各要素の `str` プロパティの文字列長を合計してページの `charCount` を算出
5. 全ページの `charCount` を合計して `totalCharCount` を算出
6. `PdfAnalysisResult` を返す

### エラーハンドリング

- 特定ページの `getTextContent()` が失敗した場合：`charCount: 0` として処理継続
- PDF解析自体が失敗した場合：エラーをthrowして呼び出し元（App.tsx）でキャッチ

---

## App.tsx のフロー変更

### 現在の状態遷移

```
アップロード → 変換 → ダウンロード
```

### 新しい状態遷移

```
ステップ1: アップロード
  ↓ ファイル選択
ステップ2: PDF分析
  ↓「PDFを分析する」ボタン → analyzePdf() 実行
  → ページごとの文字数一覧を表示
  → totalCharCount === 0 の場合：
      「このPDFはテキストを含みません（画像PDFです）」を表示
  → totalCharCount > 0 の場合：
      合計文字数と各ページのテキスト文字数を表示
  ↓「PPTXに変換する」ボタン
ステップ3: 変換 → ダウンロード（既存フローそのまま）
```

### 追加するstateの型

```ts
const [analysisResult, setAnalysisResult] = useState<PdfAnalysisResult | null>(null);
const [isAnalyzing, setIsAnalyzing] = useState(false);
```

### 分析結果UIの表示内容

| 条件 | 表示内容 |
|------|---------|
| 分析中 | ローディングスピナー |
| totalCharCount === 0 | 「このPDFはテキストを含みません（画像PDFです）」 + ページ一覧（全て0文字） |
| totalCharCount > 0 | 「合計 N 文字のテキストを検出しました」 + ページ一覧 |

---

## データフロー

```
ユーザーがPDFを選択
  ↓
「PDFを分析する」ボタンをクリック
  ↓
analyzePdf(file) を呼び出す
  ↓
PdfAnalysisResult を受け取る
  ↓
setAnalysisResult() で状態更新 → UI にページごとの文字数を表示
  ↓
「PPTXに変換する」ボタンをクリック
  ↓
convertPdfToPptx(file) を呼び出す（既存フロー）
  ↓
ダウンロード
```

---

## テスト・検証手順

1. `npm run dev` でサーバーを起動
2. `sample_pdf/Multi-Agent_AI_Innovation.pdf` をアップロード
3. 「PDFを分析する」ボタンをクリック
4. 6ページ分の文字数が表示され、全て0文字であることを確認
5. 「このPDFはテキストを含みません（画像PDFです）」が表示されることを確認
6. 「PPTXに変換する」ボタンをクリックして変換・ダウンロードが正常に完了することを確認

---

## フェーズ3（設計書対象外）

動作確認後、`frontend-design` スキルを使って UI を全面リニューアルする。
