import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  Presentation
} from 'lucide-react';
import { convertPdfToPptx, ConversionProgress } from './lib/converter';
import { analyzePdf, PdfAnalysisResult, PageTextInfo } from './lib/analyzer';
import { cn } from './lib/utils';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PdfAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setResultBlob(null);
      setAnalysisResult(null);
    } else if (selectedFile) {
      setError('Please select a valid PDF file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      setResultBlob(null);
      setAnalysisResult(null);
    } else if (droppedFile) {
      setError('Please drop a valid PDF file.');
    }
  };

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

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setError(null);
    setProgress({ currentPage: 0, totalPages: 0, status: 'Starting conversion...' });

    try {
      const blob = await convertPdfToPptx(file, (p) => setProgress(p));
      setResultBlob(blob);
    } catch (err) {
      console.error(err);
      setError('An error occurred during conversion. Please try again.');
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '') + '.pptx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResultBlob(null);
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans selection:bg-[#ff6b6b]/20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-[#e5e5e5] bg-white/80 backdrop-blur-md z-50 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#ff6b6b] rounded-lg flex items-center justify-center text-white shadow-sm">
            <Presentation size={18} />
          </div>
          <span className="font-semibold tracking-tight">PDF to PPTX</span>
        </div>
        <div className="text-xs font-medium text-[#8e8e8e] uppercase tracking-widest">
          High Fidelity Converter
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <div className="space-y-12">
          {/* Hero Section */}
          <section className="text-center space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold tracking-tight leading-[1.1]"
            >
              Convert PDF slides to <br />
              <span className="text-[#ff6b6b]">PowerPoint</span> perfectly.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-[#8e8e8e] text-lg max-w-xl mx-auto"
            >
              Maintain original design, layout, and high-resolution visuals. 
              Ready for your next presentation.
            </motion.p>
          </section>

          {/* Upload Area */}
          <section>
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "group relative h-80 border-2 border-dashed border-[#e5e5e5] rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300",
                    "hover:border-[#ff6b6b] hover:bg-[#ff6b6b]/5"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".pdf" 
                    className="hidden" 
                  />
                  <div className="w-16 h-16 rounded-full bg-[#f5f5f5] flex items-center justify-center text-[#8e8e8e] group-hover:bg-[#ff6b6b]/10 group-hover:text-[#ff6b6b] transition-colors duration-300">
                    <FileUp size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-lg">Drop your PDF here</p>
                    <p className="text-[#8e8e8e] text-sm">or click to browse files</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="file-selected"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white border border-[#e5e5e5] rounded-3xl p-8 shadow-sm space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5f5f5] flex items-center justify-center text-[#ff6b6b]">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{file.name}</p>
                      <p className="text-[#8e8e8e] text-sm">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={reset}
                      className="text-[#8e8e8e] hover:text-[#1a1a1a] transition-colors"
                    >
                      Change
                    </button>
                  </div>

                  {isConverting ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span>{progress?.status || 'Converting...'}</span>
                        {progress?.totalPages ? (
                          <span>{Math.round((progress.currentPage / progress.totalPages) * 100)}%</span>
                        ) : null}
                      </div>
                      <div className="h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#ff6b6b]"
                          initial={{ width: 0 }}
                          animate={{ 
                            width: progress?.totalPages 
                              ? `${(progress.currentPage / progress.totalPages) * 100}%` 
                              : '10%' 
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[#8e8e8e] text-sm">
                        <Loader2 className="animate-spin" size={14} />
                        <span>Processing slides... this may take a moment.</span>
                      </div>
                    </div>
                  ) : resultBlob ? (
                    <div className="space-y-6">
                      <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700">
                        <CheckCircle2 size={20} />
                        <span className="font-medium">Conversion complete!</span>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="w-full h-14 bg-[#1a1a1a] text-white rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-[#333] transition-all active:scale-[0.98]"
                      >
                        <Download size={20} />
                        Download PowerPoint
                      </button>
                    </div>
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
                          {analysisResult.pages.map((p: PageTextInfo) => (
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
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            {[
              { 
                title: 'Perfect Design', 
                desc: 'Uses high-resolution rendering to ensure every font, layout, and image is exactly as it was in the PDF.',
                icon: Presentation
              },
              { 
                title: 'Fast Process', 
                desc: 'Optimized conversion logic that handles large files efficiently directly in your browser.',
                icon: Loader2
              },
              { 
                title: 'Ready to Use', 
                desc: 'Download standard PPTX files compatible with all presentation software.',
                icon: Download
              }
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-3xl border border-[#e5e5e5] bg-white space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] flex items-center justify-center text-[#ff6b6b]">
                  <feature.icon size={20} />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-[#8e8e8e] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </section>

          {/* How it works */}
          <section className="bg-[#f5f5f5] rounded-3xl p-8 space-y-4">
            <h2 className="text-xl font-bold tracking-tight">How it works</h2>
            <p className="text-[#8e8e8e] text-sm leading-relaxed">
              Our converter uses high-fidelity rendering technology. Instead of trying to guess fonts and layouts (which often breaks designs), 
              we render each PDF page into a high-resolution image and perfectly align it on a PowerPoint slide. 
              This ensures your presentation looks exactly the same as the original PDF.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-[#e5e5e5] text-center">
        <p className="text-[#8e8e8e] text-sm">
          &copy; 2026 PDF to PPTX Converter. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
