# PDF to PPTX コンバーター 動作修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google AI Studio が生成した壊れたコードを修正し、NotebookLM の PDF を PPTX に変換できるローカルWebアプリを動作させる。

**Architecture:** `converter.ts` をゼロから書き直し、PDF.js Worker のローカル配信・pptxgenjs v4 の正しい API・動的スライドサイズ設定を実装する。UI（App.tsx）は変更しない。

**Tech Stack:** React 19, TypeScript, Vite 6, pdfjs-dist 5.6.205, pptxgenjs 4.0.1, Tailwind CSS v4

---

## ファイル構成

| 操作 | パス | 内容 |
|------|------|------|
| 修正 | `vite.config.ts` | `optimizeDeps.exclude` に `pdfjs-dist` を追加 |
| 書き直し | `src/lib/converter.ts` | Worker ローカル解決・正しい API・動的サイズ |
| 変更なし | `src/App.tsx` | UI はそのまま |
| 変更なし | `src/lib/utils.ts` | 変更なし |

---

## Task 1: vite.config.ts を修正して PDF.js Worker をローカル解決できるようにする

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: 現在の vite.config.ts を確認する**

```bash
cat vite.config.ts
```

期待される出力: `plugins: [react(), tailwindcss()]` を含む設定が表示される

- [ ] **Step 2: optimizeDeps.exclude を追加する**

`vite.config.ts` を以下のように修正する（既存の設定を保持しつつ `optimizeDeps` を追加）:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // pdfjs-dist を Vite の事前バンドルから除外して
    // ?url インポートで Worker ファイルを正しく解決できるようにする
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
```

- [ ] **Step 3: TypeScript コンパイルエラーがないか確認する**

```bash
npm run lint
```

期待される出力: エラーなし（警告は無視してよい）

- [ ] **Step 4: コミットする**

```bash
git add vite.config.ts
git commit -m "fix: pdfjs-distをViteの事前バンドルから除外してWorkerをローカル解決"
```

---

## Task 2: converter.ts をゼロから書き直す

**Files:**
- Rewrite: `src/lib/converter.ts`

### 修正する問題点（参照用）

| # | 問題 | 修正 |
|---|------|------|
| 1 | Worker を CDN から読み込み → CORS・オフラインで失敗 | `?url` インポートでローカル解決 |
| 2 | `pptx.write({ outputType: 'blob' })` → v4 では無効 | `pptx.write('blob')` に変更 |
| 3 | `LAYOUT_16x9` 固定 → NLM 以外の PDF でズレる | 1ページ目のサイズから動的に設定 |
| 4 | `@ts-ignore` 2箇所 → 実行時エラーの温床 | 正しい型で書き直し |

- [ ] **Step 1: pdfjs-dist v5 の型定義を確認する（参考）**

```bash
grep -n "render\|RenderTask" node_modules/pdfjs-dist/types/src/display/api.d.ts | head -20
```

期待される出力: `render(params: RenderParameters): RenderTask` のような定義が見える

- [ ] **Step 2: converter.ts を以下の内容で書き直す**

```ts
// pdfjs-dist の Worker をローカルファイルとして解決（CDN依存を排除）
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import pptxgen from 'pptxgenjs';

// Vite の ?url インポートで得たローカルパスを設定
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ConversionProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

export async function convertPdfToPptx(
  file: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<Blob> {
  // PDF をバイナリとして読み込む
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const pptx = new pptxgen();

  // 1ページ目のサイズを取得してスライドサイズを動的に設定
  // （NLMのPDFは16:9横長だが、他のPDFにも対応できるようにする）
  const firstPage = await pdf.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1.0 });
  // PDF の単位は pt（1pt = 1/72インチ）なので インチに変換
  const slideWidthInches = firstViewport.width / 72;
  const slideHeightInches = firstViewport.height / 72;
  pptx.defineLayout({
    name: 'PDF_LAYOUT',
    width: slideWidthInches,
    height: slideHeightInches,
  });
  pptx.layout = 'PDF_LAYOUT';

  // 各ページをCanvasにレンダリングして画像としてスライドに貼り付ける
  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress({
        currentPage: i,
        totalPages,
        status: `ページ ${i} / ${totalPages} を処理中...`,
      });
    }

    const page = await pdf.getPage(i);
    // scale: 2.0 で高解像度レンダリング（ぼやけ防止）
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas コンテキストを取得できませんでした');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // PDF ページを Canvas にレンダリング
    const renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;

    // Canvas の内容を PNG 画像データとして取得
    const imageData = canvas.toDataURL('image/png');

    // スライドを追加して画像をフルサイズで配置
    const slide = pptx.addSlide();
    slide.addImage({
      data: imageData,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  // pptxgenjs v4 の正しい API: write('blob') で Blob を返す
  const output = await pptx.write('blob');
  return output as Blob;
}
```

- [ ] **Step 3: TypeScript コンパイルエラーがないか確認する**

```bash
npm run lint
```

期待される出力: エラーなし

もし `workerSrc` の型エラーが出た場合は `src/vite-env.d.ts` に以下を追加する:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: コミットする**

```bash
git add src/lib/converter.ts
git commit -m "fix: converter.tsを書き直し - WorkerローカルDB化・pptxgenjs v4 API修正・動的スライドサイズ対応"
```

---

## Task 3: 動作確認

**Files:**
- なし（確認のみ）

- [ ] **Step 1: 開発サーバーを起動する**

```bash
npm run dev
```

期待される出力:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

エラーが出た場合は Task 1・2 に戻って確認する。

- [ ] **Step 2: ブラウザで http://localhost:3000 を開く**

- アプリの UI が表示されることを確認する
- コンソール（F12）にエラーが出ていないことを確認する

- [ ] **Step 3: サンプルPDFをアップロードして変換する**

- `sample_pdf/Multi-Agent_AI_Innovation.pdf` をドラッグ＆ドロップ（または「click to browse」でアップロード）
- 「Convert to PPTX」ボタンをクリック
- 進捗バーが動いて「Conversion complete!」が表示されることを確認する

- [ ] **Step 4: ダウンロードして内容を確認する**

- 「Download PowerPoint」ボタンをクリック
- ダウンロードされた `.pptx` ファイルを LibreOffice Impress または PowerPoint で開く
- 6枚のスライドが正しく表示されることを確認する

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "feat: PDF to PPTX コンバーター 動作修正完了"
```

---

## トラブルシューティング

### `Failed to fetch dynamically imported module` エラー
→ Task 1 の `optimizeDeps.exclude` が正しく設定されているか確認。開発サーバーを再起動する。

### `Cannot read properties of undefined (reading 'write')` エラー
→ `pptx.write('blob')` の引数が正しいか確認。`{ outputType: 'blob' }` になっていないか確認。

### スライドが真っ白になる
→ `canvas.getContext('2d')` が null でないか確認。`renderTask.promise` が正しく await されているか確認。

### スライドのアスペクト比がおかしい
→ `firstViewport.width / 72` の計算が正しいか確認。`pdfinfo sample_pdf/Multi-Agent_AI_Innovation.pdf` で実際のサイズ（1376×768pt）と一致しているか確認。
