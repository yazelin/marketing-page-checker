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
