import { z } from "zod";

export const PLATFORMS = { xiaohongshu: "小红书", douyin: "抖音", channels: "微信视频号" } as const;
export const SIGNALS = { question: "观众提问", search: "搜索趋势", hot: "热点榜", work: "作品表现" } as const;
export const METRICS = { none: "未记录数值", likes: "点赞", views: "播放", comments: "评论", saves: "收藏", shares: "分享", index: "平台指数", rank: "榜单名次" } as const;
export const STATUSES = { inbox: "待研究", shortlisted: "候选", producing: "制作中", published: "已发布", archived: "归档" } as const;
export type Platform = keyof typeof PLATFORMS;
const platform = z.enum(["xiaohongshu", "douyin", "channels"]);
const text = (max = 2000) => z.string().trim().max(max);
const url = z.string().trim().max(2000).refine((v) => {
  if (!v) return true;
  try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}, "请填写 http/https 链接");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请填写观察日期").refine((v) => {
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "日期不存在");
export const evidenceSchema = z.object({
  platform, kind: z.enum(["question", "search", "hot", "work"]),
  url, locator: text(500), observedOn: day,
  note: text().min(1, "请记录实际观察到的问题或现象"),
  metric: z.enum(["none", "likes", "views", "comments", "saves", "shares", "index", "rank"]),
  value: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  window: text(200),
}).strict().superRefine((v, ctx) => {
  if (!v.url && !v.locator) ctx.addIssue({ code: "custom", path: ["locator"], message: "填写原链接，或账号、作品标题、截图文件名等定位信息" });
  if (v.metric === "none" ? v.value !== null : v.value === null) ctx.addIssue({ code: "custom", path: ["value"], message: "未记录数值时留空；选择指标时必须填写数值" });
  if (v.metric === "rank" && (v.value === null || !Number.isInteger(v.value) || v.value < 1)) ctx.addIssue({ code: "custom", path: ["value"], message: "榜单名次为正整数" });
  if (v.metric !== "none" && !v.window) ctx.addIssue({ code: "custom", path: ["window"], message: "注明统计口径，如截至观察日累计、近7天或榜单名称" });
});
export const topicSchema = z.object({
  question: text(180).min(3, "问题至少三个字"),
  category: z.enum(["机械结构", "电子设备", "生活原理", "科技工程"]),
  targets: z.array(platform).min(1).max(3).refine((v) => new Set(v).size === v.length, "目标平台不能重复"),
  status: z.enum(["inbox", "shortlisted", "producing", "published", "archived"]),
  why: text(), principle: text(5000), visual: text(5000), unknowns: text(5000),
  angles: z.object({ xiaohongshu: text(), douyin: text(), channels: text() }).strict(),
  evidence: z.array(evidenceSchema).max(50),
  references: z.array(z.object({ title: text(200).min(1), url: url.refine(Boolean, "资料需要链接"), note: text(), verified: z.boolean() }).strict()).max(30),
}).strict();
export type Topic = z.infer<typeof topicSchema>;
export type Evidence = Topic["evidence"][number];
export interface TopicRow { id: string; version: number; topic: Topic; updated_at: string }
export const importSchema = z.object({
  format: z.literal("touwuzhi-topics-v1"),
  topics: z.array(z.object({ id: z.uuid(), topic: topicSchema }).strict()).min(1).max(100),
}).strict().refine((v) => new Set(v.topics.map((t) => t.id)).size === v.topics.length, "同一批次不能包含重复ID");

export function blankTopic(): Topic {
  return { question: "", category: "生活原理", targets: ["xiaohongshu", "douyin", "channels"], status: "inbox", why: "", principle: "", visual: "", unknowns: "", angles: { xiaohongshu: "", douyin: "", channels: "" }, evidence: [], references: [] };
}
export function gaps(topic: Topic): string[] {
  return [!topic.evidence.length && "补充观众需求证据", !topic.references.some((r) => r.verified) && "人工核对原理资料", !topic.principle && "整理原理因果链", !topic.visual && "设计可视化", ...topic.targets.filter((p) => !topic.angles[p]).map((p) => `补充${PLATFORMS[p]}切入点`)].filter(Boolean) as string[];
}
// Editorial working notes only: the export does not claim generated text or platform trend evidence.
export function toMarkdown(row: TopicRow): string {
  const t = row.topic;
  const plain = (s: string) => s.replace(/[<>]/g, "").replace(/\r/g, "");
  return [`# ${plain(t.question)}`, "", `状态：${STATUSES[t.status]}｜分类：${t.category}`, `目标平台：${t.targets.map((p) => PLATFORMS[p]).join("、")}`, "", "## 选题理由", plain(t.why) || "待填写", "", "## 原理因果链", plain(t.principle) || "待研究", "", "## 动画思路", plain(t.visual) || "待设计", "", "## 平台切入点（编辑草稿）", ...t.targets.map((p) => `- ${PLATFORMS[p]}：${plain(t.angles[p]) || "待填写"}`), "", "## 观众需求证据", "指标只保留原平台口径，不跨平台相加；记录不代表全平台热度。", ...t.evidence.map((e) => `- ${PLATFORMS[e.platform]} / ${SIGNALS[e.kind]} / ${e.observedOn}：${plain(e.note)}\n  来源：${e.url || plain(e.locator)}${e.url && e.locator ? `（${plain(e.locator)}）` : ""}\n  指标：${e.metric === "none" ? "未记录" : `${METRICS[e.metric]} ${e.value}；${plain(e.window)}`}`), "", "## 原理资料", ...t.references.map((r) => `- ${plain(r.title)}：${r.url}\n  ${r.verified ? "编辑已核对" : "待核对"}；${plain(r.note)}`), "", "## 待核实", plain(t.unknowns) || "尚未填写，请在制作前检查", "", "## 制作前检查", ...gaps(t).map((g) => `- ${g}`), "", "交给文稿流程时：区分事实与假设，不补造播放量或热门结论；先给三个开头候选，再给因果链与可动画分镜。", ""].join("\n");
}
