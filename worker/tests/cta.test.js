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
