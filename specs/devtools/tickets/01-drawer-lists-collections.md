# 01: Drawer lists collections

**Spec:** `specs/devtools.md`

**What to build:** a developer calls `mountRoutierDevtools(store)` once and gets a floating button that opens a resizable drawer listing every collection and view in the store, with views labelled as views. The drawer reads the store only through the new public `dataStore.inspect()`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `@routier/devtools` exists as a workspace package, registered as its own domain in the architecture manifest (it may import `@routier/core` and `@routier/datastore`), with its `DOMAIN.md` regenerated from the manifest and the architecture suite green
- [x] The package resolves in tests through the jest module mapping and the test tsconfig paths
- [x] The package builds with Preact bundled inside it, not as a peer dependency
- [x] `DataStore.inspect()` is added without changing any existing `DataStore` member, `IDbPlugin`, or existing export
- [x] `inspect().collections` lists every collection and view with `name`, `schemaId`, and `kind` (`"collection"` or `"view"`)
- [x] Nothing on the inspection object can change the store
- [x] `mountRoutierDevtools(store)` renders one host element with a shadow root; the app's CSS does not reach the drawer and the drawer's CSS does not reach the app
- [x] A floating toggle button opens and closes the drawer
- [x] The drawer can be resized
- [x] The drawer lists collections, and views in their own section labelled as views
- [x] Tests at the `inspect()` seam (memory plugin) and the `mountRoutierDevtools` seam (jsdom, querying the shadow root) cover every criterion above
