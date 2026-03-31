import * as pdfjs from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';

// Worker をローカルの pdfjs-dist パッケージから解決する
// CDN への依存を排除し、オフライン環境でも動作するようにする
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/** 変換進捗を通知するためのインターフェース */
export interface ConversionProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

/**
 * PDF ファイルを PPTX (PowerPoint) 形式に変換する
 *
 * 各ページを高解像度の画像としてレンダリングし、
 * スライドの背景として配置することでレイアウトを完全再現する。
 *
 * @param file - 変換対象の PDF ファイル
 * @param onProgress - 変換進捗コールバック（省略可能）
 * @returns 変換後の PPTX ファイルを表す Blob
 */
export async function convertPdfToPptx(
  file: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const pptx = new pptxgen();

  // 1ページ目のアスペクト比を取得してプレゼンテーション全体のレイアウトを設定する
  // PDF の縦横比を保持することでスライドが歪まないようにする
  const firstPage = await pdf.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1.0 });
  const aspectRatio = firstViewport.width / firstViewport.height;

  // PowerPoint の標準高さ (インチ) を基準にスライドサイズを算出
  const slideHeightInches = 7.5;
  const slideWidthInches = slideHeightInches * aspectRatio;
  pptx.defineLayout({
    name: 'PDF_LAYOUT',
    width: slideWidthInches,
    height: slideHeightInches,
  });
  pptx.layout = 'PDF_LAYOUT';

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress({ currentPage: i, totalPages, status: `ページ ${i} を処理中...` });
    }

    const page = await pdf.getPage(i);
    // scale: 2.0 で高解像度レンダリングを行い、文字やグラフィックの鮮明さを確保する
    const viewport = page.getViewport({ scale: 2.0 });

    // ページを Canvas に描画して base64 画像データを取得する
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas コンテキストを取得できませんでした');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // pdfjs v5 では canvas を必須で渡す必要がある（canvasContext はオプション）
    await page.render({ canvas, viewport }).promise;
    const imageData = canvas.toDataURL('image/png');

    // スライドを追加し、レンダリングした画像をスライド全面に配置する
    const slide = pptx.addSlide();
    slide.addImage({
      data: imageData,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  // pptxgenjs v4 の write API: outputType を 'blob' に指定して Blob を取得する
  // 戻り値の型は string | ArrayBuffer | Blob | Uint8Array の union なので Blob にキャストする
  const output = await pptx.write({ outputType: 'blob' });
  return output as Blob;
}
