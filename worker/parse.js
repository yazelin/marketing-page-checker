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
