const data = useQuery((callback) => {
  const sub = dataStore.products.subscribe();
  const unsub = sub.onChange(() => sub.toArray(callback));
  sub.toArray(callback);

  return unsub; // Cleanup function
}, []);