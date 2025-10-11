import { DataStore } from "@routier/datastore";
import { IDbPlugin } from "@routier/core/plugins";
import { InferCreateType } from "@routier/core/schema";
import { simple } from "./schemas"; // your compiled schema

class GenericDataStore extends DataStore {
  constructor(plugin: IDbPlugin) {
    super(plugin);
  }

  // Create a strongly-typed collection and extend it inline
  simple = this.collection(simple).create((Instance, ...args) => {
    return new (class extends Instance {
      constructor() {
        super(...args);
      }

      async addPerformanceAsync(...entities: InferCreateType<typeof simple>[]) {
        const result = await super.addAsync(...entities);
        return result;
      }
    })();
  });
}