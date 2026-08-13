import { Suspense, use, useState } from "react";
import { useDataStore } from "../../useDataStore";

type AppDataStore = ReturnType<typeof useDataStore>;

function loadPage(store: AppDataStore, page: number, pageSize: number) {
  return store.products
    .sort(product => product._id)
    .skip((page - 1) * pageSize)
    .take(pageSize)
    .toArrayAsync();
}

type PagePromise = ReturnType<typeof loadPage>;

function ProductRows({ pagePromise }: { pagePromise: PagePromise }) {
  // React shows the nearest Suspense fallback until this Promise resolves.
  const products = use(pagePromise);

  return products.map(product => (
    <div key={product._id}>{product.name}</div>
  ));
}

export function SuspenseProductsPage() {
  const store = useDataStore(); // Keep this instance stable (Context or useMemo).
  const [request, setRequest] = useState(() => ({
    page: 1,
    pageSize: 20,
    promise: loadPage(store, 1, 20),
  }));

  function showPage(page: number, pageSize: number) {
    // Create the Promise in the event/state update, not in ProductRows' render.
    setRequest({ page, pageSize, promise: loadPage(store, page, pageSize) });
  }

  return (
    <>
      <select
        value={request.pageSize}
        onChange={event => showPage(1, Number(event.target.value))}
      >
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
      </select>

      <Suspense fallback={<p>Loading page…</p>}>
        <ProductRows pagePromise={request.promise} />
      </Suspense>

      <button
        disabled={request.page === 1}
        onClick={() => showPage(request.page - 1, request.pageSize)}
      >
        Previous
      </button>
      <span>Page {request.page}</span>
      <button onClick={() => showPage(request.page + 1, request.pageSize)}>
        Next
      </button>
    </>
  );
}
