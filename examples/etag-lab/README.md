# ETag lab

A small React app and Express server that exercise Routier's etags end to end. Notes are stored in SQLite under this schema, and the server generates every version:

```ts
s.define('notes', {
  id: s.string().key(),
  title: s.string(),
  version: s.number().etag(etags.numeric),
});
```

## Run

From the repository root:

```bash
npm run build
npm run dev --prefix examples/etag-lab
```

Open <http://127.0.0.1:5199>. The database lives in `examples/etag-lab/.data/`. **Reset data** restores the seed notes.

The lab uses the built packages, as an application would, so run `npm run build` again after changing a package.

## Scenarios

| Tab | Client | What it shows |
| --- | --- | --- |
| Conflict | `ConcurrencyDbPlugin` over `HttpTransportDbPlugin` | Two clients edit one note. The second save carries the old version, and SQLite refuses it. |
| SWR + 304 | `HttpSwrDbPlugin` | The client sends `If-None-Match` and gets `304`. Another user's edit comes back as `200` with the newer version. A stale local edit is refused with `409`, and the next read takes the server copy. |
| Newest wins | `HttpSwrDbPlugin`, `conditionalRevalidation: false` | A lagging replica serves an older version. The client keeps its newer row. |
| Optimistic | `OptimisticUpdatesDbPlugin` over `HttpTransportDbPlugin` | The save returns at once at the old version. The memory copy then adopts the version the server generated. |

**On the wire** lists each request the server saw: `If-None-Match`, the status, the `ETag`, and the row versions sent back.

## Server

| Route | Purpose |
| --- | --- |
| `POST /routier` | `createRequestHandler` over the SQLite plugin, for `HttpTransportDbPlugin` |
| `GET /rest/notes` | Rows with a query `ETag`; `304` when `If-None-Match` matches; `Cache-Control: no-store` |
| `POST /rest/notes` | Edits only. Each edit must carry the version it was based on (`428` otherwise); a stale one gets `409` |
| `/admin/*` | Wire log, another user's edit, the lagging replica, and reset |

## Tests

```bash
npm test --prefix examples/etag-lab       # the server's HTTP contract
npm run test:ui --prefix examples/etag-lab  # every scenario, driven in Chrome
```

The UI tests use Chrome at `/usr/bin/google-chrome`, or `CHROME_PATH`. Without either, they use Playwright's Chromium (`npx playwright-core install chromium`).
