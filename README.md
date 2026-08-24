# DocMind Q&A（純前端・向量檢索版）

智慧指引文件問答與手冊瀏覽系統。**完全前端（無後端伺服器）**，文件解析、向量嵌入與語意搜尋皆在瀏覽器本機完成，AI 問答則直接呼叫您自備的
Gemini／OpenAI／Anthropic API Key，可直接部署於 **GitHub Pages** 這類純靜態託管服務。

## 功能
- **語意向量搜尋（RAG）**：不需手動勾選文件。系統會在首次載入時，使用 Hugging Face 的
  [`Xenova/paraphrase-multilingual-MiniLM-L12-v2`](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2)
  多語言嵌入模型（透過 `@huggingface/transformers`，在瀏覽器內以 WASM/ONNX Runtime 執行），將指引文件切割成段落並轉換為向量，儲存於瀏覽器的
  **IndexedDB** 本機資料庫。之後每次提問，系統會將問題轉為向量、計算與所有段落的餘弦相似度，取出最相關的段落作為 AI
  回答的依據，並提供精確引用出處。
- 支援 Word（.docx）、PDF、Markdown（.md）、純文字（.txt）指引文件，解析與切段皆在瀏覽器端完成。
- **支援 Word 文件中的圖片／流程圖**：`.docx` 內嵌的圖片（如判斷流程圖）會連同它下方的圖表編號說明（例如「圖3-1 ...」「表2 ...」）一起被索引；若某次提問語意上命中這類段落，會把圖片本體一併附給支援視覺辨識的 AI（Gemini／OpenAI／Anthropic 皆支援），讓 AI 直接讀圖作答，而不只是讀圖說文字。建立索引過程本身不需要呼叫 AI、不需要圖片辨識，維持純本機、免 API Key 的特性。
- 指引文件模式：以資料夾／檔案卡片瀏覽結構化的手冊內容，並可直接檢視 Markdown／文字內容。
- 對話歷史紀錄（存於瀏覽器 localStorage）、深色／淺色主題切換、每日安全使用提示（以 Asia/Taipei 時區判斷）。
- 響應式介面：桌面雙欄佈局／手機單欄 + 底部輸入列。
- AI 供應商與模型皆可下拉選擇：Google Gemini、OpenAI、Anthropic Claude，各自提供「快速」與「基礎」兩種目前公開的模型層級。
  API Key 僅存於您瀏覽器的 localStorage，不會經過任何第三方伺服器。

## 本機開發

```bash
npm install
npm run dev
```

## 放置指引文件

將要納入問答與向量索引的文件放入：

```
public/guidance_docs/                      # 指引文件（.docx / .pdf / .md / .txt），會自動切段並建立向量索引
public/manual_md/<章節資料夾>/<章節>.md      # 手冊章節（可含同資料夾內的圖片），供「指引文件」模式瀏覽，同時也會併入向量索引
```

接著執行（`npm run dev` 與 `npm run build` 都會自動執行這一步）：

```bash
npm run manifest
```

此指令會掃描上述資料夾並產生 `public/manifest.json`，前端會在啟動時讀取它、載入文件內容，並自動建立向量索引。
專案已內附一份範例指引文件與一個範例手冊章節，可直接刪除或替換。

> 系統不再提供使用者上傳文件的介面；所有可供問答的內容皆須在建置前放入 `guidance_docs` / `manual_md`
> 並重新部署。文件內容變動後，系統會自動偵測（以檔名＋內容長度計算指紋）並重新建立索引；也可在左上角「功能選單」中手動點選「重建向量索引」。

## 部署到 GitHub Pages

### 方式一：GitHub Actions（推薦，已內附設定檔）

1. 將本專案推送到您的 GitHub repository。
2. 到 repo 的 **Settings → Pages**，「Source」選擇 **GitHub Actions**。
3. 推送到 `main` 分支即會自動觸發 `.github/workflows/deploy.yml`，建置並部署到
   `https://<your-username>.github.io/<repo-name>/`。
   - 此 workflow 會自動將 `VITE_BASE_PATH` 設為 `/<repo-name>/`。
   - 若您是部署到使用者根網站（repo 名稱為 `<username>.github.io`），請將 workflow 中的
     `VITE_BASE_PATH` 改為 `/`，並同步修改 `vite.config.ts` 的預設值。

### 方式二：手動建置後推送 `dist/`

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build
# 將 dist/ 內容推送到 gh-pages 分支，或於 Settings → Pages 指定 dist 為發布來源
```

## 使用者如何設定 API Key 與模型

1. 開啟網站後，點左上角「功能選單」→「AI 供應商設定」。
2. 選擇 AI 供應商（Gemini / OpenAI / Anthropic），貼上您自己的 API Key。
   - Gemini：https://aistudio.google.com/apikey
   - OpenAI：https://platform.openai.com/api-keys
   - Anthropic：https://console.anthropic.com/settings/keys
3. 從下拉選單選擇模型層級：「快速」（回應更即時、成本較低）或「基礎」（推理品質較佳）。
4. 儲存後即可在「指引問答」頁面提問，系統會自動搜尋最相關的指引文件段落作答。

> **注意**：Anthropic 的 Messages API 是否允許瀏覽器直接呼叫（CORS）依帳戶與網域設定而異，
> 若呼叫失敗，建議優先使用 Gemini 或 OpenAI，皆已在瀏覽器環境測試可正常運作。
>
> 嵌入模型（約 100+ MB）僅在首次使用時下載並由瀏覽器快取，之後開啟網站會直接使用快取，不需重新下載。

## 專案結構

```
src/
  components/        # UI 元件（滑出選單、回答/引用、設定、手冊瀏覽、索引狀態…）
  services/
    docParser.ts       # 瀏覽器端 docx/pdf/md/txt 解析（僅供讀取 public/ 內建文件）
    chunking.ts          # 文件切段
    embeddingService.ts    # 呼叫 Hugging Face 模型計算向量（@huggingface/transformers）
    vectorStore.ts           # IndexedDB 向量儲存
    ragPipeline.ts             # 索引建立/偵測變更 + 語意搜尋（cosine similarity）
    aiService.ts                 # 依搜尋結果組裝 context，呼叫所選 AI 供應商並解析 JSON citation
    models.ts                      # 各供應商「快速/基礎」模型清單
    manifest.ts                      # 讀取 public/manifest.json
    storage.ts                         # localStorage 存取（設定/歷史/主題/提示日期）
  types.ts
  App.tsx
scripts/
  generate-manifest.mjs   # 建置前掃描 public/ 內建文件並產生 manifest.json
public/
  guidance_docs/、manual_md/   # 指引文件（選用，用於向量索引與手冊瀏覽）
```

## 資料隱私說明

文件解析、切段與向量嵌入皆於使用者瀏覽器本機完成（向量儲存於 IndexedDB，圖片以 base64 形式一併儲存），不會上傳到任何伺服器。提問時，只有語意搜尋到的相關段落與提問內容（若段落為圖片／流程圖，則含該圖片本身），
會直接傳送至使用者自行設定之 AI 供應商官方 API（並附帶使用者自己的 API Key），本專案本身不經手、不儲存任何內容。
