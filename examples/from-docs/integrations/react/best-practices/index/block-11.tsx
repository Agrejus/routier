import { useState, useEffect } from "react";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function SearchableProducts() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const products = useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(debouncedSearch))
        .subscribe()
        .toArray(cb),
    [debouncedSearch]
  );

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      {/* Render products */}
    </>
  );
}