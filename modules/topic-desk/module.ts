import { defineModule } from "@aihot/contracts/modules";
export default defineModule({
  name: "topic-desk",
  adminPages: [{ path: "admin/topic-desk", file: "web/desk.tsx" }],
  apiPaths: [/^\/api\/admin\/topic-desk(?:\/|$)/],
});
