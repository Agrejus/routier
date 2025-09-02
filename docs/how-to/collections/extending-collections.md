## Extending Collections

You can extend a generated collection to add domain-specific helpers while preserving typing and change tracking.

### Example

```ts
import { DataStore } from "routier";
import { IDbPlugin } from "routier-core/plugins";
import { InferCreateType } from "routier-core/schema";
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
```

### Notes

- The `create((Instance, ...args) => new class extends Instance { ... })` pattern ensures the subclass receives the same constructor args and types as the base collection.
- Prefer adding cohesive, high-level helpers (e.g. `addPerformanceAsync`, `addWithDefaults`, `bulkImportAsync`).
- All base collection methods remain available (`where`, `map`, `toArrayAsync`, `saveChangesAsync`, attachments, etc.).

### When to use

- Encapsulate repeated collection-specific operations.
- Provide intent-revealing APIs for your domain while keeping the underlying query and persistence behavior.
