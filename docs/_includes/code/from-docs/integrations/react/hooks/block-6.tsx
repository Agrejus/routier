import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function RecentOrders({ days }: { days: number }) {
  const dataStore = useDataStore();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Query with pagination
  const orders = useQuery(
    (callback) =>
      dataStore.orders
        .where((o) => o.createdAt >= cutoffDate)
        .subscribe()
        .sort((o) => o.createdAt)
        .take(10)
        .toArray(callback),
    [dataStore, cutoffDate, days] // Re-run when store or days changes
  );

  if (orders.status === "pending") return <div>Loading recent orders...</div>;
  if (orders.status === "error") return <div>Error loading orders</div>;

  return (
    <div>
      <h2>Recent Orders (Last {days} days)</h2>
      <ul>
        {orders.status === "success" &&
          orders.data.map((order) => (
            <li key={order.id}>
              {order.total} - {new Date(order.createdAt).toLocaleDateString()}
            </li>
          ))}
      </ul>
    </div>
  );
}
