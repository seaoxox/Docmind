import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, History, Search, Trash2, Coins } from 'lucide-react';
import type { QuestionRecord } from '../types';
import { HistoryItem } from './HistoryPanel';

interface Props {
  open: boolean;
  history: QuestionRecord[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (record: QuestionRecord) => void;
  onRequestClear: () => void;
}

function formatCost(v: number): string {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
}

export function HistoryArchiveModal({ open, history, activeId, onClose, onSelect, onRequestClear }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((r) => r.question.toLowerCase().includes(q) || r.answer.toLowerCase().includes(q));
  }, [history, query]);

  const totalCost = useMemo(() => history.reduce((sum, r) => sum + (r.usage?.cost ?? 0), 0), [history]);

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
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">歷史問答紀錄</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    共 {history.length} 筆
                    {totalCost > 0 && (
                      <span className="inline-flex items-center gap-1 ml-2 text-amber-500 normal-case tracking-normal">
                        <Coins className="w-2.5 h-2.5" /> 累計 {formatCost(totalCost)}
                      </span>
                    )}
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

            <div className="relative mb-4 shrink-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋問題或回答內容…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 py-16 text-slate-300 dark:text-slate-700">
                  <History className="w-8 h-8" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {history.length === 0 ? '尚無詢問記錄' : '沒有符合的結果'}
                  </span>
                </div>
              ) : (
                filtered.map((record) => (
                  <HistoryItem
                    key={record.id}
                    record={record}
                    active={activeId === record.id}
                    onClick={() => {
                      onSelect(record);
                      onClose();
                    }}
                  />
                ))
              )}
            </div>

            {history.length > 0 && (
              <button
                onClick={onRequestClear}
                className="mt-6 w-full py-3 rounded-2xl font-bold text-sm border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                <Trash2 className="w-4 h-4" /> 清空所有歷史紀錄
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
