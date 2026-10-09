import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import { showInDevtools } from "../devtools";

type Log = (message: string, value?: unknown) => void;

const taskSchema = s
  .define("tasks", {
    id: s.string().key().identity(),
    title: s.string(),
    priority: s.number(),
    done: s.boolean().default(false),
  })
  .compile();

class TaskStore extends DataStore {
  tasks = this.collection(taskSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin(`playground-sandbox-${Date.now()}`));
  }
}

export async function run(log: Log) {
  const store = new TaskStore();
  showInDevtools(store, "Sandbox");

  await store.tasks.addAsync(
    { title: "Write the schema", priority: 1, done: true },
    { title: "Try a query", priority: 2 },
    { title: "Edit this file and press Run", priority: 3 },
  );
  await store.saveChangesAsync();

  const open = await store.tasks.where(t => !t.done).sort(t => t.priority).toArrayAsync();
  log("Open tasks, by priority", open.map(t => t.title));

  log("Done", await store.tasks.where(t => t.done).countAsync());
}
