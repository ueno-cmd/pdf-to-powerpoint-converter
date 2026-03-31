# PDF to PPTX Converter

NotebookLM からダウンロードした PDF を PowerPoint（.pptx）に変換するローカルWebアプリ。

---

## このプロジェクトで学んだこと

### PDFのテキスト抽出は思ったより難しい

NotebookLM からダウンロードできる PDF は、**完全な画像PDF**である。
`pdfjs-dist` の `getTextContent()` でテキスト抽出を試みても、全ページ **0文字** という結果になる。

つまり：
- PDFにテキストデータは埋め込まれていない
- 編集可能なPPTXを作るには、画像からテキストを認識する（OCR）か、LLM APIで解析するしかない
- LLM APIを使うにしても「画像からどうテキストを認識させるか」「どれだけの精度が出るか」「APIコストをどう抑えるか」という新たな論点が生まれる

### GoogleAIStudioで「かんたんに作れる」は本当か？

このプロジェクトはもともと Google AI Studio が自動生成したコードをベースにしている。
しかし生成されたコードには以下の問題があり、**起動すらしなかった**：

| 問題 | 内容 |
|------|------|
| `npm install` 未実施 | `vite: not found` で起動失敗 |
| Worker の CDN 依存 | オフライン・CORS環境で PDF 読み込み失敗 |
| `pptxgenjs v4` API 誤用 | `write({ outputType: 'blob' })` は無効 |
| `@ts-ignore` 2箇所 | 型エラーを握りつぶしていた |
| スライドサイズ固定 | PDFのサイズを無視して `LAYOUT_16x9` 固定 |

Claude Code でこれらを修正し、さらに PDF テキスト分析機能を追加することで、
「PDFをいじることがいかに難しいか」を実証するデモとして完成させた。

---

## 機能

- PDF ファイルのアップロード（ドラッグ＆ドロップ対応）
- **PDF テキスト分析**：ページごとの文字数を表示（NotebookLM の PDF は全0文字）
- PDF → PPTX 変換（各ページを高解像度画像としてスライドに配置）
- PPTX ファイルのダウンロード

---

## ローカルでの起動方法

**前提条件：** Node.js

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

---

## 技術スタック

| ライブラリ | 用途 |
|-----------|------|
| React 19 + TypeScript | UI |
| Vite 6 | ビルドツール |
| pdfjs-dist 5.6.205 | PDF 解析・レンダリング |
| pptxgenjs 4.0.1 | PPTX 生成 |
| Tailwind CSS v4 | スタイリング |
