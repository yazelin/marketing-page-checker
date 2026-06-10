import { expect, test } from "vitest";
import { checkOG } from "../checks.js";

const base = { og:{title:"開幕週",description:"買一送一",image:"https://x.com/og.jpg"}, twitterCard:"summary_large_image" };
const byId = (arr,id) => arr.find(c => c.id===id);

test("全齊 → 全 pass", () => {
  const r = checkOG(base);
  expect(byId(r,"og-title").status).toBe("pass");
  expect(byId(r,"og-image-format").status).toBe("pass");
  expect(byId(r,"og-image-abs").status).toBe("pass");
  expect(byId(r,"twitter-card").status).toBe("pass");
});
test("og:image 是 svg → warn", () => {
  const r = checkOG({...base, og:{...base.og, image:"https://x.com/banner.svg"}});
  expect(byId(r,"og-image-format").status).toBe("warn");
});
test("og:image 相對路徑 → fail", () => {
  const r = checkOG({...base, og:{...base.og, image:"/assets/og.jpg"}});
  expect(byId(r,"og-image-abs").status).toBe("fail");
});
test("缺 og:title → fail", () => {
  const r = checkOG({...base, og:{...base.og, title:""}});
  expect(byId(r,"og-title").status).toBe("fail");
});
