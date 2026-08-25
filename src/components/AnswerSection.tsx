import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Coins, Image as ImageIcon, FileStack } from 'lucide-react';
import type { QuestionRecord } from '../types';

function formatCost(v: number): string {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
}

function UsageTag({ record }: { record: QuestionRecord }) {
  if (!record.usage) return null;
  const { inputTokens, outputTokens, cost } = record.usage;
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-2">
      <span className="flex items-center gap-1.5">
        <Coins className="w-3 h-3 text-amber-400 shrink-0" />
        輸入 {inputTokens.toLocaleString()} · 輸出 {outputTokens.toLocaleString()} tokens
        {cost != null && <> · {formatCost(cost)}</>}
      </span>
      {record.usedFullTextMode && (
        <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
          <FileStack className="w-3 h-3 shrink-0" /> 全文模式
        </span>
      )}
      {record.usedImageCount > 0 && (
        <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
          <ImageIcon className="w-3 h-3 shrink-0" /> 已附上 {record.usedImageCount} 張圖片
        </span>
      )}
    </div>
  );
}

interface Props {
  record: QuestionRecord | null;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}

export function AnswerSection({ record, loading, error, compact = false }: Props) {
  return (
    <AnimatePresence mode="wait">
      {error ? (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
        >
          {error}
        </motion.div>
      ) : !record && !loading ? (
        <div
          className={
            compact
              ? 'h-full flex flex-col items-center justify-center text-center opacity-30 dark:opacity-20 py-20'
              : 'h-full flex flex-col items-center justify-center text-center py-20 opacity-30 dark:opacity-20'
          }
        >
          <div
            className={
              compact
                ? 'mb-4 text-slate-400 dark:text-slate-600'
                : 'w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-600 mb-8'
            }
          >
            <LayoutDashboard className={compact ? 'w-12 h-12' : 'w-10 h-10'} />
          </div>
          {!compact && (
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight mb-2">DocMind Q&A</h1>
          )}
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-widest leading-loose">
            {compact ? 'Select documents and ask a question' : 'Select documents and ask to begin'}
          </p>
        </div>
      ) : loading ? (
        <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                className="w-3 h-3 rounded-full bg-indigo-500"
              />
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-300 dark:text-slate-700">
            Searching Documents...
          </p>
        </div>
      ) : record ? (
        <motion.div key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          {!compact && (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 dark:bg-slate-100 rounded-2xl flex items-center justify-center text-white dark:text-slate-900 font-bold text-lg shadow-xl dark:shadow-indigo-500/10">
                AI
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">回答結果</h1>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-0.5">
                  {record.question}
                </div>
                <UsageTag record={record} />
              </div>
            </div>
          )}
          {compact ? (
            <div>
              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border-l-4 border-indigo-600 dark:border-indigo-500 text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                <div className="prose prose-sm dark:prose-invert prose-indigo dark:prose-indigo max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{record.answer}</ReactMarkdown>
                </div>
              </div>
              <UsageTag record={record} />
            </div>
          ) : (
            <div className="relative">
              <div className="p-8 bg-indigo-50/20 dark:bg-indigo-900/10 border-l-4 border-indigo-600 dark:border-indigo-500 rounded-r-3xl shadow-sm">
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{record.answer}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
