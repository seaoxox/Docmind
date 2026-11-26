import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export type AskStage = 'rewriting' | 'searching' | 'loading-docs' | 'generating';

export interface AskProgressState {
  stage: AskStage;
  /** Which steps this question will go through. */
  fullText: boolean;
  rewrite: boolean;
  /** Epoch ms when the current stage began — drives the elapsed-seconds counter. */
  stageStartedAt: number;
  /** Filled in as steps finish, shown next to the completed step. */
  rewrittenQuery?: string | null;
  chunkCount?: number;
  sourceCount?: number;
}

interface StepView {
  stage: AskStage;
  label: string;
  /** Short text shown once the step has finished. */
  doneDetail?: string;
  /** Hint shown while the step is running. */
  activeHint?: string;
}

function buildSteps(p: AskProgressState): StepView[] {
  const steps: StepView[] = [];
  if (p.fullText) {
    steps.push({
      stage: 'loading-docs',
      label: '載入分類內全部文件',
      doneDetail: p.sourceCount != null ? `${p.sourceCount} 份文件` : undefined,
    });
  } else {
    if (p.rewrite) {
      steps.push({
        stage: 'rewriting',
        label: '改寫查詢句',
        activeHint: '讓 AI 把問題改寫成更貼近文件用詞的查詢',
        doneDetail: p.rewrittenQuery ? `「${p.rewrittenQuery}」` : '未改寫，沿用原問題',
      });
    }
    steps.push({
      stage: 'searching',
      label: '向量搜尋相關段落',
      activeHint: '在本機比對語意相近的段落',
      doneDetail:
        p.chunkCount != null ? `找到 ${p.chunkCount} 段${p.sourceCount != null ? `，來自 ${p.sourceCount} 份文件` : ''}` : undefined,
    });
  }
  steps.push({
    stage: 'generating',
    label: '送交 AI 產生回答',
    activeHint: '等待 AI 讀完內容並回覆，內容越多越久',
  });
  return steps;
}

function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [startedAt]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function AskProgress({ progress }: { progress: AskProgressState }) {
  const steps = buildSteps(progress);
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.stage === progress.stage)
  );
  const elapsed = useElapsedSeconds(progress.stageStartedAt);

  return (
    <div className="h-full flex flex-col items-center justify-center py-20">
      <div className="w-full max-w-sm space-y-1" role="status" aria-live="polite">
        {steps.map((step, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <motion.div
              key={step.stage}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 py-1.5"
            >
              <div className="mt-0.5 shrink-0">
                {state === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : state === 'active' ? (
                  <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium',
                    state === 'done' && 'text-slate-500 dark:text-slate-400',
                    state === 'active' && 'text-slate-800 dark:text-slate-100',
                    state === 'pending' && 'text-slate-300 dark:text-slate-600'
                  )}
                >
                  {step.label}
                  {state === 'active' && (
                    <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-500">{elapsed} 秒</span>
                  )}
                </div>
                {state === 'active' && step.activeHint && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">{step.activeHint}</div>
                )}
                {state === 'done' && step.doneDetail && (
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 break-words">{step.doneDetail}</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
