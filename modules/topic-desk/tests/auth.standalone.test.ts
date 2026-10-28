import assert from "node:assert/strict";
import { test, after } from "node:test";
import Fastify from "fastify";
import { config } from "@aihot/backend/config";
import { closeDb } from "@aihot/backend/db";
import module from "../server.ts";
after(closeDb);

test("选题接口要求管理员；写入必须有CSRF，校验失败不触及数据库", async () => {
  const app = Fastify(); module.http!(app);
  const before = config.devAdmin;
  try {
    config.devAdmin = null;
    for (const [method,url] of [["GET","/api/admin/topic-desk"], ["POST","/api/admin/topic-desk"], ["POST","/api/admin/topic-desk/import"]] as const) {
      const r = await app.inject({method,url, ...(method === "POST" ? {payload:{}} : {})});
      assert.equal(r.statusCode,401); assert.equal(r.headers["cache-control"],"no-store");
    }
    config.devAdmin = {displayName:"Fixture"};
    const denied = await app.inject({method:"POST",url:"/api/admin/topic-desk",payload:{}});
    assert.equal(denied.statusCode,403);
    const invalid = await app.inject({method:"POST",url:"/api/admin/topic-desk",headers:{"x-csrf-token":"dev"},payload:{}});
    assert.equal(invalid.statusCode,400);
  } finally {config.devAdmin = before; await app.close();}
});
