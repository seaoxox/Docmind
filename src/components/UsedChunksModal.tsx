import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Layers, ChevronDown, Image as ImageIcon, Quote } from 'lucide-react';
import type { QuestionRecord } from '../types';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  history: QuestionRecord[];
  onClose: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

export function UsedChunksModal({ open, history, onClose }: Props) {
  const records = history.slice(0, 10).filter((r) => r.usedChunks.length > 0);
  const [expandedId, setExpandedId] = useState<string | null>(records[0]?.id ?? null);

  const totalChunks = records.reduce((sum, r) => sum + r.usedChunks.length, 0);

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
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">查詢段落詳情</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    最新 {records.length} 筆提問 · 共 {totalChunks} 個段落
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {records.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 py-16 text-slate-300 dark:text-slate-700">
                  <Layers className="w-8 h-8" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">尚無可顯示的段落紀錄</span>
                </div>
              ) : (
                records.map((record) => {
                  const isOpen = expandedId === record.id;
                  return (
                    <div
                      key={record.id}
                      className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedId(isOpen ? null : record.id)}
                        className="w-full flex items-center justify-between gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                            {record.question}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {formatTime(record.timestamp)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                            {record.usedChunks.length} 段落
                          </span>
                          <ChevronDown
                            className={cn('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')}
                          />
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 space-y-2 bg-white dark:bg-slate-900">
                              {record.usedChunks.map((chunk, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/40 dark:bg-slate-800/20"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[60%]">
                                      {chunk.source}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {chunk.hasImage && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                                          <ImageIcon className="w-2.5 h-2.5" /> 圖片
                                        </span>
                                      )}
                                      <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                        score {chunk.score.toFixed(3)}
                                      </span>
                                    </div>
                                  </div>
                                  {chunk.headingPath.length > 0 && (
                                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium mb-1.5 truncate">
                                      章節：{chunk.headingPath.join(' > ')}
                                    </p>
                                  )}
                                  {chunk.matchedText && chunk.matchedText !== chunk.text && (
                                    <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                                      <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                                        命中片段（小切片）
                                      </p>
                                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                                        {chunk.matchedText}
                                      </p>
                                    </div>
                                  )}
                                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                                    完整區塊（送給 AI 的內容）
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                    <Quote className="w-2.5 h-2.5 inline mr-1 text-slate-300 dark:text-slate-600" />
                                    {chunk.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
