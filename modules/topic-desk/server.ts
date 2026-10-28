import { defineServerModule } from "@aihot/backend/modules";
import { actorOf } from "@aihot/backend/admin/auth";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import { orNotFound, param } from "@aihot/api/routes/admin";
import { createTopic, importTopics, listTopics, updateTopic } from "./backend/topics.ts";
export default defineServerModule({
  name: "topic-desk",
  http(app) {
    app.get("/api/admin/topic-desk", adminHandler(async () => ({ rows: await listTopics() })));
    app.post("/api/admin/topic-desk", adminHandler(async (req, _reply, admin) => createTopic(req.body, actorOf(admin))));
    app.patch("/api/admin/topic-desk/:id", adminHandler(async (req, reply, admin) => orNotFound(req, reply, await updateTopic(param(req, "id"), req.body, actorOf(admin)))));
    app.post("/api/admin/topic-desk/import", adminHandler(async (req, _reply, admin) => importTopics(req.body, actorOf(admin))));
  },
});
