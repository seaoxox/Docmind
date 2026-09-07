# DocMind Q&A（純前端・向量檢索版）

智慧指引文件問答與手冊瀏覽系統。**完全前端（無後端伺服器）**，文件解析、向量嵌入與語意搜尋皆在瀏覽器本機完成，AI 問答則直接呼叫您自備的
Gemini／OpenAI／Anthropic API Key，可直接部署於 **GitHub Pages** 這類純靜態託管服務。

## 功能
- **語意向量搜尋（RAG）**：不需手動勾選文件。系統會在首次載入時，使用 Hugging Face 的
  [`Xenova/paraphrase-multilingual-MiniLM-L12-v2`](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2)
  多語言嵌入模型（透過 `@huggingface/transformers`，在瀏覽器內以 WASM/ONNX Runtime 執行），將指引文件切割成段落並轉換為向量，儲存於瀏覽器的
  **IndexedDB** 本機資料庫。之後每次提問，系統會將問題轉為向量、計算與所有段落的餘弦相似度，取出最相關的段落作為 AI
  回答的依據，並提供精確引用出處。
- **Parent-Child（小切片檢索、大區塊生成）**：切段採兩層結構——約 350 字的「子區塊」專門用來做向量比對，力求精準命中；約 2000
  字的「父區塊」（同一父區塊不會跨越文件章節邊界）則是命中後實際送給 AI 的內容。搜尋時比對的是子區塊，但回傳給 AI 的是它所屬的完整父區塊，兼顧比對精準度與回答時的上下文完整性，避免因切段太小而斷章取義。
- 支援 Word（.docx）、PDF、Markdown（.md）、純文字（.txt）指引文件，解析與切段皆在瀏覽器端完成。
- **支援 Word 文件中的圖片／流程圖**：`.docx` 內嵌的圖片（如判斷流程圖）會連同它下方的圖表編號說明（例如「圖3-1 ...」「表2 ...」）一起被索引；若某次提問語意上命中這類段落，會把圖片本體一併附給支援視覺辨識的 AI（Gemini／OpenAI／Anthropic 皆支援），讓 AI 直接讀圖作答，而不只是讀圖說文字。建立索引過程本身不需要呼叫 AI、不需要圖片辨識，維持純本機、免 API Key 的特性。
- **全文模式（Full-Text Mode）**：向量檢索是「篩選式」的，遇到問法太抽象、或關鍵內容藏在冷門角落時，有可能篩選失準、答非所問。提問輸入框上方有「全文模式」開關，開啟後會跳過向量篩選，把當下所有已載入的指引文件（含圖片）完整送給 AI，保證不遺漏任何內容，但 token 用量與費用會明顯提高，畫面會即時顯示預估花費供你評估後再送出。若選用 Gemini 且預估超過其免費方案單次請求上限（約 250,000 tokens），會額外顯示提醒。
- **查詢改寫（Query Rewriting）**：可於「AI 供應商設定」中開啟。開啟後，提問時會先用一次輕量 AI 呼叫，把問題改寫成更貼近文件正式用詞的查詢句（例如把口語問法補上文件常用的專有名詞），再拿改寫後的查詢去做向量搜尋，藉此提升口語化問法的命中率；搜尋時仍會同時比對「原問題」與「改寫後問題」兩者，因此改寫效果不佳時也不會比不開啟更差。實際作答仍然針對你原本的問題，只有搜尋這一步用了改寫後的查詢，回答下方會標示這次搜尋實際用了什麼改寫查詢。
- 指引文件模式：以「指引分類」（例如「結核病指引」）卡片瀏覽指引文件，點進分類後列出該分類底下的檔案，可直接檢視內容。分類方式由
  `public/guidance_categories.json` 這份對照表定義。
- **問答依單一分類搜尋**：QA 畫面上方有分類下拉選單，每次提問都會鎖定在**單一指引分類**的文件範圍內搜尋（含全文模式），沒有「搜尋全部文件」的選項——避免文件量大時，搜尋結果實際涵蓋範圍不明確的問題。系統載入後會自動選取第一個分類，之後可隨時切換。
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
public/guidance_docs/    # 指引文件（.docx / .pdf / .md / .txt），會自動切段並建立向量索引
```

接著執行（`npm run dev` 與 `npm run build` 都會自動執行這一步）：

```bash
npm run manifest
```

此指令會掃描 `guidance_docs` 資料夾並產生 `public/manifest.json`，前端會在啟動時讀取它、載入文件內容，並自動建立向量索引。
專案已內附一份範例指引文件，可直接刪除或替換。

> 系統不再提供使用者上傳文件的介面；所有可供問答的內容皆須在建置前放入 `guidance_docs`
> 並重新部署。文件內容變動後，系統會自動偵測（以檔名＋建置時的位元組大小計算指紋）並重新建立索引；也可在左上角「功能選單」中手動點選「重建向量索引」。

## 指引分類（guidance_categories.json）

「指引文件」頁面與問答時的分類篩選，都是依 `public/guidance_categories.json` 這份**手動維護**的對照表運作——它不會被
`npm run manifest` 自動產生，因為要把哪些檔案歸為哪個分類是人工判斷，不是單純掃描檔案系統能決定的。格式：

```json
{
  "categories": [
    {
      "id": "tb-guidelines",
      "name": "結核病指引",
      "description": "結核病診治與防治相關指引文件",
      "files": ["結核病診治指引第七版(全冊).docx", "TB工作手冊全文.docx"]
    }
  ]
}
```

- `id`：分類的唯一識別碼（英數、不重複即可）
- `name`：畫面上顯示的分類名稱
- `description`：選填，顯示在分類頁面標題下方
- `files`：這個分類包含哪些 `guidance_docs` 底下的檔名（須與實際檔名完全一致）

如果 `guidance_docs` 裡有檔案沒被列在任何分類的 `files` 裡，「指引文件」頁面與分類下拉選單都會自動多出一個「未分類文件」分類，列出這些漏網的檔案，方便你發現並補上分類設定。

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
  components/        # UI 元件（滑出選單、回答/引用、設定、指引分類瀏覽、索引狀態…）
  services/
    docParser.ts       # 瀏覽器端 docx/pdf/md/txt 解析（僅供讀取 public/ 內建文件）
    chunking.ts          # 文件切段（Parent-Child 兩層結構）
    embeddingService.ts    # 呼叫 Hugging Face 模型計算向量（@huggingface/transformers）
    vectorStore.ts           # IndexedDB 向量儲存（children + parents 兩個資料表）
    ragPipeline.ts             # 索引建立/偵測變更 + 語意搜尋（cosine similarity，支援分類篩選）
    queryRewrite.ts               # 查詢改寫
    categories.ts                   # 讀取 guidance_categories.json、解析分類/未分類文件
    aiService.ts                      # 依搜尋結果組裝 context，呼叫所選 AI 供應商並解析 JSON citation
    models.ts                           # 各供應商「快速/基礎」模型清單
    manifest.ts                           # 讀取 public/manifest.json
    storage.ts                              # localStorage 存取（設定/歷史/主題/提示日期）
  types.ts
  App.tsx
scripts/
  generate-manifest.mjs   # 建置前掃描 public/guidance_docs 並產生 manifest.json
public/
  guidance_docs/            # 指引文件（選用，用於向量索引與「指引文件」分類瀏覽）
  guidance_categories.json  # 指引分類對照表（手動維護，選用）
```

## 資料隱私說明

文件解析、切段與向量嵌入皆於使用者瀏覽器本機完成（向量儲存於 IndexedDB，圖片以 base64 形式一併儲存），不會上傳到任何伺服器。提問時，只有語意搜尋到的相關段落與提問內容（若段落為圖片／流程圖，則含該圖片本身），
會直接傳送至使用者自行設定之 AI 供應商官方 API（並附帶使用者自己的 API Key），本專案本身不經手、不儲存任何內容。
