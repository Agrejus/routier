[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / FileUploader

# Type Alias: FileUploader

> **FileUploader** = `Pick`\<[`Files`](Files.md), `"upload"`\>

Defined in: [plugins/blob/src/BlobDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L47)

Turns file content into a file reference on the way to your real plugin.

`s.file()` accepts content and stores a reference. This is what performs that swap, and it
is the only place it can happen: the generated `preprocess` is synchronous and is called
from the change tracker and the broadcast path, so it cannot await an upload. `bulkPersist`
can.

```ts
class AppStore extends DataStore {
    documents = this.collection(documentSchema).proxy().create();
    constructor() {
        super(new BlobDbPlugin(new DexiePlugin('app'), files));
    }
}

await store.documents.addAsync({ title: 'Q3', file: fileFromInput });
await store.saveChangesAsync();   // uploads, then writes the row
```

## Uploads happen before the rows, and are not part of their transaction

They cannot be. A blob store has no transaction to enlist in, so "both or neither" is not
available at any price. What this does instead is order the failure: content is uploaded
first, and only then are the rows handed to the inner plugin inside its own transaction. A
save that fails after an upload leaves an orphan, which costs storage and breaks nothing
and `sweepOrphans` collects. The other order would leave a row pointing at bytes that were
never written.

Uploads are idempotent because keys are content-addressed, so a retried save re-uploads
nothing.
