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
