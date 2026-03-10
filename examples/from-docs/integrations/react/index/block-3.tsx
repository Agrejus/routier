const result = useQuery(
  (callback) => collection.subscribe().toArray(callback),
  [
    /* dependencies */
  ]
);

// result.status: 'pending' | 'success' | 'error'
// result.loading: boolean
// result.error: Error | null
// result.data: T | undefined