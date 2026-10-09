import { DataStore } from "@routier/datastore";
import { BrowserStoragePlugin } from "@routier/browser-storage-plugin";
import { s } from "@routier/core/schema";
import { showInDevtools } from "../devtools";

type Log = (message: string, value?: unknown) => void;

const visitSchema = s
  .define("visits", {
    id: s.string().key().identity(),
    at: s.date().default(() => new Date()),
  })
  .compile();

class VisitStore extends DataStore {
  visits = this.collection(visitSchema).proxy().create();

  constructor() {
    super(new BrowserStoragePlugin("playground-visits", window.localStorage));
  }
}

export async function run(log: Log) {
  const store = new VisitStore();
  showInDevtools(store, "localStorage");

  await store.visits.addAsync({});
  await store.saveChangesAsync();

  const visits = await store.visits.sortDescending(v => v.at).toArrayAsync();
  log(`You have run this ${visits.length} time(s). Reload the page and run it again.`);
  log("Most recent runs", visits.slice(0, 5).map(v => v.at.toLocaleString()));
}
