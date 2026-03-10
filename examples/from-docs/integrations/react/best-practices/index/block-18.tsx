function ConditionalQuery({ userId }: { userId?: string }) {
  const dataStore = useDataStore();

  const orders = useQuery(
    (cb) => {
      if (!userId) return; // Skip query
      return dataStore.orders
        .where((o) => o.userId === userId)
        .subscribe()
        .toArray(cb);
    },
    [userId]
  );

  if (!userId) return <div>Please select a user</div>;
  // Rest of component...
}