import { useEffect, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, KeyRound, Info, ChevronDown, SlidersHorizontal, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import type { AiProvider, RagSettings, StoredProviderSettings } from '../types';
import { DEFAULT_MODELS, MODEL_OPTIONS } from '../services/models';
import { TOP_K as RECOMMENDED_TOP_K } from '../services/ragPipeline';
import { RAG_TOP_K_BOUNDS } from '../services/storage';
import { cn } from '../lib/utils';
import { Switch } from './Switch';

interface Props {
  open: boolean;
  settings: StoredProviderSettings;
  ragSettings: RagSettings;
  onClose: () => void;
  onSave: (settings: StoredProviderSettings) => void;
  onSaveRag: (settings: RagSettings) => void;
}

const PROVIDERS: { id: AiProvider; label: string; keyHint: string; keyUrl: string }[] = [
  { id: 'gemini', label: 'Google Gemini', keyHint: 'AIza...', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', label: 'OpenAI', keyHint: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic Claude', keyHint: 'sk-ant-...', keyUrl: 'https://console.anthropic.com/settings/keys' },
];

function topKWarning(topK: number): string | null {
  if (topK === RECOMMENDED_TOP_K) return null;
  if (topK < RECOMMENDED_TOP_K) {
    return `調低搜尋段落數可能導致遺漏跨文件的相關內容，回答完整度可能下降。建議值為 ${RECOMMENDED_TOP_K}。`;
  }
  return `調高搜尋段落數會增加送給 AI 的內容量，提升每次提問的 token 花費與回應時間。建議值為 ${RECOMMENDED_TOP_K}。`;
}

export function SettingsModal({ open, settings, ragSettings, onClose, onSave, onSaveRag }: Props) {
  const [draft, setDraft] = useState<StoredProviderSettings>(settings);
  const [ragDraft, setRagDraft] = useState<RagSettings>(ragSettings);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setRagDraft(ragSettings);
    }
  }, [open, settings, ragSettings]);

  const activeProvider = draft.activeProvider;
  const activeApiKey = draft.apiKeys[activeProvider] ?? '';
  const activeModel = draft.models[activeProvider] || DEFAULT_MODELS[activeProvider];
  const activeMeta = PROVIDERS.find((p) => p.id === activeProvider)!;

  const handleProviderChange = (provider: AiProvider) => {
    setDraft((d) => ({ ...d, activeProvider: provider }));
  };

  const handleApiKeyChange = (value: string) => {
    setDraft((d) => ({ ...d, apiKeys: { ...d.apiKeys, [activeProvider]: value } }));
  };

  const handleModelChange = (value: string) => {
    setDraft((d) => ({ ...d, models: { ...d.models, [activeProvider]: value } }));
  };

  const handleSave = () => {
    onSave(draft);
    onSaveRag(ragDraft);
    onClose();
  };

  const warning = topKWarning(ragDraft.topK);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-semibold">AI 供應商設定</h2>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">供應商</label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">每家的 API Key 分開儲存</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => {
                    const hasKey = (draft.apiKeys[p.id] ?? '').trim().length > 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProviderChange(p.id)}
                        className={cn(
                          'relative rounded-lg border px-2 py-2 text-xs font-medium transition',
                          activeProvider === p.id
                            ? 'border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                        )}
                      >
                        {hasKey && (
                          <CheckCircle2
                            size={12}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-white text-emerald-500 dark:bg-slate-900"
                          />
                        )}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {activeMeta.label} API Key
                </label>
                <input
                  type="password"
                  value={activeApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={activeMeta.keyHint}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <a
                  href={activeMeta.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <Info size={12} /> 前往取得 API Key
                </a>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">模型</label>
                <div className="relative">
                  <select
                    value={activeModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {MODEL_OPTIONS[activeProvider].map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}（{m.tier}）
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  快速：回應更即時、成本較低；基礎：推理品質較佳，適合較複雜的問題。
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="mt-4 mb-1.5 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <SlidersHorizontal size={12} /> 搜尋段落數（Top-K）
                  </label>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{ragDraft.topK}</span>
                </div>
                <input
                  type="range"
                  min={RAG_TOP_K_BOUNDS.min}
                  max={RAG_TOP_K_BOUNDS.max}
                  step={1}
                  value={ragDraft.topK}
                  onChange={(e) => setRagDraft((d) => ({ ...d, topK: Number(e.target.value) }))}
                  className="slider-fancy w-full"
                  style={
                    {
                      '--slider-percent': `${((ragDraft.topK - RAG_TOP_K_BOUNDS.min) / (RAG_TOP_K_BOUNDS.max - RAG_TOP_K_BOUNDS.min)) * 100}%`,
                    } as CSSProperties
                  }
                />
                <div className="relative h-3">
                  <div
                    className="absolute top-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                    style={{
                      left: `${((RECOMMENDED_TOP_K - RAG_TOP_K_BOUNDS.min) / (RAG_TOP_K_BOUNDS.max - RAG_TOP_K_BOUNDS.min)) * 100}%`,
                    }}
                  >
                    <div className="w-0.5 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  <span>{RAG_TOP_K_BOUNDS.min}（較少）</span>
                  <span>建議值 {RECOMMENDED_TOP_K}</span>
                  <span>{RAG_TOP_K_BOUNDS.max}（較多）</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  每次提問時，向量搜尋會取出最相關的 N 段內容交給 AI 作答。
                </p>

                <AnimatePresence>
                  {warning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>{warning}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Wand2 size={12} /> 查詢改寫
                  </label>
                  <Switch checked={ragDraft.queryRewrite} onChange={(v) => setRagDraft((d) => ({ ...d, queryRewrite: v }))} />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  提問時先讓 AI 把問題改寫成更貼近文件用詞的查詢句再去搜尋（仍會針對您原本的問題作答，只影響搜尋這一步），可提升口語化問法的命中率，但每次提問會多一次輕量 AI
                  呼叫，略增花費與等待時間。全文模式開啟時不會用到此設定。
                </p>
              </div>

              <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                三家供應商的 API Key 會分別儲存在瀏覽器本機（localStorage），切換供應商不會互相覆蓋、也不需要重新輸入。所有 Key
                皆不會傳送至任何第三方伺服器，僅在您提問時直接呼叫所選供應商的官方 API。若使用 Anthropic，部分帳戶可能因瀏覽器
                CORS 限制而無法直接呼叫，建議優先使用 Gemini 或 OpenAI。
              </p>
            </div>

            <button
              onClick={handleSave}
              className="mt-6 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              儲存設定
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
