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
