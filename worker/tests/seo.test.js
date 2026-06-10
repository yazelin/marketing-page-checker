import { expect, test } from "vitest";
import { checkSEO } from "../checks.js";
const byId = (a,id)=>a.find(c=>c.id===id);
const good = { title:"山霧咖啡 開幕週", metaDescription:"買一送一", h1Count:1, canonical:"https://x.com/", hasJsonLd:true, lang:"zh-Hant" };
test("全齊 → pass", () => {
  const r = checkSEO(good);
  ["title","meta-desc","h1","canonical","jsonld","lang"].forEach(id => expect(byId(r,id).status).toBe("pass"));
});
test("無 h1 → fail;多 h1 → warn", () => {
  expect(byId(checkSEO({...good,h1Count:0}),"h1").status).toBe("fail");
  expect(byId(checkSEO({...good,h1Count:3}),"h1").status).toBe("warn");
});
test("title 過長 → warn", () => {
  expect(byId(checkSEO({...good,title:"超".repeat(40)}),"title").status).toBe("warn");
});
