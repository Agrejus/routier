# @routier/file-system-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by JSON files on disk. One directory per database, one file per
collection.

```ts
import { DataStore } from "@routier/datastore";
import { FileSystemPlugin } from "@routier/file-system-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new FileSystemPlugin("./data", "my-database"));
  }
}
```

Files land in `./data/my-database/<collection>.json`.

## Contracts

### Durability

A save writes a temporary file and renames it over the target. `rename` is atomic on POSIX,
so a reader or a crash sees the old file or the new one, never a torn write. The plugin also
calls `fsync` on the temporary file before the rename, so the contents reach the disk before
the name does.

The whole collection is rewritten on every save. Cost grows with collection size, not with
the number of changed rows.

### Process boundary — single process

**A file-system database belongs to one process.** After the first read the in-memory view is
authoritative and the files are write-only. Rows another process writes are never observed,
and two processes writing one database overwrite each other's files.

There is no lock file and no detection. If you need several processes, use a real database.

### Concurrency within one process

Safe. One collection instance per resolved file path is shared process-wide, so overlapping
saves mutate the same view and each rename writes a complete snapshot that is a superset of
the last.

### Schema migration

None. The plugin stores whole entities as JSON. A renamed or removed property does not rewrite
what is on disk.

### Corrupt files

A file that does not hold valid JSON fails the load with the parse error. The plugin does not
overwrite it. An empty file is a valid empty collection.

### Disposal

Call `store.destroyAsync()` to remove the database directory. The plugin refuses to remove a
path that does not resolve to a direct child of the configured directory — an empty or
`..`-containing database name would otherwise target the parent and take every other database
with it.

The plugin holds no long-lived handles: each read and write opens and closes its own.

### Failure semantics

A failed save leaves the previous file in place. The plugin reports the underlying `fs` error:
a full disk, a permissions failure, or a missing parent directory.

## Supported versions

Node 18 or later. Uses `node:fs` only.

## See also

- [File system plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/file-system/README)
