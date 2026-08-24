import { AnimatePresence, motion } from 'motion/react';
import { X, MessageSquare, BookOpen, Settings as SettingsIcon, RotateCw, Coins, History } from 'lucide-react';
import type { ViewMode } from '../types';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: ViewMode;
  onChangeMode: (mode: ViewMode) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenIndexDetails: () => void;
  onOpenHistoryArchive: () => void;
  sessionCost: number;
}

export function SidebarDrawer({
  open,
  onClose,
  mode,
  onChangeMode,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenIndexDetails,
  onOpenHistoryArchive,
  sessionCost,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120]"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed top-0 left-0 bottom-0 w-[320px] bg-white dark:bg-slate-900 z-[121] shadow-2xl flex flex-col border-r border-slate-100 dark:border-slate-800"
          >
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-indigo-100 dark:shadow-none">
                  D
                </div>
                <div>
                  <h2 className="font-black text-xl tracking-tighter text-slate-900 dark:text-white">DocMind</h2>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">純前端版</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                Main Navigation
              </div>

              <button
                onClick={() => {
                  onChangeMode('qa');
                  onClose();
                }}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-left group',
                  mode === 'qa'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-900/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    mode === 'qa' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'
                  )}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm">指引問答</div>
                  <div className={cn('text-[10px] font-medium opacity-60', mode === 'qa' ? 'text-white' : 'text-slate-400')}>
                    AI Assistant
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeMode('manual');
                  onClose();
                }}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-left group',
                  mode === 'manual'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-900/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    mode === 'manual' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'
                  )}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm">指引文件</div>
                  <div className={cn('text-[10px] font-medium opacity-60', mode === 'manual' ? 'text-white' : 'text-slate-400')}>
                    Guidance Documents
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenSettings();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-left group text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm">AI 供應商設定</div>
                  <div className="text-[10px] font-medium opacity-60 text-slate-400">API Key & Model</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenHistoryArchive();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-left group text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm">歷史問答紀錄</div>
                  <div className="text-[10px] font-medium opacity-60 text-slate-400">All Q&A Records</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenIndexDetails();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-left group text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
                  <RotateCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm">向量索引檢視／重建</div>
                  <div className="text-[10px] font-medium opacity-60 text-slate-400">Inspect / Rebuild Index</div>
                </div>
              </button>

              <div className="pt-8 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                Shortcuts
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  系統會自動將指引文件切割並嵌入為向量，於每次提問時搜尋最相關的段落作答，不需手動選擇文件。所有解析、嵌入與向量索引皆儲存於您瀏覽器的
                  IndexedDB 本機資料庫。
                </p>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {sessionCost > 0 && (
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <Coins className="w-3 h-3 text-amber-400" /> 本次工作階段花費
                  </span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                    ${sessionCost < 0.01 ? sessionCost.toFixed(4) : sessionCost.toFixed(3)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest">純前端運作中</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex justify-center py-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
