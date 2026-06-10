# 行銷頁健檢器 Marketing Page Checker

貼上活動頁網址,30 秒看你的行銷頁做得好不好——檢查分享卡(OG)、SEO/被 AI 找到、轉換 CTA、圖片速度、基本體質、追蹤,給分數 + 白話修法(每項附可複製給 AI 的修正 prompt)。

> 線上工具:https://yazelin.github.io/marketing-page-checker/ (上線後生效)
> 學會自己做出高分行銷頁:[AI 互動行銷頁實作課](https://yazelin.github.io/ai-marketing-pages-course/)

## 架構

- **前端** `index.html`(GitHub Pages):輸入網址 → 呼叫 Worker → 畫成分數卡。
- **後端** `worker/`(Cloudflare Worker):抓目標 HTML → HTMLRewriter 解析 → 6 類純函式檢查 → 圖片 HEAD 抓大小 → 加權算分 → 回 JSON。含 CORS、每 IP 限流、SSRF 護欄(擋內網/loopback)。
- 已部署 Worker:`https://marketing-page-checker.yazelinj303.workers.dev`

## 開發

```bash
cd worker
npm install
npm test            # 純函式檢查的單元測試(vitest)
npx wrangler deploy # 部署 Worker
```

檢查邏輯在 `worker/checks.js`(純函式,吃 PageData 回結果,可 node 端測試);解析層 `worker/parse.js`(HTMLRewriter,runtime);入口 `worker/worker.js`。設計與計劃在 `docs/superpowers/`。

SANWU / 課程相關為教學用途。
