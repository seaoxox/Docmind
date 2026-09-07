import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Folder, FileText, BookOpen, LayoutDashboard, X, ArrowLeft, HelpCircle } from 'lucide-react';
import type { AppDocument, GuidanceCategory } from '../types';
import { cn } from '../lib/utils';
import { renderFullText } from '../services/chunking';

const UNCATEGORIZED_ID = '__uncategorized__';

interface DisplayGroup {
  id: string;
  name: string;
  description?: string;
  files: string[];
}

interface Props {
  categories: GuidanceCategory[];
  uncategorizedFiles: string[];
  docs: AppDocument[];
}

function extLabel(filename: string) {
  return filename.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function fileTypeLabel(doc: AppDocument | undefined) {
  if (!doc) return 'FILE';
  if (doc.type === 'markdown') return 'MARKDOWN';
  if (doc.type === 'pdf') return 'PDF';
  if (doc.type === 'word') return 'WORD';
  if (doc.type === 'text') return 'TEXT';
  return 'FILE';
}

export function GuidanceCategoryBrowser({ categories, uncategorizedFiles, docs }: Props) {
  const docsByName = useMemo(() => new Map(docs.map((d) => [d.name, d])), [docs]);

  const groups: DisplayGroup[] = useMemo(() => {
    const base: DisplayGroup[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      files: c.files || [],
    }));
    if (uncategorizedFiles.length > 0) {
      base.push({
        id: UNCATEGORIZED_ID,
        name: '未分類文件',
        description: '尚未加入 guidance_categories.json 分類的文件',
        files: uncategorizedFiles,
      });
    }
    return base;
  }, [categories, uncategorizedFiles]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!activeGroupId && groups.length > 0) setActiveGroupId(groups[0].id);
  }, [groups, activeGroupId]);

  useEffect(() => {
    setActiveFile(null);
  }, [activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const activeDoc = activeFile ? docsByName.get(activeFile) : null;

  const GroupNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-3">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] px-4">指引分類 / CATEGORIES</div>
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => {
            setActiveGroupId(group.id);
            onNavigate?.();
          }}
          className={cn(
            'w-full flex items-center justify-between group p-4 rounded-2xl transition-all cursor-pointer text-left',
            activeGroupId === group.id
              ? 'bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800/40'
          )}
        >
          <div className="flex items-center gap-4 overflow-hidden">
            {group.id === UNCATEGORIZED_ID ? (
              <HelpCircle
                className={cn('w-4 h-4 shrink-0 transition-colors', activeGroupId === group.id ? 'text-amber-500' : 'text-slate-300')}
              />
            ) : (
              <Folder
                className={cn('w-4 h-4 shrink-0 transition-colors', activeGroupId === group.id ? 'text-indigo-500' : 'text-slate-300')}
              />
            )}
            <span className="text-sm font-bold uppercase tracking-tight truncate">{group.name}</span>
          </div>
          {activeGroupId === group.id && <motion.div layoutId="activeGroup" className="w-1 h-3 bg-indigo-500 rounded-full" />}
        </button>
      ))}
      {groups.length === 0 && (
        <div className="py-16 text-center px-6">
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
            尚未設定任何指引分類。請在 <code className="text-indigo-500">public/guidance_categories.json</code> 中新增分類與檔案清單。
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-white dark:bg-slate-900 h-full overflow-hidden relative">
      <div className="lg:hidden fixed top-4 right-4 z-[110]">
        <button
          onClick={() => setIsMenuOpen((o) => !o)}
          className="w-10 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 active:scale-95 transition-all"
        >
          <LayoutDashboard className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-[120]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute top-0 right-0 bottom-0 w-[300px] bg-slate-50 dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col p-6 overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tighter">指引分類</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <GroupNav onNavigate={() => setIsMenuOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex w-[350px] bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col pt-8 pb-8 px-8 overflow-y-auto custom-scrollbar">
        <div className="mb-10 text-left">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tighter">指引文件</h2>
          <div className="flex items-center gap-3">
            <div className="h-[2px] w-8 bg-indigo-500 rounded-full" />
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Guideline Categories</p>
          </div>
        </div>
        <GroupNav />
      </aside>

      <main className="flex-1 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar p-6 pt-6 lg:p-24 lg:pt-16">
        <div className="max-w-4xl mx-auto">
          {activeFile && activeDoc ? (
            <div className="space-y-8">
              <button
                onClick={() => setActiveFile(null)}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> 返回文件列表
              </button>
              <div className="flex items-end justify-between border-b-4 border-slate-900 dark:border-white pb-6">
                <div>
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em] mb-2">
                    File / {fileTypeLabel(activeDoc)}
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter break-all">{activeDoc.name}</h2>
                </div>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{renderFullText(activeDoc.blocks) || activeDoc.content}</ReactMarkdown>
              </div>
            </div>
          ) : activeGroup ? (
            <div className="space-y-12">
              <div className="flex items-end justify-between border-b-4 border-slate-900 dark:border-white pb-6">
                <div>
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em] mb-2">
                    Category / GUIDELINE
                  </div>
                  <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{activeGroup.name}</h2>
                  {activeGroup.description && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-lg">{activeGroup.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-slate-300 dark:text-slate-700">{activeGroup.files?.length ?? 0}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Files</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(activeGroup.files ?? []).map((filename) => {
                  const doc = docsByName.get(filename);
                  const type = fileTypeLabel(doc);
                  return (
                    <button
                      key={filename}
                      onClick={() => doc && setActiveFile(filename)}
                      disabled={!doc}
                      className={cn(
                        'p-6 rounded-3xl border text-left flex items-center gap-4 transition-all',
                        doc
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900'
                          : 'bg-slate-50/50 dark:bg-slate-800/20 border-dashed border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black text-[8px] tracking-tighter leading-none shrink-0',
                          type === 'PDF'
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/30'
                            : type === 'WORD'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30'
                        )}
                      >
                        <FileText className="w-5 h-5 mb-1" />
                        {extLabel(filename)}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{filename}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {doc ? type : '尚未載入或找不到此檔案'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {(activeGroup.files?.length ?? 0) === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
                  <Folder className="w-16 h-16 mx-auto opacity-20 mb-4 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold text-slate-400">此分類尚無文件</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-40 opacity-20">
              <BookOpen className="w-20 h-20 mb-8" />
              <p className="text-xs font-black uppercase tracking-[0.5em]">Select a category to browse files</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
