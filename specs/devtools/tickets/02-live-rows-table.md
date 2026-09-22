# 02: Live rows table

**Spec:** `specs/devtools.md`

**What to build:** a developer sees each collection's row count in the drawer, opens a collection, pages through its rows 50 at a time, and watches the table and counts update as data changes, without the app stuttering or ever seeing a devtools error.

**Blocked by:** 01

**Status:** done

- [x] `InspectedCollection.count()` returns the row count using the existing `countAsync`
- [x] `InspectedCollection.watchPage({ skip, take }, onRows)` delivers the page using the existing public `subscribe`, `skip`, and `take`, fires again after a save, and stops after its unsubscribe function is called
- [x] The sidebar shows a row count per collection and view, updated live
- [x] Opening a collection shows a table of its first 50 rows; next and previous controls reach every page
- [x] Nothing loads a whole collection
- [x] A save, a sync, or a cross-tab change updates the open table and the counts
- [x] A burst of changes produces at most one re-render per animation frame
- [x] Only the selected collection's current page is subscribed, and only while the drawer is open
- [x] Loading, empty-store, empty-collection, and error states are each shown distinctly
- [x] A failing count or page query shows an error in the drawer, is logged through the Routier logger, and never throws into the app
- [x] Tests at both seams cover every criterion above
