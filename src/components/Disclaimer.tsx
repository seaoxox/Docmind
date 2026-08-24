import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onAccept: () => void;
}

export function Disclaimer({ open, onAccept }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 lg:p-12 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-4 tracking-tight">安全使用提示</h2>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-[0.3em] mb-8">
                Security & Disclaimer Notice
              </p>

              <div className="space-y-6 text-slate-600 dark:text-slate-400 text-sm leading-relaxed text-left w-full">
                <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 rounded-2xl">
                  <p className="font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    請勿輸入個人敏感資訊
                  </p>
                  <p className="text-xs">為保障隱私安全，對話時請勿提供姓名、身分證字號、聯絡方式或任何具辨識性之個資。</p>
                </div>

                <div className="px-2 space-y-3">
                  <p className="flex gap-3">
                    <span className="text-indigo-500 font-bold">01.</span>
                    <span>本系統生成之內容僅供參考，不具法律效用或公務正式指令地位。</span>
                  </p>
                  <p className="flex gap-3">
                    <span className="text-indigo-500 font-bold">02.</span>
                    <span>如涉及正式決策，請務必核對與參考原始公文或指引文件。</span>
                  </p>
                  <p className="flex gap-3">
                    <span className="text-indigo-500 font-bold">03.</span>
                    <span>
                      本系統為純前端應用：文件解析與向量嵌入皆在您的瀏覽器本機完成（使用 Hugging Face 模型），並儲存於本機
                      IndexedDB。僅有搜尋到的相關段落（若段落為文件中的圖片／流程圖，則含該圖片本身）與您的提問，會傳送至您自行設定的
                      AI 供應商（Gemini／OpenAI／Anthropic）API，不會經過本站伺服器。
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={onAccept}
                className="w-full mt-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-none hover:bg-black dark:hover:bg-slate-100"
              >
                理解並同意
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
