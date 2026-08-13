function useQuery<T>(
  subscribe: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps?: any[]
): LiveQueryState<T>;