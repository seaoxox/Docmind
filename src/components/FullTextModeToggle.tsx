import { AnimatePresence, motion } from 'motion/react';
import { FileStack, AlertTriangle } from 'lucide-react';
import { Switch } from './Switch';

function formatCost(v: number): string {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
}

interface Props {
  enabled: boolean;
  onChange: (v: boolean) => void;
  estimatedTokens: number;
  estimatedCost: number | null;
  docCount: number;
}

export function FullTextModeToggle({ enabled, onChange, estimatedTokens, estimatedCost, docCount }: Props) {
  return (
    <div className="mb-3">
      <div
        className={
          enabled
            ? 'flex items-center justify-between gap-3 p-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/20'
            : 'flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700'
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileStack className={enabled ? 'w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' : 'w-4 h-4 text-slate-400 shrink-0'} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">全文模式</div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">跳過向量篩選，直接送出全部文件</div>
          </div>
        </div>
        <Switch checked={enabled} onChange={onChange} activeColor="bg-amber-500" />
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                將送出全部 {docCount} 份文件，預估輸入 ~{estimatedTokens.toLocaleString()} tokens
                {estimatedCost != null && <> · 預估花費約 {formatCost(estimatedCost)}</>}
                。費用會明顯高於一般問答，請確認再送出。
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
