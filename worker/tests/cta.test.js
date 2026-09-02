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

// 服務業的成交動作。原本這些全部被判成「沒有 CTA」。
test("花店的『打電話訂花』→ cta pass", () => {
  const p = { buttons:["打電話訂花"], links:[{text:"看這週的花與價錢"}], hasTel:true };
  expect(byId(checkCTA(p),"cta-present").status).toBe("pass");
});
test("律師的『寄信問我接不接』→ cta pass", () => {
  const p = { buttons:[], links:[{text:"寄信問我接不接"},{text:"先看我不辦哪些"}], hasMailto:true };
  expect(byId(checkCTA(p),"cta-present").status).toBe("pass");
});
test("『洽詢報價』→ cta pass", () => {
  const p = { buttons:["洽詢報價"], links:[], hasMailto:true };
  expect(byId(checkCTA(p),"cta-present").status).toBe("pass");
});
test("純導覽連結仍然 fail,不要放寬到什麼都算", () => {
  const p = { buttons:[], links:[{text:"關於我"},{text:"作品集"},{text:"回首頁"}], hasTel:true };
  expect(byId(checkCTA(p),"cta-present").status).toBe("fail");
});
