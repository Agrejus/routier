# 04: Lifecycle and multiple stores

**Spec:** `specs/devtools.md`

**What to build:** devtools behave safely across an app's whole life: hot reload, disposal, several stores, removal, and shared startup code that also runs on a server.

**Blocked by:** 01

**Status:** done

- [x] `inspect().disposed` is an `AbortSignal` that aborts when the store is disposed
- [x] When the store is disposed, the drawer shows "store disposed" and releases every subscription
- [x] Calling `mountRoutierDevtools` again with the same store does nothing
- [x] Mounting a second store adds it to the same drawer behind a store picker
- [x] `mountRoutierDevtools` returns an unmount function that removes the host element and every subscription
- [x] Without a `document` (server, Worker), mounting is a no-op and does not throw
- [x] Tests at both seams cover every criterion above
