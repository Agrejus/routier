# 03: Row detail

**Spec:** `specs/devtools.md`

**What to build:** a developer selects a row and sees its full value, with nested fields readable and every value shown as the app sees it, including decrypted fields.

**Blocked by:** 02

**Status:** done

- [x] Selecting a row shows its full value, including nested objects and arrays
- [x] Values are shown exactly as the app reads them (decrypted fields appear decrypted)
- [x] Dates, `BigInt`, `Map`, `Set`, typed arrays, and binary values render as readable text
- [x] A value that refers to itself renders as `[Circular]` and does not crash the drawer
- [x] The open row updates when that row changes, and shows that it was removed when it is removed
- [x] Tests at the `mountRoutierDevtools` seam cover every criterion above
