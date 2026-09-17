// #region focus
import { useState } from "react";
import { useQuery } from "@routier/react";
import { store, type Product } from "./inventory";

export function ProductGrid() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const rows = useQuery<Product[]>(
    onResult =>
      store.products
        .sort(p => p.name)
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .subscribe()
        .toArray(onResult),
    [page, pageSize],
  );
// #endregion focus

// #region below
  const total = useQuery<number>(onResult => store.products.subscribe().count(onResult), []);
  const count = total.status === "success" ? total.data : 0;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const restock = async (product: Product) => {
    product.stock += 10;
    await store.saveChangesAsync();
  };

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.status === "error" && (
            <tr>
              <td colSpan={5}>{String(rows.error)}</td>
            </tr>
          )}
          {rows.status === "success" &&
            rows.data.map(product => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>${product.price.toFixed(2)}</td>
                <td>{product.stock}</td>
                <td>
                  <button onClick={() => restock(product)}>+10</button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <footer>
        <select
          value={pageSize}
          onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
        >
          <option value={6}>6 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
        </select>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
          ‹
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>
          ›
        </button>
      </footer>
    </>
  );
}
// #endregion below
