import { type KeyboardEvent } from 'react';
import { Send, RefreshCw, Coins, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

export interface CostEstimate {
  inputTokens: number;
  costLow: number;
  costHigh: number;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  variant?: 'desktop' | 'mobile';
  costEstimate?: CostEstimate | null;
  /** The model that will answer — shown beside the "Ask" heading. */
  model?: { label: string; id: string; provider: string };
}

function ModelChip({ model }: { model: NonNullable<Props['model']> }) {
  return (
    <span
      className="inline-flex max-w-[60%] items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      title={`${model.provider}：${model.id}`}
    >
      <Cpu className="h-3 w-3 shrink-0" />
      <span className="truncate">{model.label}</span>
    </span>
  );
}

function formatCost(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(3)}`;
}

function CostHint({ estimate, compact = false }: { estimate: CostEstimate; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-slate-400 dark:text-slate-500',
        compact ? 'text-[10px] mt-1.5 px-1' : 'text-[10px] mt-2.5'
      )}
    >
      <Coins className="w-3 h-3 shrink-0 text-amber-400" />
      <span>
        預估輸入 ~{estimate.inputTokens.toLocaleString()} tokens · 預估花費 {formatCost(estimate.costLow)}–
        {formatCost(estimate.costHigh)}（依實際回答長度而定）
      </span>
    </div>
  );
}

export function AskInput({ value, onChange, onSubmit, loading, variant = 'desktop', costEstimate, model }: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  if (variant === 'mobile') {
    return (
      <div>
        {model && (
          <div className="mb-1.5 px-1">
            <ModelChip model={model} />
          </div>
        )}
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 pr-12 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700 dark:text-slate-200"
            rows={2}
            placeholder="輸入您的問題..."
          />
          <button
            onClick={onSubmit}
            disabled={loading}
            className="absolute right-3 bottom-4 p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-40"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {costEstimate && <CostHint estimate={costEstimate} compact />}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">提出問題 / Ask</h2>
        {model && <ModelChip model={model} />}
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none shadow-inner dark:shadow-none placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-700 dark:text-slate-200"
          rows={3}
          placeholder="請輸入您的問題..."
        />
        <button
          onClick={onSubmit}
          disabled={loading}
          className={cn(
            'absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20'
          )}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {costEstimate && <CostHint estimate={costEstimate} />}
    </>
  );
}
