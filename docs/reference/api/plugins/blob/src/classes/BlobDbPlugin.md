[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / BlobDbPlugin

# Class: BlobDbPlugin

Defined in: [plugins/blob/src/BlobDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L47)

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

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new BlobDbPlugin**(`plugin`, `files`): `BlobDbPlugin`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:49](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L49)

#### Parameters

##### plugin

`IDbPlugin`

##### files

###### store

[`BlobStore`](../interfaces/BlobStore.md)

The store these files live in, for callers that need to reach it directly.

###### upload

###### createUploadUrl

###### bytes

###### text

###### url

###### sweepOrphans

#### Returns

`BlobDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:54](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L54)

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:58](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L58)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:67](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L67)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:74](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/BlobDbPlugin.ts#L74)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

`DbPluginBulkPersistEvent`

The bulk operations event containing schema, parent, and changes.

##### done

`PluginEventCallbackPartialResult`\<`BulkPersistResult`\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.bulkPersist`
