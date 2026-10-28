import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeApi, startWebServer } from "./web-server.ts";
import { blankTopic } from "../../../modules/topic-desk/domain.ts";

test("选题台服务端展示三平台、资料缺口与管理员入口", async () => {
  const api = fakeApi((url) => {
    if (url.pathname === "/api/admin/me") return {name:"Fixture",csrf:"fixture",dev:true};
    if (url.pathname === "/api/admin/nav-counts") return {};
    if (url.pathname === "/api/admin/topic-desk") return {rows:[{id:"fixture",version:1,updated_at:"2026-10-28",topic:{...blankTopic(),question:"为什么手机会发热？"}}]};
  });
  const web = await startWebServer(api);
  try {
    const response = await fetch(`${web.origin}/admin/topic-desk`);
    assert.equal(response.status,200);
    const html = await response.text();
    for (const text of ["为什么手机会发热", "小红书", "抖音", "微信视频号", "补充观众需求证据", "人工核对原理资料", "导出文稿任务", "三平台选题台"]) assert.ok(html.includes(text),text);
    assert.match(response.headers.get("cache-control") ?? "",/no-store/);
  } finally {await web.stop();}
});
