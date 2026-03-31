import * as pdfjs from 'pdfjs-dist';

// converter.ts と同じ Worker 設定を使用（new URL でローカル解決）
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
