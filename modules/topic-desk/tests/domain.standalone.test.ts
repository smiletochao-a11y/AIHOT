import assert from "node:assert/strict";
import { test } from "node:test";
import { blankTopic, evidenceSchema, gaps, importSchema, toMarkdown, topicSchema } from "../domain.ts";

const evidence = { platform: "channels", kind: "question", url: "", locator: "账号A / 作品B / 截图1", observedOn: "2026-10-28", note: "用户问为什么会发热", metric: "none", value: null, window: "" };
test("视频号无链接可定位；未知数值不当作零，指标保留口径", () => {
  assert.equal(evidenceSchema.parse(evidence).value, null);
  assert.equal(evidenceSchema.safeParse({ ...evidence, locator: "" }).success, false);
  assert.equal(evidenceSchema.safeParse({ ...evidence, metric: "views", value: 0 }).success, false);
  assert.equal(evidenceSchema.parse({ ...evidence, metric: "views", value: 0, window: "截至观察日累计" }).value, 0);
  assert.equal(evidenceSchema.safeParse({ ...evidence, metric: "rank", value: 0, window: "科技榜" }).success, false);
});
test("拒绝危险链接、无效日期、重复平台和不完整批次", () => {
  assert.equal(evidenceSchema.safeParse({ ...evidence, url: "javascript:alert(1)" }).success, false);
  assert.equal(evidenceSchema.safeParse({ ...evidence, observedOn: "2026-02-30" }).success, false);
  const topic = { ...blankTopic(), question: "为什么手机发热？" };
  assert.equal(topicSchema.safeParse({ ...topic, targets: [] }).success, false);
  assert.equal(topicSchema.safeParse({ ...topic, targets: ["douyin", "douyin"] }).success, false);
  const row = { id: "a0c2bf03-20d3-47d3-b0ca-562bfa7ee535", topic };
  assert.equal(importSchema.safeParse({ format: "touwuzhi-topics-v1", topics: [row, row] }).success, false);
  assert.equal(importSchema.safeParse({ format: "touwuzhi-topics-v1", topics: [row, { ...row, id: "invalid" }] }).success, false);
});
test("文稿任务保留来源和三平台草稿，不伪造需求；缺资料仍提示核对", () => {
  const topic = topicSchema.parse({ ...blankTopic(), question: "为什么手机发热？", evidence: [evidence], angles: { xiaohongshu: "生活疑问", douyin: "温差对比", channels: "讲清误解" } });
  const result = toMarkdown({ id: "sample", version: 1, topic, updated_at: "2026-10-28" });
  for (const text of ["微信视频号", "截图1", "未记录", "生活疑问", "温差对比", "讲清误解", "不跨平台相加", "人工核对原理资料"]) assert.ok(result.includes(text), text);
  assert.ok(gaps(topic).includes("人工核对原理资料"));
});
