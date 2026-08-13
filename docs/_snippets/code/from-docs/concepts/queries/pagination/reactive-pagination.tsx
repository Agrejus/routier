import { useState } from "react";
import { useQuery } from "@routier/react";
import { useDataStore } from "../../useDataStore";

export function ProductsPage() {
  const store = useDataStore(); // Keep this instance stable (Context or useMemo).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const products = useQuery(
    callback =>
      store.products
        .sort(product => product._id)
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .subscribe()
        .toArray(callback),
    [store, page, pageSize],
  );

  if (products.status === "pending") return <p>Loading…</p>;
  if (products.status === "error") return <p>{String(products.error)}</p>;

  return (
    <>
      <select
        value={pageSize}
        onChange={event => {
          setPageSize(Number(event.target.value));
          setPage(1);
        }}
      >
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
      </select>

      {products.data.map(product => <div key={product._id}>{product.name}</div>)}

      <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>
        Previous
      </button>
      <span>Page {page}</span>
      <button onClick={() => setPage(value => value + 1)}>Next</button>
    </>
  );
}
