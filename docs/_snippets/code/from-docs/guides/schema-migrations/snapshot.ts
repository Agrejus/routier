import { mkdirSync, writeFileSync } from "node:fs";
import { s } from "@routier/core/schema";

const todoDefinition = s.define("todos", {
    id: s.string().key().identity(),
    title: s.string(),
    status: s.string("open", "done").default("open"),
    schemaVersion: s.number().default(2),
});

export const todoSchema = todoDefinition.compile();

const snapshot = todoDefinition["~standard"].jsonSchema.output({ target: "draft-2020-12" });

mkdirSync("schema-snapshots", { recursive: true });
writeFileSync("schema-snapshots/todos.v2.json", `${JSON.stringify(snapshot, null, 4)}\n`);
