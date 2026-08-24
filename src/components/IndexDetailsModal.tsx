import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Database, RefreshCw, FileSearch, Fingerprint, Image as ImageIcon } from 'lucide-react';
import { getIndexSummary, type IndexSummary } from '../services/ragPipeline';

interface Props {
  open: boolean;
  onClose: () => void;
  onRebuild: () => void;
}

export function IndexDetailsModal({ open, onClose, onRebuild }: Props) {
  const [summary, setSummary] = useState<IndexSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getIndexSummary()
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">向量索引檢視</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Index Inspector</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-400 py-10">
                <RefreshCw className="w-4 h-4 animate-spin" /> 讀取索引資料中…
              </div>
            ) : !summary || summary.totalChunks === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
                <FileSearch className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400">目前 IndexedDB 中沒有任何段落，索引可能尚未建立或已被清空。</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-6 shrink-0">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{summary.totalChunks}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">總段落數</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{summary.sources.length}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">來源文件數</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{summary.totalImages}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">圖片段落數</div>
                  </div>
                </div>

                {summary.fingerprint && (
                  <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400 font-mono shrink-0">
                    <Fingerprint className="w-3 h-3 shrink-0" />
                    <span className="truncate">指紋碼：{summary.fingerprint.slice(0, 24)}…</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                  {summary.sources.map((s) => (
                    <div
                      key={s.source}
                      className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{s.source}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.imageCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                              <ImageIcon className="w-2.5 h-2.5" /> {s.imageCount}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                            {s.chunkCount} 段落
                          </span>
                        </div>
                      </div>
                      {s.sampleHeadingPath.length > 0 && (
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium mb-1 truncate">
                          章節：{s.sampleHeadingPath.join(' > ')}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">「{s.sampleText}…」</p>
                      <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1.5 font-mono">
                        向量維度：{s.embeddingDims}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={onRebuild}
              className="mt-6 w-full py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> 重新建立索引
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
