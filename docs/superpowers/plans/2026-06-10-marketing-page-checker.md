# 行銷頁健檢器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一個公開網站,行銷人貼網址即自動檢查活動頁品質、給分數與白話修法清單,並導流到課程。

**Architecture:** GitHub Pages 靜態前端 + 單一 Cloudflare Worker 後端。Worker 抓目標 HTML → 用 HTMLRewriter 解析成 `PageData` → 跑 6 類純函式檢查 → 對圖片發 HEAD 抓大小 → 加權算分 → 回 JSON。檢查邏輯是純函式(吃 `PageData` 回結果),與 runtime 解析層分離,便於 node 端 TDD。

**Tech Stack:** Cloudflare Workers (HTMLRewriter)、wrangler、vitest(node 端跑純函式測試)、純 HTML/CSS/JS 前端。

---

## PageData 介面(解析層 → 檢查層的契約;所有檢查函式吃這個)

```js
// 由 parse.js 產生;checks.js 只讀這個物件
const PageData = {
  finalUrl: "https://...",      // 跟隨轉址後的最終網址
  https: true,                   // finalUrl 是否 https
  status: 200,                   // 目標回應碼
  contentType: "text/html; charset=utf-8",
  htmlBytes: 24500,              // HTML 原始大小
  title: "...",                  // <title> 內容(無則 "")
  metaDescription: "...",        // meta name=description(無則 "")
  lang: "zh-Hant",               // <html lang>(無則 "")
  charset: "utf-8",              // charset 宣告(無則 "")
  canonical: "https://...",      // rel=canonical(無則 "")
  og: { title:"", description:"", image:"" },  // og:* (無則 "")
  twitterCard: "",               // twitter:card(無則 "")
  h1Count: 1,
  hasJsonLd: true,               // 有 application/ld+json
  hasViewport: true,             // 有 viewport meta
  hasFavicon: true,              // rel=icon 或 /favicon.ico 200
  buttons: ["立即報名"],         // <button> 文字陣列
  links: [{href:"https://..", text:"報名"}],   // <a> 陣列
  forms: 1,                      // <form> 數
  hasMailto: false, hasTel: false, hasLine: false,
  images: [{src:"https://..", bytes:820000}],  // bytes 由 HEAD 填(失敗則 null)
  scriptCount: 8,
  scriptSrcs: ["https://.."],    // 外部 script src(供偵測追蹤)
  inlineScript: "...",           // inline script 串接(供偵測 gtag/fbq)
};
```

`mk()` 共用建構子(checks.js 內),每個檢查回傳此形狀:
```js
function mk(id, label, status, detail, fix, prompt) {
  return { id, label, status, detail, fix, prompt }; // status: "pass"|"warn"|"fail"
}
```

---

## Task 0: scaffold worker 專案 + vitest

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/vitest.config.js`, `worker/checks.js`(空殼), `worker/tests/smoke.test.js`

- [ ] **Step 1: 建 package.json**

```json
{
  "name": "marketing-page-checker-worker",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run", "dev": "wrangler dev", "deploy": "wrangler deploy" },
  "devDependencies": { "vitest": "^2.0.0", "wrangler": "^3.80.0" }
}
```

- [ ] **Step 2: 建 wrangler.toml**

```toml
name = "marketing-page-checker"
main = "worker.js"
compatibility_date = "2026-06-01"
```

- [ ] **Step 3: 建 vitest.config.js**

```js
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.js"] } });
```

- [ ] **Step 4: 建空 checks.js + smoke test**

`worker/checks.js`:
```js
export function mk(id, label, status, detail, fix, prompt) {
  return { id, label, status, detail, fix, prompt };
}
```
`worker/tests/smoke.test.js`:
```js
import { expect, test } from "vitest";
import { mk } from "../checks.js";
test("mk builds a check result", () => {
  expect(mk("a","b","pass","d","f","p")).toEqual({id:"a",label:"b",status:"pass",detail:"d",fix:"f",prompt:"p"});
});
```

- [ ] **Step 5: 安裝 + 跑測試**

Run: `cd worker && npm install && npm test`
Expected: 1 passed

- [ ] **Step 6: Commit**

```bash
git add worker/ && git commit -m "chore: scaffold worker project + vitest"
```

---

## Task 1: 分享卡 OG 檢查(TDD,當作後續類別的範本)

**Files:**
- Modify: `worker/checks.js`
- Test: `worker/tests/og.test.js`

- [ ] **Step 1: 寫失敗測試**

`worker/tests/og.test.js`:
```js
import { expect, test } from "vitest";
import { checkOG } from "../checks.js";

const base = { og:{title:"開幕週",description:"買一送一",image:"https://x.com/og.jpg"}, twitterCard:"summary_large_image" };
const byId = (arr,id) => arr.find(c => c.id===id);

test("全齊 → 全 pass", () => {
  const r = checkOG(base);
  expect(byId(r,"og-title").status).toBe("pass");
  expect(byId(r,"og-image-format").status).toBe("pass");
  expect(byId(r,"og-image-abs").status).toBe("pass");
  expect(byId(r,"twitter-card").status).toBe("pass");
});
test("og:image 是 svg → warn", () => {
  const r = checkOG({...base, og:{...base.og, image:"https://x.com/banner.svg"}});
  expect(byId(r,"og-image-format").status).toBe("warn");
});
test("og:image 相對路徑 → fail", () => {
  const r = checkOG({...base, og:{...base.og, image:"/assets/og.jpg"}});
  expect(byId(r,"og-image-abs").status).toBe("fail");
});
test("缺 og:title → fail", () => {
  const r = checkOG({...base, og:{...base.og, title:""}});
  expect(byId(r,"og-title").status).toBe("fail");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/og.test.js`
Expected: FAIL（checkOG is not a function）

- [ ] **Step 3: 實作 checkOG**

加到 `worker/checks.js`:
```js
export function checkOG(p) {
  const og = p.og || {};
  const isAbs = (u) => /^https:\/\//i.test(u || "");
  const isSvg = (u) => /\.svg(\?|$)/i.test(u || "");
  return [
    mk("og-title", "分享標題 og:title", og.title ? "pass" : "fail",
      og.title ? `有:「${og.title}」` : "沒有 og:title,分享到 LINE/FB 標題會空白",
      "在 <head> 加 <meta property=\"og:title\" content=\"你的活動標題\">",
      "幫我頁面加上 og:title meta,內容是活動標題"),
    mk("og-desc", "分享描述 og:description", og.description ? "pass" : "fail",
      og.description ? `有:「${og.description}」` : "沒有 og:description",
      "加 <meta property=\"og:description\" content=\"一句吸引點擊的說明\">",
      "幫我加 og:description meta,寫一句吸引點擊的活動說明"),
    mk("og-image", "分享圖 og:image", og.image ? "pass" : "fail",
      og.image ? `有:${og.image}` : "沒有 og:image,分享出去沒有預覽圖",
      "做一張 1200x630 的圖,加 <meta property=\"og:image\" content=\"完整網址\">",
      "幫我加 og:image meta,指向一張 1200x630 的分享圖完整網址"),
    mk("og-image-format", "分享圖用 jpg/png", !og.image ? "fail" : isSvg(og.image) ? "warn" : "pass",
      isSvg(og.image) ? "og:image 是 svg,FB/LINE 分享多半不顯示" : "格式 OK",
      "把分享圖換成 jpg 或 png(svg 平台支援差)",
      "把我的 og:image 從 svg 換成 1200x630 的 jpg"),
    mk("og-image-abs", "分享圖用完整網址", !og.image ? "fail" : isAbs(og.image) ? "pass" : "fail",
      isAbs(og.image) ? "是完整 https 網址" : "og:image 是相對路徑,爬蟲抓不到",
      "og:image 要寫完整 https:// 網址,不能用相對路徑",
      "把我的 og:image 改成完整 https 網址"),
    mk("twitter-card", "Twitter 卡片", p.twitterCard ? "pass" : "warn",
      p.twitterCard ? `有:${p.twitterCard}` : "沒有 twitter:card(X 分享會用陽春樣式)",
      "加 <meta name=\"twitter:card\" content=\"summary_large_image\">",
      "幫我加 twitter:card 設為 summary_large_image"),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/og.test.js`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/og.test.js
git commit -m "feat(checks): 分享卡 OG 檢查"
```

---

## Task 2: SEO/AEO 檢查(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/seo.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { checkSEO } from "../checks.js";
const byId = (a,id)=>a.find(c=>c.id===id);
const good = { title:"山霧咖啡 開幕週", metaDescription:"買一送一", h1Count:1, canonical:"https://x.com/", hasJsonLd:true, lang:"zh-Hant" };
test("全齊 → pass", () => {
  const r = checkSEO(good);
  ["title","meta-desc","h1","canonical","jsonld","lang"].forEach(id => expect(byId(r,id).status).toBe("pass"));
});
test("無 h1 → fail;多 h1 → warn", () => {
  expect(byId(checkSEO({...good,h1Count:0}),"h1").status).toBe("fail");
  expect(byId(checkSEO({...good,h1Count:3}),"h1").status).toBe("warn");
});
test("title 過長 → warn", () => {
  expect(byId(checkSEO({...good,title:"超".repeat(40)}),"title").status).toBe("warn");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/seo.test.js`
Expected: FAIL（checkSEO is not a function）

- [ ] **Step 3: 實作 checkSEO**

```js
export function checkSEO(p) {
  const titleLen = (p.title || "").length;
  return [
    mk("title", "網頁標題 title", !p.title ? "fail" : titleLen > 60 ? "warn" : "pass",
      !p.title ? "沒有 <title>" : titleLen > 60 ? `標題 ${titleLen} 字偏長,搜尋結果會被截斷` : `有:「${p.title}」`,
      "每頁設一個含關鍵字+品牌的 <title>,約 30 字內",
      "幫我頁面寫一個含活動關鍵字與品牌、30 字內的 title"),
    mk("meta-desc", "搜尋摘要 description", p.metaDescription ? "pass" : "fail",
      p.metaDescription ? `有:「${p.metaDescription}」` : "沒有 meta description,搜尋結果摘要會亂抓",
      "加 <meta name=\"description\" content=\"一兩句讓人想點的摘要\">",
      "幫我加 meta description,寫一兩句吸引點擊的活動摘要"),
    mk("h1", "主標題 h1", p.h1Count === 1 ? "pass" : p.h1Count === 0 ? "fail" : "warn",
      p.h1Count === 0 ? "沒有 h1,搜尋引擎抓不到頁面主題" : p.h1Count === 1 ? "有一個主標題" : `有 ${p.h1Count} 個 h1,主題不明確`,
      "整頁放一個 <h1> 當主標題,其餘用 h2/h3",
      "幫我把頁面主標題設成唯一的 h1,其他標題改 h2/h3"),
    mk("canonical", "正規網址 canonical", p.canonical ? "pass" : "warn",
      p.canonical ? "有 canonical" : "沒有 canonical(同頁多網址時會分散權重)",
      "加 <link rel=\"canonical\" href=\"這頁的正式網址\">",
      "幫我加 canonical 連結,指向這頁的正式網址"),
    mk("jsonld", "結構化資料 JSON-LD", p.hasJsonLd ? "pass" : "warn",
      p.hasJsonLd ? "有 JSON-LD" : "沒有結構化資料,AI/Google 較難精準理解活動資訊",
      "加一段 application/ld+json,活動用 Event、商店用 LocalBusiness",
      "幫我頁面加一段 Event 的 JSON-LD,含活動名稱、日期、地點、優惠"),
    mk("lang", "語言標示 lang", p.lang ? "pass" : "warn",
      p.lang ? `有:${p.lang}` : "<html> 沒設 lang",
      "<html lang=\"zh-Hant\">",
      "幫我把 <html> 加上 lang=\"zh-Hant\""),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/seo.test.js`
Expected: passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/seo.test.js
git commit -m "feat(checks): SEO/AEO 檢查"
```

---

## Task 3: 轉換 CTA 檢查(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/cta.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { checkCTA, CTA_WORDS } from "../checks.js";
const byId=(a,id)=>a.find(c=>c.id===id);
test("有報名按鈕字眼 → cta pass", () => {
  const p = { buttons:["立即報名"], links:[], forms:0, hasMailto:false, hasTel:false, hasLine:false };
  expect(byId(checkCTA(p),"cta-present").status).toBe("pass");
});
test("連結文字含購買 → cta pass", () => {
  const p = { buttons:[], links:[{href:"#",text:"馬上購買"}], forms:0, hasMailto:false, hasTel:false, hasLine:false };
  expect(byId(checkCTA(p),"cta-present").status).toBe("pass");
});
test("完全沒 CTA → fail", () => {
  const p = { buttons:[], links:[{href:"/x",text:"關於我們"}], forms:0, hasMailto:false, hasTel:false, hasLine:false };
  expect(byId(checkCTA(p),"cta-present").status).toBe("fail");
});
test("有表單 → contact pass;什麼都沒 → fail", () => {
  expect(byId(checkCTA({buttons:[],links:[],forms:1,hasMailto:false,hasTel:false,hasLine:false}),"contact-method").status).toBe("pass");
  expect(byId(checkCTA({buttons:[],links:[],forms:0,hasMailto:false,hasTel:false,hasLine:false}),"contact-method").status).toBe("fail");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/cta.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 checkCTA**

```js
export const CTA_WORDS = ["報名","立即","馬上","購買","下單","加入","領取","領券","預約","諮詢","聯絡","報名表","搶購","免費試","訂閱","加 line","加入好友"];

export function checkCTA(p) {
  const texts = [...(p.buttons||[]), ...(p.links||[]).map(l => l.text || "")];
  const hasCta = texts.some(t => CTA_WORDS.some(w => (t||"").toLowerCase().includes(w)));
  const hasContact = p.forms > 0 || p.hasMailto || p.hasTel || p.hasLine;
  return [
    mk("cta-present", "明確行動呼籲 CTA", hasCta ? "pass" : "fail",
      hasCta ? "偵測到明確的行動按鈕/連結" : "沒看到明確 CTA,訪客不知道下一步該做什麼",
      "在 hero 放一顆明確按鈕,例如「立即報名」「加入 LINE 領券」",
      "幫我在頁面 hero 加一顆明確的 CTA 按鈕,文字是『立即報名』,連到報名連結"),
    mk("contact-method", "聯絡/轉換管道", hasContact ? "pass" : "fail",
      hasContact ? "有表單或聯絡方式" : "沒有表單、email、電話或 LINE,訪客無法行動",
      "加一個報名表單,或放 LINE/email/電話讓人能聯絡",
      "幫我頁面加一個收 email 的報名表單,或放上 LINE 加好友連結"),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/cta.test.js`
Expected: passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/cta.test.js
git commit -m "feat(checks): 轉換 CTA 檢查"
```

---

## Task 4: 圖片體積/速度 檢查(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/perf.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { checkPerf } from "../checks.js";
const byId=(a,id)=>a.find(c=>c.id===id);
const ok = { images:[{src:"a.jpg",bytes:120000}], htmlBytes:30000, scriptCount:5 };
test("圖都不大 → pass", () => expect(byId(checkPerf(ok),"img-oversized").status).toBe("pass"));
test("有 >500KB 的圖 → fail 並列出", () => {
  const r = byId(checkPerf({...ok, images:[{src:"big.jpg",bytes:900000}]}),"img-oversized");
  expect(r.status).toBe("fail");
  expect(r.detail).toContain("big.jpg");
});
test("HTML >150KB → warn", () => expect(byId(checkPerf({...ok,htmlBytes:200000}),"html-size").status).toBe("warn"));
test("資產數過多 → warn", () => expect(byId(checkPerf({...ok,images:Array(60).fill({src:"x",bytes:1000}),scriptCount:10}),"asset-count").status).toBe("warn"));
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/perf.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 checkPerf**

```js
const KB = 1024;
export function checkPerf(p) {
  const imgs = p.images || [];
  const big = imgs.filter(i => (i.bytes || 0) > 500 * KB);
  const assetCount = imgs.length + (p.scriptCount || 0);
  const fmtKB = (b) => Math.round(b / KB) + "KB";
  return [
    mk("img-oversized", "圖片沒有過大", big.length === 0 ? "pass" : "fail",
      big.length === 0 ? "沒有超過 500KB 的圖" : `有 ${big.length} 張圖過大:` + big.slice(0,5).map(i => `${i.src.split("/").pop()}(${fmtKB(i.bytes)})`).join("、"),
      "把每張圖壓到 500KB 以下(線上壓圖工具或匯出時調品質)",
      "我有幾張圖太大,幫我說明怎麼把活動頁的圖壓到 500KB 以下而不明顯失真"),
    mk("html-size", "HTML 體積", (p.htmlBytes || 0) > 150 * KB ? "warn" : "pass",
      (p.htmlBytes || 0) > 150 * KB ? `HTML ${fmtKB(p.htmlBytes)} 偏大,行動網路載入較慢` : `HTML ${fmtKB(p.htmlBytes || 0)},合理`,
      "移除沒用到的內嵌內容/重複樣式,或把大段資料外移",
      "我的活動頁 HTML 太大,幫我找出可以精簡的地方"),
    mk("asset-count", "資產數量", assetCount > 50 ? "warn" : "pass",
      assetCount > 50 ? `圖片+script 共 ${assetCount} 個,請求過多會變慢` : `資產數 ${assetCount},合理`,
      "合併/移除不必要的圖與 script,延後載入非首屏圖片",
      "幫我減少活動頁的圖片與 script 數量、把非首屏的圖改成延遲載入"),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/perf.test.js`
Expected: passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/perf.test.js
git commit -m "feat(checks): 圖片體積/速度 檢查"
```

---

## Task 5: 基本體質 檢查(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/basics.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { checkBasics } from "../checks.js";
const byId=(a,id)=>a.find(c=>c.id===id);
const ok = { https:true, hasViewport:true, hasFavicon:true, charset:"utf-8",
  links:[{href:"https://x.com/signup",text:"報名"}] };
test("體質好 → 全 pass", () => {
  const r = checkBasics(ok);
  ["https","viewport","favicon","placeholder-links","charset"].forEach(id => expect(byId(r,id).status).toBe("pass"));
});
test("有 # 或 example.com 假連結 → fail 並列出", () => {
  const r = byId(checkBasics({...ok, links:[{href:"#",text:"a"},{href:"https://example.com",text:"b"}]}),"placeholder-links");
  expect(r.status).toBe("fail");
});
test("非 https → fail", () => expect(byId(checkBasics({...ok,https:false}),"https").status).toBe("fail"));
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/basics.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 checkBasics**

```js
export function checkBasics(p) {
  const links = p.links || [];
  const placeholders = links.filter(l => {
    const h = (l.href || "").trim();
    return h === "#" || h === "" || /example\.com/i.test(h);
  });
  return [
    mk("https", "HTTPS 加密", p.https ? "pass" : "fail",
      p.https ? "用 https" : "沒有 https,瀏覽器會標不安全、影響信任與 SEO",
      "用支援 https 的主機(GitHub Pages / Vercel / Cloudflare 都自動有)",
      "我的活動頁沒有 https,幫我說明怎麼讓它有(用 GitHub Pages 或自訂網域)"),
    mk("viewport", "手機 viewport", p.hasViewport ? "pass" : "fail",
      p.hasViewport ? "有 viewport meta" : "沒有 viewport meta,手機上會縮成一團",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "幫我加 viewport meta 讓頁面在手機正常顯示"),
    mk("favicon", "網站圖示 favicon", p.hasFavicon ? "pass" : "warn",
      p.hasFavicon ? "有 favicon" : "沒有 favicon,分頁/書籤是空白圖示",
      "加 <link rel=\"icon\" href=\"...\"> 或放一個 /favicon.ico",
      "幫我加一個 favicon(用品牌色做一個簡單的)"),
    mk("placeholder-links", "沒有假連結", placeholders.length === 0 ? "pass" : "fail",
      placeholders.length === 0 ? "沒有 # 或 example.com 佔位連結" : `有 ${placeholders.length} 個佔位連結沒換成真網址(# 或 example.com)`,
      "把所有 href=\"#\" 和 example.com 換成真實連結",
      "幫我找出頁面裡 href 還是 # 或 example.com 的連結,提醒我換成真網址"),
    mk("charset", "編碼宣告 charset", p.charset ? "pass" : "warn",
      p.charset ? `有:${p.charset}` : "沒有 charset 宣告,中文可能變亂碼",
      "<meta charset=\"utf-8\"> 放在 <head> 最前面",
      "幫我在 head 最前面加 <meta charset=\"utf-8\">"),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/basics.test.js`
Expected: passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/basics.test.js
git commit -m "feat(checks): 基本體質 檢查"
```

---

## Task 6: 追蹤 檢查(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/tracking.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { checkTracking } from "../checks.js";
const byId=(a,id)=>a.find(c=>c.id===id);
test("有 gtag → analytics pass", () => {
  const p = { scriptSrcs:["https://www.googletagmanager.com/gtag/js?id=G-XXX"], inlineScript:"" };
  expect(byId(checkTracking(p),"analytics").status).toBe("pass");
});
test("有 fbq inline → pixel pass", () => {
  const p = { scriptSrcs:[], inlineScript:"fbq('init','123')" };
  expect(byId(checkTracking(p),"pixel").status).toBe("pass");
});
test("什麼都沒 → analytics fail, pixel warn", () => {
  const p = { scriptSrcs:[], inlineScript:"" };
  expect(byId(checkTracking(p),"analytics").status).toBe("fail");
  expect(byId(checkTracking(p),"pixel").status).toBe("warn");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/tracking.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 checkTracking**

```js
export function checkTracking(p) {
  const blob = [(p.scriptSrcs || []).join(" "), p.inlineScript || ""].join(" ").toLowerCase();
  const hasAnalytics = /googletagmanager|google-analytics|gtag\(|plausible|umami|clarity\.ms|cloudflareinsights/.test(blob);
  const hasPixel = /fbq\(|connect\.facebook\.net|tiktok.*pixel|analytics\.tiktok|gtag\('event'.*conversion|googleadservices/.test(blob);
  return [
    mk("analytics", "網站分析", hasAnalytics ? "pass" : "fail",
      hasAnalytics ? "偵測到網站分析工具" : "沒裝分析,你不會知道多少人來、從哪來、有沒有轉換",
      "裝 Google Analytics 或 Plausible(貼一段 script 即可)",
      "幫我說明怎麼在活動頁裝 Google Analytics 或 Plausible 追流量"),
    mk("pixel", "廣告 pixel", hasPixel ? "pass" : "warn",
      hasPixel ? "偵測到廣告追蹤 pixel" : "沒有廣告 pixel(若要投 FB/IG 廣告會需要)",
      "要投廣告的話裝 Meta Pixel,才能追轉換、做再行銷",
      "我要投 Facebook 廣告,幫我說明怎麼在活動頁裝 Meta Pixel"),
  ];
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd worker && npx vitest run tests/tracking.test.js`
Expected: passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/tracking.test.js
git commit -m "feat(checks): 追蹤 檢查"
```

---

## Task 7: 評分 + topFixes + runAllChecks 組裝(TDD)

**Files:** Modify `worker/checks.js`; Test `worker/tests/score.test.js`

- [ ] **Step 1: 寫失敗測試**

```js
import { expect, test } from "vitest";
import { runAllChecks, scoreReport } from "../checks.js";
const perfectPage = {
  og:{title:"a",description:"b",image:"https://x/og.jpg"}, twitterCard:"summary_large_image",
  title:"短標題", metaDescription:"d", h1Count:1, canonical:"https://x/", hasJsonLd:true, lang:"zh-Hant",
  buttons:["立即報名"], links:[{href:"https://x/s",text:"報名"}], forms:1, hasMailto:false,hasTel:false,hasLine:false,
  images:[{src:"a.jpg",bytes:100000}], htmlBytes:30000, scriptCount:5,
  https:true, hasViewport:true, hasFavicon:true, charset:"utf-8",
  scriptSrcs:["https://www.googletagmanager.com/gtag/js"], inlineScript:"fbq('init')",
};
test("完美頁 → 接近 100、優秀、6 類別", () => {
  const rep = scoreReport(runAllChecks(perfectPage));
  expect(rep.categories).toHaveLength(6);
  expect(rep.score).toBeGreaterThanOrEqual(95);
  expect(rep.grade).toBe("優秀");
});
test("空頁 → 低分、待加強、topFixes 有東西", () => {
  const empty = { og:{}, links:[], buttons:[], images:[], scriptSrcs:[], inlineScript:"", h1Count:0 };
  const rep = scoreReport(runAllChecks(empty));
  expect(rep.score).toBeLessThan(50);
  expect(rep.grade).toBe("待加強");
  expect(rep.topFixes.length).toBeGreaterThan(0);
  expect(rep.topFixes[0]).toHaveProperty("prompt");
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd worker && npx vitest run tests/score.test.js`
Expected: FAIL

- [ ] **Step 3: 實作 runAllChecks / scoreReport**

```js
const CATEGORIES = [
  { key:"og",       name:"分享卡",       weight:20, fn:checkOG },
  { key:"seo",      name:"被找到 SEO",   weight:20, fn:checkSEO },
  { key:"cta",      name:"轉換 CTA",     weight:20, fn:checkCTA },
  { key:"perf",     name:"圖片/速度",    weight:15, fn:checkPerf },
  { key:"basics",   name:"基本體質",     weight:15, fn:checkBasics },
  { key:"tracking", name:"追蹤",         weight:10, fn:checkTracking },
];
const STATUS_VAL = { pass:1, warn:0.5, fail:0 };

export function runAllChecks(p) {
  return CATEGORIES.map(c => ({ key:c.key, name:c.name, weight:c.weight, checks:c.fn(p) }));
}

export function scoreReport(categories) {
  const scored = categories.map(c => {
    const per = c.weight / c.checks.length;
    const got = c.checks.reduce((s, ck) => s + per * STATUS_VAL[ck.status], 0);
    return { key:c.key, name:c.name, max:c.weight, score:Math.round(got), checks:c.checks };
  });
  const score = Math.round(scored.reduce((s, c) => s + (c.score), 0));
  const grade = score >= 80 ? "優秀" : score >= 50 ? "及格" : "待加強";
  const rank = { fail:0, warn:1, pass:2 };
  const topFixes = scored.flatMap(c => c.checks)
    .filter(ck => ck.status !== "pass")
    .sort((a,b) => rank[a.status] - rank[b.status])
    .slice(0, 8)
    .map(ck => ({ id:ck.id, label:ck.label, why:ck.detail, fix:ck.fix, prompt:ck.prompt }));
  return { score, grade, categories:scored, topFixes };
}
```
(注意:`CATEGORIES` 引用的 `checkOG` 等須已在同檔定義於其上方或為 hoisted function declaration — 它們都是 `export function`,hoisted,OK。)

- [ ] **Step 4: 跑全部測試確認通過**

Run: `cd worker && npm test`
Expected: 全部 passed

- [ ] **Step 5: Commit**

```bash
git add worker/checks.js worker/tests/score.test.js
git commit -m "feat(checks): 評分模型 + topFixes + runAllChecks 組裝"
```

---

## Task 8: HTML 解析層 parse.js(HTMLRewriter → PageData)

**Files:** Create `worker/parse.js`

> 此層用 Cloudflare HTMLRewriter,需在 Worker runtime 跑,不做 node 單元測試;由 Task 10 的 e2e 驗證。圖片 bytes 不在此填(Task 9 發 HEAD)。

- [ ] **Step 1: 實作 parse.js**

```js
// 把 fetch 回來的 Response(text/html)解析成 PageData(images.bytes 先留 null)
export async function parseHtml(response, finalUrl) {
  const html = await response.text();
  const htmlBytes = new TextEncoder().encode(html).length;
  const data = {
    finalUrl, https: finalUrl.startsWith("https://"),
    status: response.status, contentType: response.headers.get("content-type") || "",
    htmlBytes,
    title:"", metaDescription:"", lang:"", charset:"", canonical:"",
    og:{title:"",description:"",image:""}, twitterCard:"",
    h1Count:0, hasJsonLd:false, hasViewport:false, hasFavicon:false,
    buttons:[], links:[], forms:0, hasMailto:false, hasTel:false, hasLine:false,
    images:[], scriptCount:0, scriptSrcs:[], inlineScript:"",
  };
  const abs = (u) => { try { return new URL(u, finalUrl).href; } catch { return u; } };
  let curText = null; // 收集 <title>/<h1>/<button>/<a> 內文用

  const rw = new HTMLRewriter()
    .on("html", { element(e){ data.lang = e.getAttribute("lang") || ""; } })
    .on("meta", { element(e){
      const charset = e.getAttribute("charset"); if (charset) data.charset = charset;
      const name = (e.getAttribute("name")||"").toLowerCase();
      const prop = (e.getAttribute("property")||"").toLowerCase();
      const c = e.getAttribute("content") || "";
      if (name === "description") data.metaDescription = c;
      if (name === "viewport") data.hasViewport = true;
      if (name === "twitter:card") data.twitterCard = c;
      if (prop === "og:title") data.og.title = c;
      if (prop === "og:description") data.og.description = c;
      if (prop === "og:image") data.og.image = c;
    }})
    .on("link", { element(e){
      const rel = (e.getAttribute("rel")||"").toLowerCase();
      if (rel.includes("canonical")) data.canonical = e.getAttribute("href") || "";
      if (rel.includes("icon")) data.hasFavicon = true;
    }})
    .on('script[type="application/ld+json"]', { element(){ data.hasJsonLd = true; } })
    .on("script", { element(e){
      data.scriptCount++;
      const src = e.getAttribute("src"); if (src) data.scriptSrcs.push(abs(src));
    }, text(t){ data.inlineScript += t.text; } })
    .on("title", { text(t){ data.title += t.text; } })
    .on("h1", { element(){ data.h1Count++; } })
    .on("button", { element(){ curText = {bucket:"button", s:""}; }, text(t){ if(curText&&curText.bucket==="button") curText.s += t.text; if(t.lastInTextNode){} } })
    .on("img", { element(e){ const s=e.getAttribute("src"); if(s) data.images.push({src:abs(s), bytes:null}); } })
    .on("form", { element(){ data.forms++; } })
    .on("a", { element(e){
      const href = (e.getAttribute("href")||"");
      data._curHref = href;
      if (href.startsWith("mailto:")) data.hasMailto = true;
      if (href.startsWith("tel:")) data.hasTel = true;
      if (/line\.me|lin\.ee/i.test(href)) data.hasLine = true;
      data.links.push({ href, text:"" });
    }, text(t){ const last = data.links[data.links.length-1]; if(last) last.text += t.text; } });

  await rw.transform(new Response(html)).arrayBuffer();
  // button 文字:HTMLRewriter 對巢狀文字收集較弱,改用簡單 regex 補強
  data.buttons = (html.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [])
    .map(b => b.replace(/<[^>]+>/g,"").trim()).filter(Boolean);
  data.title = data.title.trim();
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/parse.js
git commit -m "feat: HTML 解析層 parse.js(HTMLRewriter → PageData)"
```

---

## Task 9: Worker 入口 worker.js(驗證 / fetch / 圖片 HEAD / 限流 / CORS / JSON)

**Files:** Create `worker/worker.js`

- [ ] **Step 1: 實作 worker.js**

```js
import { parseHtml } from "./parse.js";
import { runAllChecks, scoreReport } from "./checks.js";

const rate = new Map();
function limited(ip) {
  const now = Date.now();
  if (rate.size > 5000) rate.clear();
  const arr = (rate.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 10) return true;
  arr.push(now); rate.set(ip, arr);
  return false;
}
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET, OPTIONS", "Access-Control-Allow-Headers":"Content-Type" };
const json = (o, s=200) => new Response(JSON.stringify(o), { status:s, headers:{...CORS,"Content-Type":"application/json"} });

async function fillImageSizes(data) {
  const imgs = data.images.slice(0, 20); // 上限 20 張
  await Promise.all(imgs.map(async (img) => {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      let r = await fetch(img.src, { method:"HEAD", signal:ctl.signal });
      clearTimeout(t);
      let len = r.headers.get("content-length");
      img.bytes = len ? parseInt(len, 10) : 0;
    } catch { img.bytes = null; }
  }));
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get("url");
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (limited(ip)) return json({ error:"檢查太頻繁,請等一分鐘再試" }, 429);
    if (!target) return json({ error:"請提供 url 參數" }, 400);

    let u;
    try { u = new URL(target); } catch { return json({ error:"這看起來不是有效網址" }, 400); }
    if (u.protocol !== "http:" && u.protocol !== "https:") return json({ error:"只支援 http/https 網址" }, 400);

    let resp;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
      resp = await fetch(u.href, { redirect:"follow", signal:ctl.signal,
        headers:{ "User-Agent":"MarketingPageChecker/1.0 (+https://yazelin.github.io/marketing-page-checker)" } });
      clearTimeout(t);
    } catch { return json({ error:"這個網址打不開或回應太慢" }, 502); }

    if (resp.status === 403 || resp.status === 401) return json({ error:"對方擋了自動抓取,無法檢查這個頁面" }, 422);
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return json({ error:"這不是一個網頁(HTML)" }, 415);

    const data = await parseHtml(resp, resp.url || u.href);
    if (data.htmlBytes > 3_000_000) return json({ error:"頁面太大,無法分析" }, 413);
    await fillImageSizes(data);

    const report = scoreReport(runAllChecks(data));
    const now = new Date().toISOString().replace("T"," ").slice(0,19) + " UTC";
    return json({ url:data.finalUrl, fetchedAt:now, ...report });
  },
};
```

- [ ] **Step 2: 本地語法檢查(wrangler 能載入)**

Run: `cd worker && npx wrangler deploy --dry-run 2>&1 | tail -3`
Expected: 無語法錯(顯示 Total Upload 之類)

- [ ] **Step 3: Commit**

```bash
git add worker/worker.js
git commit -m "feat: Worker 入口(驗證/fetch/圖片HEAD/限流/CORS/JSON)"
```

---

## Task 10: 部署 Worker + e2e 煙霧測試

**Files:** 無(部署 + 驗證)

> 前置:使用者需已 `wrangler login`(若未登入,執行者請暫停並請使用者登入)。

- [ ] **Step 1: 部署**

Run: `cd worker && npx wrangler deploy 2>&1 | tail -4`
Expected: 顯示 workers.dev 網址,記下(下稱 $W)

- [ ] **Step 2: e2e — 課程 demo(該高分)**

Run: `curl -s "$W/?url=https://yazelin.github.io/ai-marketing-pages-course/demos/01-landing/" | python3 -m json.tool --no-ensure-ascii | head -20`
Expected: 有 score(預期 ≥ 70)、grade、6 個 categories、topFixes 陣列

- [ ] **Step 3: e2e — 錯誤處理**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "$W/?url=not-a-url"` → 預期 400
Run: `curl -s "$W/?url=https://example.com/nonexistent-xyz" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','OK'))"` → 預期錯誤訊息或低分報告

- [ ] **Step 4: 記錄 Worker 網址**

把 $W 寫進 `README.md` 與前端的 `WORKER_URL` 常數(Task 11 會用)。

- [ ] **Step 5: Commit(README)**

```bash
git add README.md && git commit -m "docs: 記錄已部署的 Worker 網址 + e2e 驗證通過"
```

---

## Task 11: 前端結果頁 index.html

**Files:** Create `index.html`

- [ ] **Step 1: 實作 index.html**

單檔內嵌 CSS/JS,沿用課程深色品牌風(墨綠/奶油/銅)。結構:
- `<head>`:完整 SEO + OG(吃自己狗糧,og:image 指 assets/og.jpg)
- Hero:標題「行銷頁健檢器」+ 一句說明 + 網址輸入框 `#url` + 「免費健檢」按鈕 `#go`
- `#loading`(預設隱藏):「正在抓取並分析…」
- `#result`(預設隱藏):總分圓環 `#score` + 等第 `#grade` + topFixes 區 `#topfixes` + 6 類別 `#cats`(每項可展開看 detail/fix + 「複製 prompt」鈕)
- 底部 CTA:連到 `https://yazelin.github.io/ai-marketing-pages-course/`

關鍵 JS:
```js
const WORKER_URL = "__WORKER_URL__"; // Task 10 的 $W,部署前替換
const $ = id => document.getElementById(id);
const GRADE_COLOR = { "優秀":"#36d399", "及格":"#f4b740", "待加強":"#e8a0a0" };

async function run() {
  let url = $("url").value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  $("result").style.display = "none"; $("loading").style.display = "block";
  try {
    const r = await fetch(WORKER_URL + "/?url=" + encodeURIComponent(url));
    const data = await r.json();
    $("loading").style.display = "none";
    if (data.error) { $("result").style.display="block"; $("result").innerHTML = `<p class="err">${data.error}</p>`; return; }
    render(data);
  } catch { $("loading").style.display="none"; $("result").style.display="block"; $("result").innerHTML = `<p class="err">連不上伺服器,稍後再試</p>`; }
}

function render(d) {
  const esc = s => String(s??"").replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  const statusIcon = { pass:"✓", warn:"!", fail:"✕" };
  const topFixes = d.topFixes.map(f => `<li><b>${esc(f.label)}</b> — ${esc(f.fix)}
    <button class="copy" data-p="${esc(f.prompt)}">複製 AI prompt</button></li>`).join("");
  const cats = d.categories.map(c => `
    <div class="cat"><div class="catbar"><span>${esc(c.name)}</span><span>${c.score}/${c.max}</span></div>
      <div class="track"><i style="width:${(c.score/c.max*100)||0}%"></i></div>
      <ul>${c.checks.map(ck => `<li class="ck ${ck.status}">${statusIcon[ck.status]} ${esc(ck.label)}
        <span class="detail">${esc(ck.detail)}</span>
        ${ck.status!=="pass"?`<button class="copy" data-p="${esc(ck.prompt)}">複製修法 prompt</button>`:""}</li>`).join("")}</ul>
    </div>`).join("");
  $("result").style.display = "block";
  $("result").innerHTML = `
    <div class="ring" style="--c:${GRADE_COLOR[d.grade]}"><span>${d.score}</span></div>
    <p class="grade" style="color:${GRADE_COLOR[d.grade]}">${d.grade}</p>
    <p class="for">${esc(d.url)}</p>
    <h3>先修這幾個</h3><ol class="top">${topFixes}</ol>
    <h3>逐項結果</h3>${cats}
    <a class="cta" href="https://yazelin.github.io/ai-marketing-pages-course/">想學會自己做出高分行銷頁?來上課 →</a>`;
  document.querySelectorAll(".copy").forEach(b => b.onclick = () => {
    navigator.clipboard.writeText(b.dataset.p); b.textContent = "已複製 ✓";
  });
}
$("go").onclick = run;
$("url").addEventListener("keydown", e => { if (e.key==="Enter") run(); });
// 支援 ?url= 帶網址自動跑
const pre = new URLSearchParams(location.search).get("url");
if (pre) { $("url").value = pre; run(); }
```
(完整 CSS 沿用課程 deck/demo 的色票與卡片樣式,執行者照既有 demo 風格補齊;圓環用 conic-gradient,track 用底+`i`填色。)

- [ ] **Step 2: 替換 WORKER_URL**

把 `__WORKER_URL__` 換成 Task 10 部署的 $W。

- [ ] **Step 3: Commit**

```bash
git add index.html && git commit -m "feat: 前端結果頁(輸入/總分圓環/類別/逐項修法/複製prompt/課程CTA)"
```

---

## Task 12: 工具自己的 OG 圖 + 前端 headless 驗證 + 部署 Pages

**Files:** Create `assets/og.jpg`, `.nojekyll`, `README.md`(補完)

- [ ] **Step 1: 做工具自己的 OG 圖**

用 headless chrome 渲染一張 1200x630(深色品牌風 + 「行銷頁健檢器」+ 「貼上網址,30 秒看你的活動頁做得好不好」),存 `assets/og.jpg`(壓 < 200KB)。`.nojekyll` 建空檔。

- [ ] **Step 2: 本機起 server,headless 驗證前端**

Run: 本機 `python3 -m http.server` 後,用 chrome headless 載入 index.html,在輸入框填課程 demo 網址、觸發 run、等結果,evaluate 確認:`#result` 顯示、`.ring span` 有分數、`.cat` 有 6 個、`.copy` 鈕存在、console 無紅字。

- [ ] **Step 3: 建 public repo + 部署 Pages**

```bash
gh repo create yazelin/marketing-page-checker --public --source=. --remote=origin --push
gh api -X POST repos/yazelin/marketing-page-checker/pages -f build_type=legacy -f "source[branch]=main" -f "source[path]=/"
```
輪詢 `https://yazelin.github.io/marketing-page-checker/` 到 200。

- [ ] **Step 4: 線上 e2e**

開線上頁、貼課程 demo 網址,確認跑出分數與修法;貼一個故意爛的頁確認低分;手機寬度無水平捲動。

- [ ] **Step 5: Commit + README 補完**

```bash
git add -A && git commit -m "feat: OG 圖 + 上線 GitHub Pages + README" && git push
```

---

## Self-Review(對照 spec)

- 6 類檢查 → Task 1–6 全覆蓋(分享卡/SEO/CTA/圖片速度/體質/追蹤)✓
- 評分加權 100 + 等第 → Task 7 ✓
- topFixes 優先序 + prompt → Task 7 + 前端 Task 11 ✓
- HTMLRewriter 解析 → Task 8 ✓
- 圖片 HEAD 抓大小 → Task 9 `fillImageSizes` ✓
- CORS + 限流 + 錯誤處理(非url/逾時/非html/過大/擋爬蟲)→ Task 9 ✓
- 前端結果頁(圓環/橫條/逐項/複製prompt/CTA/?url=)→ Task 11 ✓
- 工具自己的 OG/SEO → Task 11 head + Task 12 OG 圖 ✓
- 單元測試 → Task 1–7;e2e → Task 10、12 ✓
- v2(headless 渲染)留接口 → parse.js 可換 Browser Rendering,JSON 不變 ✓
- **與 spec 的一處調整**:spec 提到 `docs/checks.md` 當文案單一事實來源;計劃改為文案直接寫在 `checks.js`(DRY,單一來源就是程式碼),不另開 checks.md。

> 命名一致性確認:`PageData` 欄位(og/title/h1Count/images.bytes/scriptSrcs/inlineScript…)在 parse.js 產生、checks.js 消費,名稱一致;`runAllChecks`/`scoreReport`/`mk`/`checkOG..checkTracking` 跨任務一致。
