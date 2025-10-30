import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function CustomSubscription() {
  const dataStore = useDataStore();

  // Custom subscription with explicit cleanup
  const data = useQuery(
    (callback) => {
      const subscription = dataStore.products.subscribe();

      // Set up an onChange handler
      const unsubscribe = subscription.onChange(() => {
        subscription.toArray(callback);
      });

      // Initial data fetch
      subscription.toArray(callback);

      // Return cleanup function
      return unsubscribe;
    },
    [dataStore]
  );

  if (data.status === "pending") return <div>Loading...</div>;
  if (data.status === "error") return <div>Error</div>;

  return <div>{data.data?.length} products</div>;
}
