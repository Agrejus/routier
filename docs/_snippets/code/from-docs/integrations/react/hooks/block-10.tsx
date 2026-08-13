import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function DeferredNotifications() {
  const dataStore = useDataStore();

  // Only shows NEW notifications after component mounts
  // Ignores historical notifications
  const notifications = useQuery(
    (callback) => dataStore.notifications.subscribe().defer().toArray(callback),
    []
  );

  if (notifications.status === "pending") {
    return <div>Waiting for new notifications...</div>;
  }

  if (notifications.status === "error") {
    return <div>Error loading notifications</div>;
  }

  return (
    <div>
      <h2>New Notifications</h2>
      {notifications.data?.length === 0 ? (
        <p>No new notifications</p>
      ) : (
        <ul>
          {notifications.data?.map((notif) => (
            <li key={notif.id}>{notif.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
