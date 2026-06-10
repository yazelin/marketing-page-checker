import { expect, test } from "vitest";
import { mk } from "../checks.js";
test("mk builds a check result", () => {
  expect(mk("a","b","pass","d","f","p")).toEqual({id:"a",label:"b",status:"pass",detail:"d",fix:"f",prompt:"p"});
});
