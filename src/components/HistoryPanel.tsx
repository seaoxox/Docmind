import { History } from 'lucide-react';
import type { QuestionRecord } from '../types';
import { cn } from '../lib/utils';

function formatCost(v: number): string {
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
}

export function HistoryItem({
  record,
  active,
  onClick,
}: {
  record: QuestionRecord;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl text-sm cursor-pointer transition-all border border-transparent',
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/20'
          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      <div className="font-medium mb-1 line-clamp-2">{record.question}</div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] opacity-60', active ? 'text-indigo-100' : 'text-slate-400')}>
          {new Date(record.timestamp).toLocaleTimeString()}
        </span>
        {record.usage?.cost != null && (
          <span
            className={cn(
              'text-[10px] font-bold font-mono opacity-80',
              active ? 'text-indigo-100' : 'text-amber-600 dark:text-amber-500'
            )}
          >
            {formatCost(record.usage.cost)}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  history: QuestionRecord[];
  activeId: string | null;
  onSelect: (record: QuestionRecord) => void;
  totalCount?: number;
}

export function HistoryPanel({ history, activeId, onSelect, totalCount }: Props) {
  const hasMore = totalCount !== undefined && totalCount > history.length;
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">詢問記錄 / Records</h2>
        {hasMore && (
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">最新 {history.length} 筆</span>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar pb-40">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-50 space-y-2">
            <History className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">No records</span>
          </div>
        ) : (
          history.map((record) => (
            <HistoryItem key={record.id} record={record} active={activeId === record.id} onClick={() => onSelect(record)} />
          ))
        )}
      </div>
    </>
  );
}
