import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Schema for in-memory caching
const cacheSchema = s
  .define("cache", {
    id: s.string().key().identity(),
    key: s.string().distinct(),
    value: s.string(),
    updatedAt: s.date().default(() => new Date()),
  })
  .compile();

// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }

  cache = this.collection(cacheSchema).create();
}