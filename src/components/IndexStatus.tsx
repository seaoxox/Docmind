import { RefreshCw, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { IndexStatus } from '../services/ragPipeline';
import { cn } from '../lib/utils';

interface Props {
  status: IndexStatus;
  onOpenDetails: () => void;
  onRetry: () => void;
  compact?: boolean;
  /** Chunk count scoped to the currently selected category, shown instead of the index's
   *  total chunk count once known — null while still being computed. */
  categoryChunkCount?: number | null;
}

export function IndexStatusBadge({ status, onOpenDetails, onRetry, compact = false, categoryChunkCount }: Props) {
  const base = 'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold';

  if (status.phase === 'embedding') {
    const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
    return (
      <div className={cn(base, 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300')}>
        <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
        {!compact && <span className="whitespace-nowrap">建立向量索引中 {pct}%</span>}
        {compact && <span>{pct}%</span>}
      </div>
    );
  }

  if (status.phase === 'checking') {
    return (
      <div className={cn(base, 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500')}>
        <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
        {!compact && <span>檢查索引中…</span>}
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <button
        onClick={onRetry}
        className={cn(base, 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400')}
        title={status.message}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        {!compact && <span>索引建立失敗，點擊重試</span>}
      </button>
    );
  }

  if (status.phase === 'ready') {
    const displayCount = categoryChunkCount ?? status.chunkCount;
    return (
      <button
        onClick={onOpenDetails}
        className={cn(
          base,
          'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400'
        )}
        title="點擊檢視索引內容"
      >
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        {!compact ? <span className="whitespace-nowrap">已索引 {displayCount} 段落</span> : <span>{displayCount}</span>}
      </button>
    );
  }

  return (
    <div className={cn(base, 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500')}>
      <Database className="w-3 h-3 shrink-0" />
    </div>
  );
}
