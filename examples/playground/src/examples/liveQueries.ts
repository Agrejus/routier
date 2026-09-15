import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

type Log = (message: string, value?: unknown) => void;

const taskSchema = s
  .define("tasks", {
    id: s.string().key().identity(),
    title: s.string(),
    done: s.boolean().default(false),
  })
  .compile();

class TaskStore extends DataStore {
  tasks = this.collection(taskSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin(`playground-live-${Date.now()}`));
  }
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function run(log: Log) {
  const store = new TaskStore();

  // subscribe() makes the query live: the callback receives the current result now,
  // and again every time a saved change affects it.
  const unsubscribe = store.tasks
    .where(t => t.done === false)
    .subscribe()
    .toArray(result => {
      if (result.ok === "error") {
        log("Query failed", result.error);
        return;
      }

      log(`Live result: ${result.data.length} open task(s)`, result.data.map(t => t.title));
    });

  await pause(700);
  log("Adding two tasks…");
  const [docs, playground] = await store.tasks.addAsync(
    { title: "Write the docs" },
    { title: "Build the playground" },
  );
  await store.saveChangesAsync();

  await pause(700);
  log("Completing “Build the playground”…");
  playground.done = true;
  await store.saveChangesAsync();

  await pause(700);
  log("Removing “Write the docs”…");
  await store.tasks.removeAsync(docs);
  await store.saveChangesAsync();

  await pause(700);
  unsubscribe();
  log("Unsubscribed. Later changes no longer reach the callback.");
}
