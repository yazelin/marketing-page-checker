export function mk(id, label, status, detail, fix, prompt) {
  return { id, label, status, detail, fix, prompt };
}

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

export function checkSEO(p) {
  const titleLen = (p.title || "").length;
  return [
    mk("title", "網頁標題 title", !p.title ? "fail" : titleLen > 30 ? "warn" : "pass",
      !p.title ? "沒有 <title>" : titleLen > 30 ? `標題 ${titleLen} 字偏長,搜尋結果會被截斷` : `有:「${p.title}」`,
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
