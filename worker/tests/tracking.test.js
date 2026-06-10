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
