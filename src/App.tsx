import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, History as HistoryIcon, X, Quote } from 'lucide-react';

import type { AppDocument, Manifest, ManualChapter, ProviderSettings, QuestionRecord, RagSettings, StoredProviderSettings, ViewMode, Citation } from './types';
import { cn, taipeiDateString, uid } from './lib/utils';
import { estimateTokens } from './lib/tokenEstimate';
import { parseFromUrl } from './services/docParser';
import { askQuestion, usageToTokenUsage, SYSTEM_PROMPT_TEXT } from './services/aiService';
import { getModelPricing } from './services/models';
import { loadManifest } from './services/manifest';
import { ensureIndex, search, type IndexStatus } from './services/ragPipeline';
import {
  loadSettings,
  saveSettings,
  resolveActiveSettings,
  loadRagSettings,
  saveRagSettings,
  loadHistory,
  saveHistory,
  loadTheme,
  saveTheme,
  getDisclaimerAcceptedDate,
  setDisclaimerAcceptedDate,
} from './services/storage';

import { Disclaimer } from './components/Disclaimer';
import { SettingsModal } from './components/SettingsModal';
import { SidebarDrawer } from './components/SidebarDrawer';
import { IndexStatusBadge } from './components/IndexStatus';
import { IndexDetailsModal } from './components/IndexDetailsModal';
import { IndexingOverlay } from './components/IndexingOverlay';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HistoryPanel, HistoryItem } from './components/HistoryPanel';
import { AnswerSection } from './components/AnswerSection';
import { CitationStrip, CitationModal } from './components/CitationStrip';
import { SourceTags } from './components/SourceTags';
import { AskInput, type CostEstimate } from './components/AskInput';
import { ManualBrowser } from './components/ManualBrowser';

const BASE = import.meta.env.BASE_URL;

export default function App() {
  // ---- Theme ----
  const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme());
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  // ---- Disclaimer ----
  const [disclaimerOpen, setDisclaimerOpen] = useState(() => getDisclaimerAcceptedDate() !== taipeiDateString());
  const acceptDisclaimer = () => {
    setDisclaimerAcceptedDate(taipeiDateString());
    setDisclaimerOpen(false);
  };

  // ---- Settings ----
  const [storedSettings, setStoredSettings] = useState<StoredProviderSettings>(loadSettings());
  const [ragSettings, setRagSettings] = useState<RagSettings>(loadRagSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings: ProviderSettings = useMemo(() => resolveActiveSettings(storedSettings), [storedSettings]);
  const handleSaveSettings = (s: StoredProviderSettings) => {
    setStoredSettings(s);
    saveSettings(s);
  };
  const handleSaveRagSettings = (s: RagSettings) => {
    setRagSettings(s);
    saveRagSettings(s);
  };

  // ---- View mode / navigation ----
  const [viewMode, setViewMode] = useState<ViewMode>('qa');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---- Documents + vector index ----
  const [manualChapters, setManualChapters] = useState<ManualChapter[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus>({ phase: 'idle' });
  const [indexDetailsOpen, setIndexDetailsOpen] = useState(false);
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  const [isRebuild, setIsRebuild] = useState(false);
  const allDocsRef = useRef<AppDocument[]>([]);
  const manifestRef = useRef<Manifest>({ guidanceFiles: [], manual: [] });

  const runIndexing = async (forceRebuild = false) => {
    setIsRebuild(forceRebuild);
    await ensureIndex(allDocsRef.current, manifestRef.current, setIndexStatus, forceRebuild);
  };

  const requestRebuild = () => setRebuildConfirmOpen(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const manifest = await loadManifest();
        manifestRef.current = manifest;

        const guidanceResults = await Promise.allSettled(
          manifest.guidanceFiles.map((f) => parseFromUrl(`${BASE}guidance_docs/${f.name}`, f.name, 'guidance'))
        );

        const manualFileJobs: Promise<AppDocument>[] = [];
        for (const chapter of manifest.manual) {
          for (const file of chapter.files) {
            if (file.type === 'image') continue;
            manualFileJobs.push(parseFromUrl(`${BASE}${file.path}`, file.filename, 'manual'));
          }
        }
        const manualResults = await Promise.allSettled(manualFileJobs);

        if (cancelled) return;

        const guidanceDocs = guidanceResults
          .filter((r): r is PromiseFulfilledResult<AppDocument> => r.status === 'fulfilled')
          .map((r) => r.value);
        const manualDocs = manualResults
          .filter((r): r is PromiseFulfilledResult<AppDocument> => r.status === 'fulfilled')
          .map((r) => r.value);

        allDocsRef.current = [...guidanceDocs, ...manualDocs];
        setManualChapters(manifest.manual);

        await ensureIndex(allDocsRef.current, manifestRef.current, setIndexStatus);
      } catch (err) {
        if (!cancelled) {
          setIndexStatus({ phase: 'error', message: err instanceof Error ? err.message : '文件載入失敗。' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- History / Q&A ----
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [history, setHistory] = useState<QuestionRecord[]>(loadHistory());
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);

  useEffect(() => saveHistory(history), [history]);

  const currentRecord = history.find((r) => r.id === currentRecordId) ?? null;

  const sessionCost = useMemo(
    () => history.reduce((sum, r) => sum + (r.usage?.cost ?? 0), 0),
    [history]
  );

  // Pre-send cost prediction (B): debounced, runs the actual local vector search
  // (free, in-browser) so the estimate reflects the real context that would be sent.
  useEffect(() => {
    const q = question.trim();
    if (!q || indexStatus.phase !== 'ready') {
      setCostEstimate(null);
      return;
    }
    const pricing = getModelPricing(settings.model);
    if (!pricing) {
      setCostEstimate(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const chunks = await search(q, ragSettings.topK);
        if (cancelled) return;
        const contextTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.text), 0);
        const inputTokens = contextTokens + estimateTokens(SYSTEM_PROMPT_TEXT) + estimateTokens(q);
        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const OUTPUT_TOKENS_LOW = 300;
        const OUTPUT_TOKENS_HIGH = 900;
        setCostEstimate({
          inputTokens,
          costLow: inputCost + (OUTPUT_TOKENS_LOW / 1_000_000) * pricing.output,
          costHigh: inputCost + (OUTPUT_TOKENS_HIGH / 1_000_000) * pricing.output,
        });
      } catch {
        if (!cancelled) setCostEstimate(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [question, indexStatus.phase, settings.model, ragSettings.topK]);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    if (indexStatus.phase !== 'ready') {
      setAskError('向量索引尚未建立完成，請稍候再試。');
      return;
    }
    setAskError(null);
    setAsking(true);
    const q = question;
    try {
      const chunks = await search(q, ragSettings.topK);
      const result = await askQuestion(settings, q, chunks);
      const record: QuestionRecord = {
        id: uid('qr'),
        question: q,
        answer: result.answer,
        citations: result.citations,
        timestamp: Date.now(),
        retrievedSources: Array.from(new Set(chunks.map((c) => c.source))),
        usedImageCount: result.imageCount,
        usage: usageToTokenUsage(result.usage, settings.model),
      };
      setHistory((prev) => [record, ...prev]);
      setCurrentRecordId(record.id);
      setQuestion('');
      setCostEstimate(null);
      setMobileHistoryOpen(false);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : '提問時發生未知錯誤。');
    } finally {
      setAsking(false);
    }
  };

  const handleSelectHistory = (record: QuestionRecord) => {
    setCurrentRecordId(record.id);
    setAskError(null);
  };

  return (
    <div className={cn('flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden', theme === 'dark' && 'dark')}>
      <Disclaimer open={disclaimerOpen} onAccept={acceptDisclaimer} />
      <IndexingOverlay status={indexStatus} isRebuild={isRebuild} />
      <IndexDetailsModal
        open={indexDetailsOpen}
        onClose={() => setIndexDetailsOpen(false)}
        onRebuild={() => {
          setIndexDetailsOpen(false);
          requestRebuild();
        }}
      />
      <ConfirmDialog
        open={rebuildConfirmOpen}
        onClose={() => setRebuildConfirmOpen(false)}
        onConfirm={() => runIndexing(true)}
        title="重新建立向量索引？"
        message="這會清除目前已建立的向量索引，並重新切割、嵌入所有指引文件，過程中無法進行問答，可能需要一些時間。"
        secondMessage="請再次確認：此操作無法復原，將立即清除現有索引並重新開始建立。確定要繼續嗎？"
      />
      <SettingsModal
        open={settingsOpen}
        settings={storedSettings}
        ragSettings={ragSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onSaveRag={handleSaveRagSettings}
      />
      <SidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={viewMode}
        onChangeMode={setViewMode}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenIndexDetails={() => setIndexDetailsOpen(true)}
        sessionCost={sessionCost}
      />

      {/* Floating control bar (top-left) */}
      <div className="fixed top-4 left-4 lg:top-6 lg:left-6 z-[110] flex items-center gap-2 lg:gap-3 max-w-[420px]">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 lg:p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl lg:rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 transition-all text-slate-800 dark:text-white flex items-center gap-2 lg:gap-3 font-bold text-xs lg:text-sm pr-3 lg:pr-5 group shrink-0"
        >
          <div className="w-6 h-6 lg:w-8 lg:h-8 bg-indigo-600 rounded-lg lg:rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none group-hover:rotate-12 transition-transform">
            <Menu className="w-3 h-3 lg:w-4 lg:h-4" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="tracking-tight text-[10px] lg:text-xs">功能選單</span>
            <span className="text-[7px] lg:text-[8px] text-indigo-500 uppercase font-black tracking-widest leading-none mt-0.5">
              {viewMode === 'qa' ? '指引問答' : '指引文件'}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {viewMode === 'qa' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="hidden lg:block"
            >
              <IndexStatusBadge status={indexStatus} onOpenDetails={() => setIndexDetailsOpen(true)} onRetry={requestRebuild} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex w-full h-full overflow-hidden relative">
        {viewMode === 'qa' ? (
          <>
            {/* DESKTOP QA LAYOUT */}
            <div className="hidden lg:flex w-full h-full">
              <aside className="w-[380px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm pt-24">
                <div className="flex-1 flex flex-col min-h-0 relative">
                  <div className="p-6 flex-1 flex flex-col min-h-0">
                    <HistoryPanel history={history} activeId={currentRecordId} onSelect={handleSelectHistory} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/50">
                    <AskInput
                      value={question}
                      onChange={setQuestion}
                      onSubmit={handleAsk}
                      loading={asking}
                      error={askError}
                      onRetry={handleAsk}
                      variant="desktop"
                      costEstimate={costEstimate}
                    />
                  </div>
                </div>
              </aside>

              <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative h-full">
                <section className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
                  <div className="max-w-3xl mx-auto min-h-full">
                    <AnswerSection record={currentRecord} loading={asking} error={null} />
                  </div>
                </section>

                <section className="h-[210px] border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 lg:p-5 flex flex-col overflow-hidden shrink-0">
                  <div className="flex items-center justify-between mb-2 max-w-5xl mx-auto w-full px-2 gap-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2 shrink-0">
                      <Quote className="w-2.5 h-2.5" />
                      對應出處 / Source References
                    </h3>
                    {currentRecord && (
                      <div className="flex items-center gap-2 min-w-0">
                        <SourceTags sources={currentRecord.retrievedSources} />
                        <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                          {currentRecord.citations.length} Citations
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="max-w-5xl mx-auto w-full flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
                    <CitationStrip
                      citations={currentRecord?.citations ?? []}
                      hasRecord={!!currentRecord}
                      onSelect={setSelectedCitation}
                    />
                  </div>
                </section>

                <CitationModal citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
              </main>
            </div>

            {/* MOBILE QA LAYOUT */}
            <div className="flex lg:hidden flex-col w-full h-full bg-white dark:bg-slate-900 relative">
              <header className="flex items-center justify-between p-4 pl-32 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
                <IndexStatusBadge status={indexStatus} onOpenDetails={() => setIndexDetailsOpen(true)} onRetry={requestRebuild} compact />
                <button
                  onClick={() => setMobileHistoryOpen(true)}
                  className="flex items-center gap-2 py-2.5 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[11px] font-bold border border-slate-200 dark:border-slate-700"
                >
                  <HistoryIcon className="w-4 h-4" />
                  詢問紀錄
                </button>
              </header>

              <main className="flex-1 overflow-y-auto p-5 space-y-6 relative custom-scrollbar pb-32">
                <AnswerSection record={currentRecord} loading={asking} error={askError} compact />

                {currentRecord && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1 gap-3">
                      <h3 className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] shrink-0">
                        對應出處
                      </h3>
                      <SourceTags sources={currentRecord.retrievedSources} max={2} />
                    </div>
                    <CitationStrip
                      citations={currentRecord.citations}
                      hasRecord
                      onSelect={setSelectedCitation}
                      variant="carousel"
                    />
                  </div>
                )}

                <CitationModal citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
              </main>

              <footer className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md absolute bottom-0 left-0 right-0 z-20">
                <AskInput
                  value={question}
                  onChange={setQuestion}
                  onSubmit={handleAsk}
                  loading={asking}
                  variant="mobile"
                  costEstimate={costEstimate}
                />
              </footer>

              {/* Mobile history overlay */}
              <AnimatePresence>
                {mobileHistoryOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 flex flex-col justify-end"
                  >
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 max-h-[70vh] flex flex-col shadow-2xl"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">最後 10 筆詢問記錄</h2>
                        <button
                          onClick={() => setMobileHistoryOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 pb-6 custom-scrollbar">
                        {history.slice(0, 10).map((record) => (
                          <HistoryItem
                            key={record.id}
                            record={record}
                            active={currentRecordId === record.id}
                            onClick={() => {
                              handleSelectHistory(record);
                              setMobileHistoryOpen(false);
                            }}
                          />
                        ))}
                        {history.length === 0 && (
                          <div className="p-10 text-center text-slate-400 italic">尚無詢問記錄</div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <ManualBrowser chapters={manualChapters} basePath={BASE} />
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1E293B; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}
