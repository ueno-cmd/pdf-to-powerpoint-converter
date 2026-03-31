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
  ScanSearch,
  Presentation,
  ChevronRight,
} from 'lucide-react';
import { convertPdfToPptx, ConversionProgress } from './lib/converter';
import { analyzePdf, PdfAnalysisResult, PageTextInfo } from './lib/analyzer';

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
      setError('有効なPDFファイルを選択してください。');
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
      setError('有効なPDFファイルをドロップしてください。');
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
      setError('PDFの分析中にエラーが発生しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setError(null);
    setProgress({ currentPage: 0, totalPages: 0, status: '変換を開始しています...' });
    try {
      const blob = await convertPdfToPptx(file, (p) => setProgress(p));
      setResultBlob(blob);
    } catch (err) {
      console.error(err);
      setError('変換中にエラーが発生しました。再度お試しください。');
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

  // ステップインジケーター
  const currentStep = !file ? 0 : !analysisResult && !isAnalyzing ? 1 : !resultBlob && !isConverting ? 2 : 3;

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        :root {
          --bg: #0d0f0e;
          --surface: #141716;
          --surface2: #1c1f1d;
          --border: #252927;
          --accent: #00ff87;
          --accent-dim: #00ff8733;
          --accent-glow: 0 0 20px #00ff8755;
          --text: #e8ede9;
          --muted: #5a6360;
          --danger: #ff4d4d;
          --warn: #ffb347;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* グリッドノイズ背景 */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.35;
          pointer-events: none;
          z-index: 0;
        }

        .mono { font-family: 'JetBrains Mono', monospace; }

        /* スキャンライン演出 */
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .scanline {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(transparent, var(--accent), transparent);
          opacity: 0.08;
          animation: scanline 8s linear infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* アクセントのパルス */
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 8px #00ff8744; }
          50% { box-shadow: 0 0 24px #00ff8788; }
        }

        /* カーソル点滅 */
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .cursor::after {
          content: '█';
          animation: blink 1.2s step-end infinite;
          color: var(--accent);
          margin-left: 2px;
          font-size: 0.75em;
        }

        .step-active { color: var(--accent); }
        .step-done { color: var(--muted); text-decoration: line-through; }
        .step-pending { color: var(--muted); }
      `}</style>

      <div className="scanline" />

      {/* ヘッダー */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: '#0d0f0ecc',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 28, height: 28,
            border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
            <Presentation size={14} />
          </div>
          <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            PDF<span style={{ color: 'var(--accent)' }}>→</span>PPTX
          </span>
        </div>
        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>
          ANALYZER v2.0
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 2, paddingTop: '56px', minHeight: '100vh' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>

          {/* ヒーロー */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: '3rem' }}
          >
            <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.2em', marginBottom: '1rem' }}>
              // PDF STRUCTURE INSPECTOR
            </div>
            <h1 className="cursor" style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '1.2rem',
            }}>
              PDFの中身を<br />
              <span style={{ color: 'var(--accent)' }}>解剖</span>する
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: '480px' }}>
              NotebookLMのPDFはテキストが入っているのか？<br />
              分析して、真実を確かめてからPPTXに変換する。
            </p>
          </motion.div>

          {/* ステップインジケーター */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mono"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.7rem', letterSpacing: '0.1em',
              marginBottom: '2rem',
              padding: '0.75rem 1rem',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {[
              { label: 'UPLOAD', n: 0 },
              { label: 'ANALYZE', n: 1 },
              { label: 'CONVERT', n: 2 },
              { label: 'DONE', n: 3 },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <span className={
                  currentStep === s.n ? 'step-active' :
                  currentStep > s.n ? 'step-done' : 'step-pending'
                }>
                  {s.label}
                </span>
                {i < 3 && <ChevronRight size={10} style={{ color: 'var(--border)', flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </motion.div>

          {/* メインカード */}
          <AnimatePresence mode="wait">
            {!file ? (
              /* ─── アップロードゾーン ─── */
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '1px dashed var(--border)',
                  background: 'var(--surface)',
                  padding: '4rem 2rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                whileHover={{
                  borderColor: 'var(--accent)',
                  backgroundColor: '#141716',
                }}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" style={{ display: 'none' }} />
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  style={{
                    width: 56, height: 56,
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <FileUp size={24} />
                </motion.div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>PDFをドロップ</p>
                  <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    or click to browse — .pdf only
                  </p>
                </div>
              </motion.div>
            ) : (
              /* ─── ファイル選択後カード ─── */
              <motion.div
                key="file-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                {/* ファイル情報バー */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface2)',
                }}>
                  <div style={{
                    width: 36, height: 36,
                    border: '1px solid var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', flexShrink: 0,
                  }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </p>
                    <p className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    className="mono"
                    style={{
                      fontSize: '0.65rem', color: 'var(--muted)',
                      background: 'none', border: '1px solid var(--border)',
                      padding: '4px 10px', cursor: 'pointer',
                      letterSpacing: '0.1em',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--muted)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    RESET
                  </button>
                </div>

                {/* コンテンツエリア */}
                <div style={{ padding: '1.5rem 1.25rem' }}>
                  <AnimatePresence mode="wait">
                    {isConverting ? (
                      /* 変換中 */
                      <motion.div key="converting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                          // RENDERING SLIDES...
                        </div>
                        <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {progress?.status || '変換中...'}
                          </span>
                          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                            {progress?.totalPages ? `${Math.round((progress.currentPage / progress.totalPages) * 100)}%` : '—'}
                          </span>
                        </div>
                        <div style={{
                          height: '2px', background: 'var(--border)',
                          overflow: 'hidden', marginBottom: '1rem',
                        }}>
                          <motion.div
                            style={{ height: '100%', background: 'var(--accent)' }}
                            initial={{ width: '0%' }}
                            animate={{ width: progress?.totalPages ? `${(progress.currentPage / progress.totalPages) * 100}%` : '15%' }}
                            transition={{ ease: 'linear' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Loader2 size={12} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }} />
                          <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.05em' }}>
                            ブラウザ内で処理中 — しばらくお待ちください
                          </span>
                        </div>
                      </motion.div>

                    ) : resultBlob ? (
                      /* 変換完了 */
                      <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                        <div style={{
                          padding: '1rem',
                          border: '1px solid var(--accent)',
                          background: 'var(--accent-dim)',
                          marginBottom: '1.25rem',
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                        }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                            CONVERSION COMPLETE — ready to download
                          </span>
                        </div>
                        <button
                          onClick={handleDownload}
                          style={{
                            width: '100%', padding: '0.9rem',
                            background: 'var(--accent)',
                            color: '#0d0f0e', border: 'none',
                            fontFamily: 'Syne, sans-serif', fontWeight: 700,
                            fontSize: '0.9rem', letterSpacing: '0.05em',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          <Download size={16} />
                          PPTXをダウンロード
                        </button>
                      </motion.div>

                    ) : !analysisResult ? (
                      /* 分析ボタン */
                      <motion.div key="analyze" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                          <span style={{ color: 'var(--accent)' }}>STEP 1/2</span>
                          {' '}— まずテキストを解析します。<br />
                          NotebookLMのPDFは画像PDFのため、テキストは検出されません。
                        </div>
                        <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          style={{
                            width: '100%', padding: '0.9rem',
                            background: isAnalyzing ? 'var(--surface2)' : 'var(--surface2)',
                            color: isAnalyzing ? 'var(--muted)' : 'var(--text)',
                            border: '1px solid',
                            borderColor: isAnalyzing ? 'var(--border)' : 'var(--accent)',
                            fontFamily: 'Syne, sans-serif', fontWeight: 600,
                            fontSize: '0.9rem', letterSpacing: '0.05em',
                            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                            transition: 'all 0.15s',
                          }}
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                              解析中...
                            </>
                          ) : (
                            <>
                              <ScanSearch size={15} style={{ color: 'var(--accent)' }} />
                              テキストを解析する
                              <ArrowRight size={14} style={{ color: 'var(--accent)', marginLeft: 'auto' }} />
                            </>
                          )}
                        </button>
                      </motion.div>

                    ) : (
                      /* 分析結果 + 変換ボタン */
                      <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {/* ターミナル風出力 */}
                        <div style={{
                          background: '#080a09',
                          border: '1px solid var(--border)',
                          padding: '1rem',
                          marginBottom: '1.25rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.72rem',
                        }}>
                          <div style={{ color: 'var(--muted)', marginBottom: '0.6rem', letterSpacing: '0.08em' }}>
                            <span style={{ color: 'var(--accent)' }}>$</span> pdf-analyze --text-extract "{file.name}"
                          </div>

                          {/* 結果ヘッダー */}
                          <div style={{
                            padding: '0.5rem 0.75rem',
                            borderLeft: analysisResult.totalCharCount === 0
                              ? '2px solid var(--danger)'
                              : '2px solid var(--accent)',
                            marginBottom: '0.75rem',
                            background: analysisResult.totalCharCount === 0 ? '#ff4d4d11' : 'var(--accent-dim)',
                          }}>
                            <span style={{
                              color: analysisResult.totalCharCount === 0 ? 'var(--danger)' : 'var(--accent)',
                              fontWeight: 700, letterSpacing: '0.08em',
                            }}>
                              {analysisResult.totalCharCount === 0
                                ? '⚠ TEXT NOT FOUND — IMAGE PDF DETECTED'
                                : `✓ ${analysisResult.totalCharCount} chars extracted`}
                            </span>
                          </div>

                          {/* ページ一覧 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 1.5rem' }}>
                            {analysisResult.pages.map((p: PageTextInfo) => (
                              <div key={p.page} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '1px 0' }}>
                                <span>page_{String(p.page).padStart(2, '0')}</span>
                                <span style={{ color: p.charCount === 0 ? '#ff4d4d66' : 'var(--accent)' }}>
                                  {p.charCount === 0 ? '0 chars' : `${p.charCount} chars`}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* 合計 */}
                          <div style={{
                            marginTop: '0.75rem', paddingTop: '0.6rem',
                            borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between',
                          }}>
                            <span style={{ color: 'var(--muted)' }}>total</span>
                            <span style={{ color: analysisResult.totalCharCount === 0 ? 'var(--danger)' : 'var(--accent)', fontWeight: 700 }}>
                              {analysisResult.totalCharCount} chars
                            </span>
                          </div>
                        </div>

                        <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                          <span style={{ color: 'var(--accent)' }}>STEP 2/2</span>
                          {' '}— 各ページを高解像度画像としてスライドに変換します。
                        </div>

                        <button
                          onClick={handleConvert}
                          style={{
                            width: '100%', padding: '0.9rem',
                            background: 'var(--accent)',
                            color: '#0d0f0e', border: 'none',
                            fontFamily: 'Syne, sans-serif', fontWeight: 700,
                            fontSize: '0.9rem', letterSpacing: '0.05em',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          PPTXに変換する
                          <ArrowRight size={15} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* エラー表示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--danger)',
                  background: '#ff4d4d11',
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                }}
              >
                <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* インフォセクション */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ marginTop: '4rem' }}
          >
            <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: '1.5rem' }}>
              // TECHNICAL NOTES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'var(--border)' }}>
              {[
                { label: 'RENDERING', value: 'pdfjs-dist v5', note: '各ページをCanvas描画' },
                { label: 'OUTPUT', value: 'pptxgenjs v4', note: '画像スライドとして出力' },
                { label: 'TEXT API', value: 'getTextContent()', note: 'NLM PDFでは常に0文字' },
              ].map((item) => (
                <div key={item.label} style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                }}>
                  <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
                    {item.label}
                  </div>
                  <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 500, marginBottom: '0.25rem' }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.note}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* フッター */}
      <footer style={{
        position: 'relative', zIndex: 2,
        borderTop: '1px solid var(--border)',
        padding: '1.5rem',
        textAlign: 'center',
      }}>
        <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em' }}>
          © 2026 PDF→PPTX ANALYZER — built with Claude Code
        </span>
      </footer>

      {/* スピンアニメーション用CSS */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
