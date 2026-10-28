import { useState } from "react";
import { beijingDate } from "@aihot/contracts/time";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, Card, Field, Input, Select, Textarea } from "@aihot/web/features/admin/ui";
import { PLATFORMS, SIGNALS, METRICS, STATUSES, blankTopic, gaps, toMarkdown, topicSchema, importSchema, type Topic, type TopicRow, type Platform } from "../domain";

export async function loader({ request }: LoaderFunctionArgs) {
  return adminGet<{ rows: TopicRow[] }>(request, "/api/admin/topic-desk");
}
export const meta = () => [{ title: "透物志 · 三平台选题台" }];
const platforms = Object.keys(PLATFORMS) as Platform[];
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Desk() {
  const { rows } = useLoaderData<typeof loader>();
  const { run, busy } = useAdminAction();
  const [editing, setEditing] = useState<{ id: string; version?: number } | null>(null);
  const [draft, setDraft] = useState<Topic>(blankTopic);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importText, setImportText] = useState("");
  const [tab, setTab] = useState<"topics" | "sources" | "import">("topics");
  const update = <K extends keyof Topic>(key: K, value: Topic[K]) => setDraft((t) => ({ ...t, [key]: value }));
  const visible = rows.filter((r) => (!filter || r.topic.targets.includes(filter as Platform)) && (!status || r.topic.status === status) && (!query || `${r.topic.question} ${r.topic.why}`.toLowerCase().includes(query.toLowerCase())));
  function edit(row?: TopicRow) {
    setEditing(row ? { id: row.id, version: row.version } : { id: crypto.randomUUID() });
    setDraft(row ? structuredClone(row.topic) : blankTopic()); setError(""); setMessage("");
  }
  async function save() {
    const parsed = topicSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；")); return; }
    if (!editing) return;
    const row = await run<TopicRow>(editing.version ? "PATCH" : "POST", `/api/admin/topic-desk${editing.version ? `/${editing.id}` : ""}`, editing.version ? { version: editing.version, topic: parsed.data } : { id: editing.id, topic: parsed.data }, { success: "选题已保存" });
    if (row) { setEditing(null); setError(""); }
  }
  return <AdminPage title="透物志 · 三平台选题台" subtitle="先看观众想知道什么，再核对原理。小红书、抖音、微信视频号分别保留证据。" actions={!editing && <Button tone="primary" onClick={() => edit()}>新建选题</Button>}>
    <div className="mb-5 flex flex-wrap gap-2">{([['topics', '选题库'], ['sources', '信源与观察清单'], ['import', '导入与备份']] as const).map(([key, label]) => <Button key={key} disabled={!!editing} tone={tab === key ? "primary" : undefined} onClick={() => setTab(key)}>{label}</Button>)}</div>
    <div className="mb-5 rounded-panel bg-accent-soft p-4 text-sm text-ink-2">仅管理员可见。目前支持人工记录与 JSON 导入，尚未接通平台自动采集。没有证据的题目保持“待研究”；不生成跨平台热度分或爆款保证。</div>
    {message && <p role="status" className="mb-4 text-sm text-ok">{message}</p>}
    {error && <p role="alert" className="mb-4 break-words text-sm text-hot">{error}</p>}
    {editing ? <div className="space-y-5">
      <Card title={editing.version ? "编辑选题" : "新选题"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="观众的问题"><Input aria-label="观众的问题" value={draft.question} maxLength={180} onChange={(e) => update("question", e.target.value)} placeholder="例如：手机没有风扇，热量怎么散出去？" /></Field></div>
          <Field label="方向"><Select value={draft.category} onChange={(e) => update("category", e.target.value as Topic["category"])}>{["机械结构", "电子设备", "生活原理", "科技工程"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="进度"><Select value={draft.status} onChange={(e) => update("status", e.target.value as Topic["status"])}>{Object.entries(STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm">准备发布到</legend><div className="flex flex-wrap gap-4">{platforms.map((p) => <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.targets.includes(p)} onChange={(e) => update("targets", e.target.checked ? [...draft.targets,p] : draft.targets.filter((v) => v !== p))} />{PLATFORMS[p]}</label>)}</div></fieldset>
          <Field label="为什么值得做"><Textarea rows={3} value={draft.why} onChange={(e) => update("why", e.target.value)} placeholder="生活关联、认知反差、现有讲解没讲清的地方" /></Field>
          <Field label="待核实的问题"><Textarea rows={3} value={draft.unknowns} onChange={(e) => update("unknowns", e.target.value)} /></Field>
          <Field label="原理因果链"><Textarea rows={4} value={draft.principle} onChange={(e) => update("principle", e.target.value)} placeholder="只写已查证内容；缺少依据处标为待核实" /></Field>
          <Field label="动画思路"><Textarea rows={4} value={draft.visual} onChange={(e) => update("visual", e.target.value)} placeholder="3D结构 / 2D箭头与剖面 / 定格结论，手机竖屏是否看得清" /></Field>
        </div>
      </Card>
      <Card title="观众需求证据" right={<Button disabled={draft.evidence.length >= 50} onClick={() => update("evidence", [...draft.evidence, { platform: "xiaohongshu", kind: "question", url: "", locator: "", observedOn: beijingDate(new Date()), note: "", metric: "none", value: null, window: "" }])}>添加证据</Button>}>
        <p className="mb-4 text-sm text-ink-3">记录原链接或可查找的位置。不保存评论者个人信息；相同作品的多次观察不算多个独立来源。</p>
        {draft.evidence.length === 0 && <p className="text-sm text-ink-3">暂无证据。可以先保存问题，再补搜索、评论或作品线索。</p>}
        {draft.evidence.map((e, i) => {
          const patch = (value: Partial<typeof e>) => update("evidence", draft.evidence.map((item, j) => j === i ? { ...item, ...value } : item));
          return <fieldset key={i} className="mb-5 grid gap-3 rounded-panel border border-line p-4 sm:grid-cols-2"><legend className="px-2 text-sm">证据 {i+1}</legend>
            <Field label="平台"><Select aria-label={`证据${i+1}平台`} value={e.platform} onChange={(ev) => patch({ platform: ev.target.value as Platform })}>{platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p]}</option>)}</Select></Field>
            <Field label="类型"><Select value={e.kind} onChange={(ev) => patch({ kind: ev.target.value as typeof e.kind })}>{Object.entries(SIGNALS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="原链接（可留空）"><Input value={e.url} onChange={(ev) => patch({ url: ev.target.value })} /></Field>
            <Field label="定位信息"><Input value={e.locator} onChange={(ev) => patch({ locator: ev.target.value })} placeholder="账号、作品标题、截图文件名；无链接时必填" /></Field>
            <Field label="观察日期（北京时间）"><Input type="date" value={e.observedOn} onChange={(ev) => patch({ observedOn: ev.target.value })} /></Field>
            <Field label="实际观察"><Textarea rows={2} value={e.note} onChange={(ev) => patch({ note: ev.target.value })} placeholder="问题原意、搜索结果、榜单内容等" /></Field>
            <Field label="指标"><Select value={e.metric} onChange={(ev) => patch({ metric: ev.target.value as typeof e.metric, value: null })}>{Object.entries(METRICS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="数值（未知请不记录）"><Input type="number" min={0} step="any" disabled={e.metric === "none"} value={e.value ?? ""} onChange={(ev) => patch({ value: ev.target.value === "" ? null : Number(ev.target.value) })} /></Field>
            <Field label="指标口径"><Input value={e.window} onChange={(ev) => patch({ window: ev.target.value })} placeholder="截至观察日累计 / 近7天 / 榜单名" /></Field>
            <div className="flex items-end"><Button onClick={() => update("evidence", draft.evidence.filter((_,j) => j !== i))}>移除这条证据</Button></div>
          </fieldset>;
        })}
      </Card>
      <Card title="原理资料" right={<Button disabled={draft.references.length >= 30} onClick={() => update("references", [...draft.references, { title: "", url: "", note: "", verified: false }])}>添加资料</Button>}>
        <p className="mb-3 text-sm text-ink-3">可粘贴本站资讯页或技术原文链接。勾选“已核对”是你的人工判断，不是系统认证。</p>
        {draft.references.map((r, i) => {
          const patch = (value: Partial<typeof r>) => update("references", draft.references.map((item,j) => j === i ? { ...item, ...value } : item));
          return <div key={i} className="mb-4 grid gap-3 border-b border-line pb-4 sm:grid-cols-2">
            <Field label="资料名称"><Input value={r.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
            <Field label="资料链接"><Input value={r.url} onChange={(e) => patch({ url: e.target.value })} /></Field>
            <Field label="支持哪条原理、有哪些限制"><Textarea rows={2} value={r.note} onChange={(e) => patch({ note: e.target.value })} /></Field>
            <div className="flex flex-wrap items-center gap-3"><label className="text-sm"><input type="checkbox" checked={r.verified} onChange={(e) => patch({ verified: e.target.checked })} /> 已人工核对</label><Button onClick={() => update("references", draft.references.filter((_,j) => j !== i))}>移除资料</Button></div>
          </div>;
        })}
      </Card>
      <Card title="三个平台的切入点"><p className="mb-3 text-sm text-ink-3">同一原理可以用不同问题开场。这里是编辑草稿，不是平台推荐规则或自动生成结果。</p><div className="grid gap-4 lg:grid-cols-3">{platforms.map((p) => <Field key={p} label={PLATFORMS[p]}><Textarea rows={4} value={draft.angles[p]} onChange={(e) => update("angles", { ...draft.angles, [p]: e.target.value })} /></Field>)}</div></Card>
      <div className="flex flex-wrap gap-3"><Button tone="primary" disabled={busy} onClick={save}>保存选题</Button><Button disabled={busy} onClick={() => {setEditing(null); setError("");}}>取消编辑</Button></div>
    </div> : tab === "topics" ? <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><Input aria-label="搜索选题" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索问题、选题理由" /><Select aria-label="目标平台筛选" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">全部目标平台</option>{platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p]}</option>)}</Select><Select aria-label="状态筛选" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">全部进度</option>{Object.entries(STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
      <p className="mb-4 text-sm text-ink-3">{visible.length} 个选题 · 按最近更新排序。目标平台表示准备发布到哪里，不表示该平台已有需求证据。</p>
      <div className="grid gap-4 lg:grid-cols-2">{visible.map((r) => <Card key={r.id} title={r.topic.question} right={<Badge>{STATUSES[r.topic.status]}</Badge>}>
        <p className="mb-3 text-sm text-ink-2">{r.topic.why || "选题理由待补充"}</p>
        <div className="mb-3 flex flex-wrap gap-2">{r.topic.targets.map((p) => <Badge key={p} tone="accent">{PLATFORMS[p]}</Badge>)}</div>
        <p className="mb-2 text-xs text-ink-3">证据记录：{platforms.map((p) => `${PLATFORMS[p]} ${r.topic.evidence.filter((e) => e.platform === p).length}条`).join(" · ")}（非独立人数）</p>
        <p className="mb-4 text-xs text-ink-3">{gaps(r.topic).join("；") || "资料项已填写，请人工审稿后制作。"}</p>
        <div className="flex flex-wrap gap-2"><Button onClick={() => edit(r)}>编辑选题</Button><Button onClick={() => download(`topic-${r.id}.md`, toMarkdown(r), "text/markdown;charset=utf-8")}>导出文稿任务</Button></div>
      </Card>)}</div>
      {!visible.length && <Card title="从一个真实问题开始"><p className="text-sm text-ink-3">新建选题，记录一次搜索或一条评论，再补原理资料。这里没有预填的热门数据。</p></Card>}
    </> : tab === "sources" ? <Sources /> : <Card title="批量导入与备份">
      <p className="mb-4 text-sm text-ink-3">JSON 格式，每批最多100条。先完整校验，再一次写入；同ID跳过、不覆盖已有记录。导出包含全部选题，可编辑后分批导入。</p>
      <div className="mb-4 flex flex-wrap gap-2"><Button disabled={!rows.length} onClick={() => {
        for (let i=0;i<rows.length;i+=100) download(`touwuzhi-topics-${i/100+1}.json`, JSON.stringify({ format: "touwuzhi-topics-v1", topics: rows.slice(i,i+100).map(({id,topic}) => ({id,topic})) },null,2), "application/json");
      }}>导出全部 JSON（每100条一份）</Button><Button onClick={() => {
        const t = blankTopic(); t.question = "示例：手机没有风扇，热量怎么散出去？"; t.unknowns = "仅为录入示例，无真实平台热度证据。";
        download("topic-import-template.json", JSON.stringify({ format: "touwuzhi-topics-v1", topics: [{ id: crypto.randomUUID(), topic: t }] },null,2), "application/json");
      }}>下载导入模板</Button></div>
      <Field label="选择 JSON 文件"><Input type="file" accept=".json,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 900_000) {setError("文件过大，请拆分到900KB以内。"); return;} setImportText(await f.text()); setError(""); }} /></Field>
      <div className="my-4"><Field label="导入内容"><Textarea aria-label="导入内容" rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} /></Field></div>
      <Button tone="primary" disabled={busy || !importText} onClick={async () => {
        try {
          const parsed = importSchema.parse(JSON.parse(importText));
          const result = await run<{inserted:number;skipped:number}>("POST", "/api/admin/topic-desk/import", parsed);
          if (result) {setMessage(`新增 ${result.inserted} 条，跳过已有ID ${result.skipped} 条。`); setError(""); setImportText("");}
        } catch (e) {setError(`未导入：${(e as Error).message}`);}
      }}>校验并导入</Button>
    </Card>}
  </AdminPage>;
}

function Sources() {
  return <div className="grid gap-5 lg:grid-cols-2">
    <Card title="观众需求：三个平台分别观察">
      <ul className="space-y-4 text-sm text-ink-2">
        <li><strong>小红书：</strong>站内搜索具体物品和问题，查看相关笔记、创作灵感、评论追问。记录关键词、作品链接和观察日期。</li>
        <li><strong>抖音：</strong><a className="text-accent" href="https://trendinsight.oceanengine.com/" target="_blank" rel="noreferrer">抖音指数</a>、站内搜索与同类作品评论。注明指数、点赞、播放的各自口径。</li>
        <li><strong>微信视频号：</strong>在微信内搜索相关视频并人工记录评论问题；有自己的后台数据时记录来源和统计周期。无公开链接时填账号、标题及截图定位。不能看到的播放量留空。</li>
      </ul>
      <p className="mt-4 text-xs text-ink-3">辅助查看：<a className="text-accent" href="https://index.baidu.com/" target="_blank" rel="noreferrer">百度指数</a>。它反映百度搜索需求，不能记成三个平台的搜索量。当前未验证上述服务的自动采集接口。</p>
    </Card>
    <Card title="核对原理：按选题查资料">
      <ul className="space-y-3 text-sm">{[
        ["Explain that Stuff", "https://www.explainthatstuff.com/azindex.html", "日常物品原理，适合长期题库"],
        ["iFixit", "https://www.ifixit.com/News/category/teardowns", "电子产品实物拆解"],
        ["中科院物理所", "https://www.iop.cas.cn/qt/weixin/", "物理现象与科普"],
        ["Bosch Mobility", "https://www.bosch-mobility.com/en/solutions/braking-systems/", "制动系统及工作原理"],
        ["TI 技术文档", "https://www.ti.com.cn/technical-documents/cn/techdoc", "传感器、电源与电机控制"],
        ["SKF", "https://evolution.skf.com/us/category/rolling-knowledge-us/", "轴承、密封及机械知识"],
      ].map(([name,url,note]) => <li key={name}><a className="text-accent" href={url} target="_blank" rel="noreferrer">{name}</a> · {note}</li>)}</ul>
      <p className="mt-4 text-xs text-ink-3">这些是查阅入口，未自动启用采集。保存必要摘要和原链接；厂商方案需区分具体型号与通用原理。</p>
    </Card>
  </div>;
}
