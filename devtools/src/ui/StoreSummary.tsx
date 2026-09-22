import type { InspectedPlugin } from "@routier/datastore";

interface StoreSummaryProps {
  plugin: InspectedPlugin;
}

export function StoreSummary({ plugin }: StoreSummaryProps) {
  return (
    <div class="store-summary" aria-label="Storage" title={`${plugin.name} · ${plugin.databaseName}`}>
      <span class="plugin-name">{plugin.name}</span>
      <span class="database-name">{plugin.databaseName}</span>
    </div>
  );
}
