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
