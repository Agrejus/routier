import { useEffect, useMemo, useRef, useState } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { InferType, s } from "@routier/core/schema";
import { useQuery, type LiveQueryState } from "@routier/react";

const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    stock: s.number(),
    updatedAt: s.date().default(() => new Date()),
  })
  .compile();

type Product = InferType<typeof productSchema>;

class InventoryStore extends DataStore {
  products = this.collection(productSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin("playground-grid"));
  }
}

type SortKey = "name" | "category" | "price" | "stock" | "updatedAt";
type Filters = { category: string; search: string };

const SORT_SELECTORS: Record<SortKey, (p: Product) => Product[keyof Product]> = {
  name: p => p.name,
  category: p => p.category,
  price: p => p.price,
  stock: p => p.stock,
  updatedAt: p => p.updatedAt,
};

// One parameterized filter covers every combination of search box and category menu.
function matching(store: InventoryStore, filters: Filters) {
  return store.products.where(
    ([p, params]) =>
      (params.category === "All" || p.category === params.category) &&
      p.name.toLowerCase().includes(params.search),
    { category: filters.category, search: filters.search.trim().toLowerCase() },
  );
}

export function LiveGrid() {
  const store = useMemo(() => new InventoryStore(), []);
  const [filters, setFilters] = useState<Filters>({ category: "All", search: "" });
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "name", descending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [simulating, setSimulating] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);

  useEffect(() => {
    void seed(store);
  }, [store]);

  // The visible page is a single live query: filter → sort → skip/take → subscribe.
  // Changing filters, sort, or page rebuilds it; saved data changes re-run it.
  const rows = useQuery<Product[]>(
    callback => {
      const query = matching(store, filters);
      const selector = SORT_SELECTORS[sort.key];
      const ordered = sort.descending ? query.sortDescending(selector) : query.sort(selector);

      return ordered
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .subscribe()
        .toArray(callback);
    },
    [store, filters, sort, page, pageSize],
  );

  // A second live query keeps the pager's total current.
  const total = useQuery<number>(
    callback => matching(store, filters).subscribe().count(callback),
    [store, filters],
  );

  const visible = useLastSuccess(rows, [] as Product[]);
  const count = useLastSuccess(total, 0);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  // Rows removed from under the last page: step back to a page that exists.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const { changed, refreshes } = useChangedRows(visible, JSON.stringify([filters, sort, page, pageSize]));

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (!simulating) return;

    const timer = setInterval(async () => {
      const message = await simulateTraffic(store, visibleRef.current);
      setActivity(current => [message, ...current].slice(0, 5));
    }, 900);

    return () => clearInterval(timer);
  }, [simulating, store]);

  const updateFilters = (next: Partial<Filters>) => {
    setFilters(current => ({ ...current, ...next }));
    setPage(1);
  };

  const toggleSort = (key: SortKey) => {
    setSort(current => ({ key, descending: current.key === key ? !current.descending : false }));
    setPage(1);
  };

  const addProduct = async () => {
    const [product] = await store.products.addAsync(makeProduct(1000 + Math.floor(Math.random() * 9000)));
    await store.saveChangesAsync();
    setActivity(current => [`You added ${product.name}`, ...current].slice(0, 5));
  };

  // Rows are change-tracked entities: mutate, then save.
  const adjustStock = async (product: Product, delta: number) => {
    product.stock = Math.max(0, product.stock + delta);
    product.updatedAt = new Date();
    await store.saveChangesAsync();
  };

  const remove = async (product: Product) => {
    await store.products.removeAsync(product);
    await store.saveChangesAsync();
  };

  const first = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);

  return (
    <div className="grid-demo">
      <div className="grid-toolbar">
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search products…"
          value={filters.search}
          onChange={e => updateFilters({ search: e.target.value })}
        />
        <select aria-label="Category" value={filters.category} onChange={e => updateFilters({ category: e.target.value })}>
          {["All", ...CATEGORIES].map(category => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <button type="button" onClick={addProduct}>
          + Add product
        </button>
        <button
          type="button"
          className={simulating ? "toggle is-on" : "toggle"}
          aria-pressed={simulating}
          onClick={() => setSimulating(on => !on)}
        >
          {simulating ? "■ Stop traffic" : "▶ Simulate traffic"}
        </button>
      </div>

      <div className="grid-scroll">
        <table className="grid">
          <thead>
            <tr>
              {COLUMNS.map(column => (
                <th
                  key={column.key}
                  className={column.numeric ? "numeric" : undefined}
                  aria-sort={sort.key === column.key ? (sort.descending ? "descending" : "ascending") : "none"}
                >
                  <button type="button" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    <span className="sort-indicator">{sort.key === column.key ? (sort.descending ? "▼" : "▲") : ""}</span>
                  </button>
                </th>
              ))}
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.status === "error" && (
              <tr>
                <td colSpan={6} className="grid-empty">
                  Error: {rows.error.message}
                </td>
              </tr>
            )}
            {rows.status === "success" && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="grid-empty">
                  No products match.
                </td>
              </tr>
            )}
            {visible.map(product => (
              <tr key={product.id} className={changed.has(product.id) ? "is-changed" : undefined}>
                <td>{product.name}</td>
                <td>
                  <span className="pill">{product.category}</span>
                </td>
                <td className="numeric">${product.price.toFixed(2)}</td>
                <td className="numeric">
                  <span className="stepper">
                    <button type="button" aria-label={`Decrease stock of ${product.name}`} onClick={() => adjustStock(product, -1)}>
                      −
                    </button>
                    <span className={product.stock < 5 ? "low-stock" : undefined}>{product.stock}</span>
                    <button type="button" aria-label={`Increase stock of ${product.name}`} onClick={() => adjustStock(product, 1)}>
                      +
                    </button>
                  </span>
                </td>
                <td className="numeric muted-cell">{new Date(product.updatedAt).toLocaleTimeString()}</td>
                <td className="numeric">
                  <button type="button" className="row-delete" aria-label={`Remove ${product.name}`} onClick={() => remove(product)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-footer">
        <span>
          {first}–{last} of {count}
          <span className="live-dot">● live · {refreshes} refreshes</span>
        </span>
        <span className="pager">
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map(size => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <button type="button" aria-label="First page" disabled={page === 1} onClick={() => setPage(1)}>
            «
          </button>
          <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ‹
          </button>
          <span className="page-label">
            Page {page} of {pageCount}
          </span>
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>
            ›
          </button>
          <button type="button" aria-label="Last page" disabled={page >= pageCount} onClick={() => setPage(pageCount)}>
            »
          </button>
        </span>
      </div>

      {activity.length > 0 && (
        <ul className="activity" aria-label="Recent changes">
          {activity.map((message, index) => (
            <li key={`${activity.length - index}-${message}`}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Product" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price", numeric: true },
  { key: "stock", label: "Stock", numeric: true },
  { key: "updatedAt", label: "Updated", numeric: true },
];

/** Keeps showing the last delivered data while a rebuilt query (new page, sort, filter) loads. */
function useLastSuccess<T>(state: LiveQueryState<T>, initial: T): T {
  const last = useRef(initial);

  if (state.status === "success") last.current = state.data;

  return last.current;
}

/** Demo chrome: flags rows whose values changed while the same page stayed on screen. */
function useChangedRows(rows: Product[], windowKey: string) {
  const signature = (p: Product) => `${p.name}|${p.price}|${p.stock}`;
  const previous = useRef({ rows, windowKey, signatures: new Map<string, string>() });
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [refreshes, setRefreshes] = useState(0);

  useEffect(() => {
    // Same delivery as last time (for example, only the page number changed so far).
    if (rows === previous.current.rows) return;

    const before = previous.current;
    previous.current = { rows, windowKey, signatures: new Map(rows.map(p => [p.id, signature(p)])) };

    // A different window is a new page, not a change to this one.
    if (before.windowKey !== windowKey) return;

    setRefreshes(n => n + 1);

    const ids = rows.filter(p => before.signatures.get(p.id) !== signature(p)).map(p => p.id);

    if (ids.length === 0) return;

    setChanged(new Set(ids));
    const timer = setTimeout(() => setChanged(new Set()), 1000);

    return () => clearTimeout(timer);
  }, [rows, windowKey]);

  return { changed, refreshes };
}

const CATEGORIES = ["Audio", "Cameras", "Computers", "Gaming", "Phones", "Wearables"];

const PRODUCT_NAMES: Record<string, string[]> = {
  Audio: ["Headphones", "Speaker", "Earbuds", "Soundbar"],
  Cameras: ["Mirrorless", "Action Cam", "Lens", "Tripod"],
  Computers: ["Laptop", "Monitor", "Keyboard", "Dock"],
  Gaming: ["Controller", "Headset", "Console", "Racing Wheel"],
  Phones: ["Smartphone", "Charger", "Case", "Power Bank"],
  Wearables: ["Smartwatch", "Fitness Band", "Smart Ring", "AR Glasses"],
};

const MODELS = ["Air", "Pro", "Max", "Mini", "Neo", "Ultra", "Lite", "Edge"];

function makeProduct(n: number) {
  const category = CATEGORIES[n % CATEGORIES.length];
  const names = PRODUCT_NAMES[category];

  return {
    name: `${names[Math.floor(n / CATEGORIES.length) % names.length]} ${MODELS[(n * 5) % MODELS.length]} ${100 + n}`,
    category,
    price: 19.99 + ((n * 37) % 480),
    stock: (n * 13) % 60,
  };
}

async function seed(store: InventoryStore) {
  if ((await store.products.countAsync()) > 0) return;

  await store.products.addAsync(...Array.from({ length: 240 }, (_, n) => makeProduct(n)));
  await store.saveChangesAsync();
}

/** Background writes. The grid never hears about them directly, only through its live queries. */
async function simulateTraffic(store: InventoryStore, visible: Product[]): Promise<string> {
  const roll = Math.random();

  if (roll < 0.25) {
    const [product] = await store.products.addAsync(makeProduct(1000 + Math.floor(Math.random() * 9000)));
    await store.saveChangesAsync();
    return `Added ${product.name}`;
  }

  // Favor rows on the current page so the live refresh is easy to see.
  const count = await store.products.countAsync();
  const [product] =
    visible.length > 0 && Math.random() < 0.7
      ? [visible[Math.floor(Math.random() * visible.length)]]
      : await store.products.sort(p => p.id).skip(Math.floor(Math.random() * count)).take(1).toArrayAsync();

  if (product == null) return "Nothing to change";

  if (roll < 0.9) {
    product.price = Math.round(product.price * (0.8 + Math.random() * 0.4) * 100) / 100;
    product.stock = Math.floor(Math.random() * 60);
    product.updatedAt = new Date();
    await store.saveChangesAsync();
    return `Updated ${product.name}: $${product.price.toFixed(2)}, ${product.stock} in stock`;
  }

  await store.products.removeAsync(product);
  await store.saveChangesAsync();
  return `Removed ${product.name}`;
}
