import { defineWebModule } from "@aihot/web/modules";
export default defineWebModule({
  name: "topic-desk",
  admin: { groups: [{ group: "透物志", items: [{ to: "/admin/topic-desk", label: "三平台选题台" }] }], landing: "/admin/topic-desk" },
});
