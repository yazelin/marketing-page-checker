# 行銷頁健檢器 — 設計文件

日期:2026-06-10
狀態:待 user 審閱

## 一、這是什麼 / 給誰

一個公開網站:行銷人貼上自己活動頁的網址,自動檢查並評分「這頁做得好不好」,給總分 + 各類別分數 + 一份照優先序排的白話修法清單(每項附可複製貼給 AI 的修正 prompt)。概念對標 isitagentready.com,但**面向不會寫程式的行銷人、檢查的是行銷頁該在乎的事**(分享卡、被找到、轉換、速度、體質、追蹤),而不是 agentic 服務基礎建設。

定位:**獨立公開工具 + 導流到課程**。自己一個 repo 與網址,結尾 CTA 連到「AI 互動行銷頁實作課」。當免費引流工具(免費檢查 → 想學怎麼修 → 來上課)。健檢器本身也是課程「Pages 前端 + Worker 後端」架構的終極範例。

## 二、架構(方案 A:瘦前端 + 聰明 Worker)

```
使用者貼網址 → 前端(GitHub Pages)→ POST 給 Worker
                                      ↓
        Worker 抓目標 HTML → HTMLRewriter 解析 → 跑 6 類檢查
                          → 對圖片發 HEAD 抓大小 → 算分 → 回 JSON
                                      ↓
        前端把 JSON 畫成:總分圓環 + 6 類橫條 + 逐項修法 + 課程 CTA
```

檢查邏輯**全部在 Worker**(圖片大小、跨來源抓取本來就只能在伺服器做;集中於此最自然、好測、好擴充)。前端只負責輸入與渲染結果,不含檢查邏輯。

### Repo 結構

```
marketing-page-checker/
  index.html              前端:輸入框 + 結果頁(單檔內嵌 CSS/JS,沿用課程深色品牌風)
  assets/og.jpg           工具自己的 OG 分享圖
  .nojekyll
  README.md               用途、線上網址、Worker 部署說明
  worker/
    worker.js             入口:驗網址 → 抓 HTML → 呼叫 checks → 算分 → 回 JSON(含 CORS、限流)
    checks.js             6 類檢查函式(純函式,輸入解析後的頁面資料,輸出 check 結果陣列)
    wrangler.toml
  docs/
    superpowers/specs/    本設計文件
    checks.md             每個檢查項的定義、判定標準、修法與 prompt 文案(單一事實來源)
```

## 三、檢查項定義(6 類;類別權重見第五節)

每項輸出 `status`:`pass`(滿分)/ `warn`(半分)/ `fail`(0)。每類的權重分數由該類各項均分。

### 分享卡 OG(權重 20)
- `og-title` — 有 `og:title` 且非空
- `og-desc` — 有 `og:description` 且非空
- `og-image` — 有 `og:image`
- `og-image-format` — `og:image` 是 jpg/png(svg → warn,平台分享多半不顯示)
- `og-image-abs` — `og:image` 是完整 `https://` 網址(相對路徑 → fail)
- `twitter-card` — 有 `twitter:card`

### 被找到 SEO/AEO(權重 20)
- `title` — 有 `<title>` 且非空、長度合理(過長 → warn)
- `meta-desc` — 有 `meta name="description"` 且非空
- `h1` — 有主要 `<h1>`(沒有 → fail;多個 → warn)
- `canonical` — 有 `rel="canonical"`
- `jsonld` — 有 `application/ld+json` 結構化資料
- `lang` — `<html lang>` 有設

### 轉換 CTA(權重 20)
- `cta-present` — 偵測到明確行動呼籲:`<button>` 或含「報名 / 立即 / 購買 / 加入 / 領取 / 預約 / 聯絡 / 諮詢 / 下單」等字眼的顯眼連結/按鈕(完全沒有 → fail)
- `contact-method` — 有聯絡/轉換管道:表單 `<form>`、`mailto:`、`tel:`、LINE(`line.me` / `lin.ee`)連結之一

### 圖片體積/速度(權重 15)
- `img-oversized` — 沒有單張 > 500KB 的圖(有則 fail 並列出是哪幾張、各多大)
- `html-size` — HTML 體積合理(> 150KB → warn)
- `asset-count` — 圖片 + script 數量不過多(> 50 → warn)

### 基本體質(權重 15)
- `https` — 用 https
- `viewport` — 有 `viewport` meta(手機 RWD 的最低訊號)
- `favicon` — 有 favicon(`rel="icon"` 或預設 /favicon.ico 200)
- `placeholder-links` — 沒有殘留 `href="#"` 或 `example.com` 假連結(有則 fail 並列出幾個)
- `charset` — 有 `charset` 宣告

### 追蹤(權重 10)
- `analytics` — 偵測到網站分析(gtag / Google Analytics / Plausible / Umami / Clarity 等)
- `pixel` — 偵測到廣告 pixel(Meta `fbq` / TikTok / Google Ads);沒有 → warn(非必須,但投廣告要用)

## 四、JSON 輸出格式

```json
{
  "url": "https://example.com/event",
  "fetchedAt": "2026-06-10 12:00:00 UTC",
  "score": 72,
  "grade": "及格",
  "categories": [
    {
      "key": "og", "name": "分享卡", "score": 15, "max": 20,
      "checks": [
        { "id": "og-image-format", "label": "OG 圖用 jpg/png", "status": "warn",
          "detail": "你的 og:image 是 .svg,FB/LINE 分享多半不顯示",
          "fix": "改用 1200x630 的 jpg 或 png 當分享圖",
          "prompt": "把我頁面的 og:image 換成一張 1200x630 的 jpg…" }
      ]
    }
  ],
  "topFixes": [
    { "id": "cta-present", "label": "缺明確行動呼籲", "why": "訪客不知道下一步要做什麼",
      "fix": "在 hero 加一顆『立即報名』按鈕", "prompt": "…" }
  ]
}
```

`topFixes` = 把所有 fail/warn 依「影響 × 易修」排序,取前 5–8 條,讓行銷人知道**先修哪幾個**。

## 五、評分模型

- 總分 = 各類別得分加總,類別權重:分享卡 20 / SEO·AEO 20 / 轉換 CTA 20 / 圖片速度 15 / 基本體質 15 / 追蹤 10 = 100。
- 類別內各項均分;`pass` 滿分、`warn` 半分、`fail` 0。
- 等第:0–49 **待加強**(紅)/ 50–79 **及格**(黃)/ 80–100 **優秀**(綠)。

## 六、前端結果頁

沿用課程深色品牌風(墨綠/奶油/銅)。流程:
1. Hero:一句說明 + 網址輸入框 + 「免費健檢」按鈕
2. 掃描中狀態(轉圈 + 「正在抓取並分析你的頁面…」)
3. 結果:總分大圓環 + 等第色 → 6 類別橫條(各自分數)→ 每項可展開看 `detail` / `fix` / 「複製 AI prompt」鈕
4. 最上方放 `topFixes`「先修這幾個」
5. 底部 CTA:「想學會自己做出高分行銷頁?→ AI 互動行銷頁實作課」連到課程站
6. 結果頁支援 `?url=` 帶網址(可分享重跑);自己也有完整 OG / SEO(吃自己的狗糧)

## 七、錯誤處理與防濫用

- 非 http(s) / 格式錯 → 「這看起來不是有效網址」
- 目標 404 / 逾時(設 10s)/ 連不上 → 「這個網址打不開或回應太慢」
- 非 HTML(PDF/圖)→ 「這不是一個網頁」
- 目標 HTML 過大(> 3MB)→ 截斷分析並提示
- 對方擋自動抓取(403 / robots)→ 誠實說「對方擋了自動抓取,無法檢查」
- Worker 每 IP 每分鐘限流(預設 10 次)防濫用
- Worker 回應加 CORS 讓前端讀
- 圖片 HEAD 請求:並行上限(如 20 張)、各自逾時,避免拖垮

## 八、測試策略

- **單元**:`checks.js` 每個檢查函式餵假頁面資料 → 斷言預期 status(pass/warn/fail 各一例)
- **e2e**:部署後用三個真網址驗證 — 我們的課程 demo(該高分)、一個故意爛的測試頁(該低分)、課程站本身;確認分數與 topFixes 合理
- **像素級**:前端結果頁用 headless 截圖確認排版、圓環/橫條正確、console 無錯

## 九、v2(本次不做,預留接口)

HTMLRewriter 那層之後可加 Cloudflare Browser Rendering(headless),解鎖需要渲染才能判的項:視覺 RWD 跑版、真實載入速度 / Core Web Vitals、點擊區大小。介面與 JSON 格式不變,只是多幾個 check。

## 十、明確不做(YAGNI)

- 不做使用者帳號 / 歷史紀錄 / 排行榜(v1 是一次性檢查)
- 不做 PDF 報告匯出(結果頁 + 分享網址夠用)
- 不做付費 / 額度系統(免費引流工具)
- 不爬整站(只檢查貼進來的那一頁)
- v1 不做需渲染的項目(留 v2)
