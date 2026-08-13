# RelayOps dogfood application

A fictitious managed-service operations product built as a realistic Routier integration test. It is a React SPA with a Node/Express backend and five interchangeable storage modes.

## Run

From the repository root:

```bash
npm run dev --prefix examples/relayops
```

Open <http://127.0.0.1:5198>. Use **Storage lab** in the sidebar to switch between:

- `MemoryPlugin`
- `BrowserStoragePlugin` (`localStorage`)
- `DexiePlugin` (IndexedDB)
- `PouchDbPlugin`
- `HttpTransportDbPlugin` → Express → `FileSystemPlugin`

The remote backend persists under `examples/relayops/.data/`.

## Routier surface exercised

- React `useQuery` live subscriptions and cleanup
- Proxy, diff, immutable, and readonly collections
- Adds, tracked updates, immutable recipes, soft deletes, and operation tags
- Parameterized filters, sorting, skip/take, counts, min/max/sum/distinct
- Left joins across customers and work orders
- Full-text search and vector nearest-neighbor queries
- Searchable, vector, array, date, nullable, identity, and foreign-key schema properties
- Automatic audit rows in the same save as work-order changes
- Runtime plugin swapping without changing domain or UI code
- Serialized query/write transport to a Routier-backed server

## Suggested smoke test

1. Open Work orders and search/filter the live board.
2. Create a work order, edit its status, add a note, and archive another.
3. Open Customers (left join), Knowledge (full-text and vector search), and Analytics (aggregates).
4. Check the audit trail in Storage lab.
5. Repeat in each backend and reload durable modes to verify persistence.
