function useQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
  deps: any[] = []
): LiveQueryState<T>;