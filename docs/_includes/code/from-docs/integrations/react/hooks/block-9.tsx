import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function OneTimeQuery() {
  const dataStore = useDataStore();

  // This query runs ONCE and never updates
  // Perfect for static configuration or initial data that won't change
  const config = useQuery(
    (callback) => dataStore.settings.toArray(callback), // No .subscribe()
    []
  );

  if (config.status === "pending") return <div>Loading config...</div>;
  if (config.status === "error") return <div>Error loading config</div>;

  return (
    <div>
      <h1>App Configuration</h1>
      <p>Theme: {config.data?.[0]?.theme}</p>
      <p>Language: {config.data?.[0]?.language}</p>
    </div>
  );
}
