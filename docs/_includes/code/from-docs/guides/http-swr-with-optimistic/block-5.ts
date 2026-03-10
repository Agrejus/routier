import type { SchemaPersistChanges } from "@routier/core/collections";
import type { CompiledSchema } from "@routier/core/schema";
import type { UnknownRecord } from "@routier/core/utilities";

class SwrPluginWithCustomFormat extends HttpSwrDbPlugin {
  protected override formatRequestBody(changes: SchemaPersistChanges<UnknownRecord>, schema: CompiledSchema<UnknownRecord>) {
    const { adds, updates, removes } = changes;
    const keysToStrip = new Set<string>(); // e.g. schema properties tagged client-only
    const strip = (r: UnknownRecord) => {
      const out = { ...r };
      keysToStrip.forEach((k) => delete out[k]);
      return out;
    };
    return JSON.stringify({
      adds: adds.map((r) => strip(r as UnknownRecord)),
      updates: updates.map((u) => strip(u.entity as UnknownRecord)),
      removes: removes.map((r) => strip(r as UnknownRecord)),
    });
  }
}