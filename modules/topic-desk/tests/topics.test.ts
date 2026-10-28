import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { closeDb, sql } from "@aihot/backend/db";
import { blankTopic } from "../domain.ts";
import { createTopic, importTopics, listTopics, updateTopic } from "../backend/topics.ts";
import module from "../server.ts";
after(closeDb);
const topic = { ...blankTopic(), question: "为什么手机会发热？" };
test("创建、编辑、版本冲突与审计持久化", async () => {
  const id = randomUUID();
  const created = await createTopic({ id, topic }, "test");
  assert.equal(created.version, 1);
  await assert.rejects(createTopic({ id, topic }, "test"), /已存在/);
  const changed = await updateTopic(id, { version: 1, topic: { ...topic, status: "shortlisted" } }, "test");
  assert.equal(changed?.version, 2);
  await assert.rejects(updateTopic(id, { version: 1, topic }, "test"), /已被修改/);
  assert.equal((await listTopics()).find((r) => r.id === id)?.topic.status, "shortlisted");
  const audit = await sql`SELECT * FROM audit_log WHERE subject = ${`topic:${id}`}`;
  assert.equal(audit.length, 2);
});
test("导入完整校验、重复跳过、不会覆盖已有编辑", async () => {
  const id = randomUUID();
  const batch = { format: "touwuzhi-topics-v1", topics: [{ id, topic }] };
  assert.deepEqual(await importTopics(batch, "test"), { inserted: 1, skipped: 0 });
  await updateTopic(id, { version: 1, topic: { ...topic, why: "已人工补充" } }, "test");
  assert.deepEqual(await importTopics(batch, "test"), { inserted: 0, skipped: 1 });
  assert.equal((await listTopics()).find((r) => r.id === id)?.topic.why, "已人工补充");
  const nextId = randomUUID();
  await assert.rejects(importTopics({ format: batch.format, topics: [{ id: nextId, topic }, { id: randomUUID(), topic: { ...topic, question: "" } }] }, "test"));
  assert.equal((await listTopics()).some((r) => r.id === nextId), false);
});
test("匿名不能读取或写入选题数据", async () => {
  const app = Fastify(); module.http!(app);
  try {
    for (const method of ["GET", "POST", "PATCH"] as const) {
      const response = await app.inject({ method, url: `/api/admin/topic-desk${method === "PATCH" ? `/${randomUUID()}` : ""}`, ...(method !== "GET" ? { payload: {} } : {}) });
      assert.equal(response.statusCode, 401);
      assert.equal(response.headers["cache-control"], "no-store");
    }
  } finally { await app.close(); }
});
