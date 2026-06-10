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
