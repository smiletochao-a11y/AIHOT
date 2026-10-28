import { sql, type Db } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { importSchema, topicSchema, type TopicRow } from "../domain.ts";
import { z } from "zod";

export async function listTopics() {
  return sql<TopicRow[]>`SELECT id, version, topic, updated_at FROM topic_desk ORDER BY updated_at DESC, id`;
}
async function insert(db: Db, id: string, topic: TopicRow["topic"], actor: string) {
  const rows = await db<TopicRow[]>`INSERT INTO topic_desk (id, topic) VALUES (${id}, ${db.json(topic)}) ON CONFLICT (id) DO NOTHING RETURNING id, version, topic, updated_at`;
  if (rows[0]) await audit(actor, "topic-desk.create", `topic:${id}`, "录入选题", null, rows[0], { db });
  return rows[0] ?? null;
}
export async function createTopic(input: unknown, actor: string) {
  const { id, topic } = z.object({ id: z.uuid(), topic: topicSchema }).strict().parse(input);
  return sql.begin(async (tx) => {
    const row = await insert(tx, id, topic, actor);
    if (!row) throw new Conflict("该选题ID已存在，请刷新列表后检查，未重复创建。");
    return row;
  });
}
export async function updateTopic(id: string, input: unknown, actor: string) {
  z.uuid().parse(id);
  const { version, topic } = z.object({ version: z.number().int().positive(), topic: topicSchema }).strict().parse(input);
  return sql.begin(async (tx) => {
    const [before] = await tx<TopicRow[]>`SELECT id, version, topic, updated_at FROM topic_desk WHERE id = ${id} FOR UPDATE`;
    if (!before) return null;
    if (before.version !== version) throw new Conflict("选题已被修改，请刷新后重新编辑。");
    const [row] = await tx<TopicRow[]>`UPDATE topic_desk SET topic = ${tx.json(topic)}, version = version + 1, updated_at = now() WHERE id = ${id} RETURNING id, version, topic, updated_at`;
    await audit(actor, "topic-desk.update", `topic:${id}`, "编辑选题卡", before, row, { db: tx });
    return row;
  });
}
export async function importTopics(input: unknown, actor: string) {
  const batch = importSchema.parse(input);
  return sql.begin(async (tx) => {
    let inserted = 0;
    for (const row of batch.topics) if (await insert(tx, row.id, row.topic, actor)) inserted++;
    return { inserted, skipped: batch.topics.length - inserted };
  });
}
