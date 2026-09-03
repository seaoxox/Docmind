import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Layers3, Check } from 'lucide-react';
import type { GuidanceCategory } from '../types';
import { cn } from '../lib/utils';

const UNCATEGORIZED_ID = '__uncategorized__';

interface Props {
  categories: GuidanceCategory[];
  uncategorizedCount: number;
  selectedId: string | 'all';
  onChange: (id: string | 'all') => void;
  compact?: boolean;
}

export function CategorySelector({ categories, uncategorizedCount, selectedId, onChange, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (categories.length === 0 && uncategorizedCount === 0) return null;

  const selectedLabel =
    selectedId === 'all'
      ? '全部指引'
      : selectedId === UNCATEGORIZED_ID
        ? '未分類文件'
        : (categories.find((c) => c.id === selectedId)?.name ?? '全部指引');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 transition hover:border-indigo-300 dark:hover:border-indigo-500/50',
          compact ? 'px-2.5 py-1.5 text-[10px] font-bold' : 'px-3 py-1.5 text-xs font-bold'
        )}
      >
        <Layers3 size={compact ? 11 : 13} className="text-indigo-500 shrink-0" />
        <span className="truncate max-w-[120px]">{selectedLabel}</span>
        <ChevronDown size={compact ? 11 : 13} className="text-slate-400 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition',
                selectedId === 'all'
                  ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
              )}
            >
              <span className="flex-1 font-medium">全部指引</span>
              {selectedId === 'all' && <Check size={12} />}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition',
                  selectedId === c.id
                    ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                )}
              >
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[10px] text-slate-400">{c.files.length}</span>
                {selectedId === c.id && <Check size={12} />}
              </button>
            ))}
            {uncategorizedCount > 0 && (
              <button
                onClick={() => {
                  onChange(UNCATEGORIZED_ID);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition',
                  selectedId === UNCATEGORIZED_ID
                    ? 'bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                )}
              >
                <span className="flex-1 truncate">未分類文件</span>
                <span className="text-[10px] text-slate-400">{uncategorizedCount}</span>
                {selectedId === UNCATEGORIZED_ID && <Check size={12} />}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
