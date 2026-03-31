# 設計書：PDF to PPTX コンバーター（動作修正フェーズ）

作成日: 2026-03-31

---

## 概要

NotebookLM からダウンロードした PDF（16:9 横長スライド形式）を PowerPoint（.pptx）に変換するローカルWebアプリ。

Google AI Studio が生成したコードは起動すら失敗していたため、問題箇所を特定してフェーズ1として動作する状態に修正する。フェーズ2では UI を全面リニューアルする。

---

## ゴール

- `npm install && npm run dev` で起動できる
- PDF をアップロードして「Convert to PPTX」ボタンを押すと変換が走る
- 変換後にPPTXファイルをダウンロードできる
- サンプルPDF（1376×768pt、16:9）で正しく変換できる

---

## 対象外（フェーズ1では扱わない）

- テキスト編集可能なPPTX生成（テキスト抽出・レイアウト再現）
- UI のリニューアル（フェーズ2で `frontend-design` スキルを使用）
- 公開・デプロイ

---

## アーキテクチャ

### ファイル構成

```
src/
  lib/
    converter.ts   ← 書き直し対象（問題の核心）
    utils.ts       ← 変更なし
  App.tsx          ← 変更なし
vite.config.ts     ← PDF.js Worker のローカル配信設定を追加
```

### 依存ライブラリ（変更なし）

| ライブラリ | 用途 |
|-----------|------|
| `pdfjs-dist` | PDFのページをCanvasにレンダリング |
| `pptxgenjs` | PPTXファイルの生成 |

---

## 修正内容の詳細

### 1. `converter.ts` の書き直し

#### 問題1：`pptx.write()` のAPI誤用

```ts
// ❌ 壊れているコード（v4では無効）
const output = await pptx.write({ outputType: 'blob' });

// ✅ 正しいコード
const output = await pptx.write('blob');
```

#### 問題2：PDF.js Worker の CDN 依存

```ts
// ❌ 壊れているコード（CDN障害・CORS・オフライン環境で失敗）
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ✅ 正しいコード（Viteのasset URLとして解決）
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
// ※ pdfjs-dist v5 ではパスが変わっている場合があるため、
//   実装時に node_modules/pdfjs-dist/build/ 以下のファイルを確認すること
```

#### 問題3：スライドサイズの固定

```ts
// ❌ 壊れているコード（PDFサイズを無視して16:9固定）
pptx.layout = 'LAYOUT_16x9';

// ✅ 正しいコード（PDFの実際のサイズから計算）
const viewport = page.getViewport({ scale: 1.0 });
pptx.defineLayout({
  name: 'CUSTOM',
  width: viewport.width / 72,   // pts → インチ変換
  height: viewport.height / 72,
});
pptx.layout = 'CUSTOM';
```

#### 問題4：`@ts-ignore` による型エラーの握りつぶし

```ts
// ❌ 壊れているコード
// @ts-ignore - pdfjs types can be tricky between versions
await page.render({ canvasContext: context, viewport }).promise;
// @ts-ignore - pptxgenjs v4+ uses an object for write
const output = await pptx.write({ outputType: 'blob' });

// ✅ 正しいコード（型を正しく扱う）
const renderTask = page.render({ canvasContext: context, viewport });
await renderTask.promise;
const output = await pptx.write('blob') as Blob;
```

### 2. `vite.config.ts` の修正

PDF.js の Worker ファイルを Vite の `?url` インポートでローカル解決できるよう、
`optimizeDeps.exclude` に `pdfjs-dist` を追加する。

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],  // Viteの事前バンドルから除外してWorkerを正しく解決
  },
});
```

---

## データフロー

```
ユーザーがPDFを選択
  ↓
file.arrayBuffer() でバイナリ取得
  ↓
pdfjs.getDocument() でPDFを解析
  ↓
ページ1枚目のサイズを取得 → PPTXのスライドサイズを動的設定
  ↓
各ページをループ:
  1. page.getViewport({ scale: 2.0 }) で高解像度ビューポート取得
  2. Canvas にレンダリング
  3. canvas.toDataURL('image/png') で画像データ取得
  4. pptx.addSlide() → slide.addImage() でスライドに貼り付け
  ↓
pptx.write('blob') でBlobを生成
  ↓
ダウンロードリンクをクリックしてPPTXを保存
```

---

## エラーハンドリング

- PDF解析失敗：`getDocument().promise` のcatchで日本語エラーメッセージを表示
- Canvas取得失敗：`getContext('2d')` が null の場合は早期throwで明示的なエラー
- PPTX生成失敗：`write()` のcatchで日本語エラーメッセージを表示

---

## テスト・検証手順

1. `npm install` が正常終了すること
2. `npm run dev` でサーバーが起動すること（`http://localhost:3000`）
3. `sample_pdf/Multi-Agent_AI_Innovation.pdf`（6ページ、1376×768pt）をアップロード
4. 「Convert to PPTX」ボタンを押してエラーなく完了すること
5. ダウンロードした `.pptx` を PowerPoint / LibreOffice で開いて6枚のスライドが正しく表示されること

---

## フェーズ2（設計書対象外）

動作確認後、`frontend-design` スキルを使って UI を全面リニューアルする。
