[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / DirectUploadPlugin

# Class: DirectUploadPlugin

Defined in: [plugins/blob/src/DirectUploadPlugin.ts:33](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/DirectUploadPlugin.ts#L33)

Uploads staged `s.file()` content through short-lived signed URLs before an inner plugin saves.

This is the browser-safe counterpart to `S3Plugin`. It holds no S3 credentials. The
`requestUpload` callback asks trusted server code for a grant, the browser sends the bytes
directly to object storage, and the inner plugin receives only a JSON-safe `FileReference`.
That makes it compose naturally with `HttpTransportDbPlugin`, `HttpSwrDbPlugin`, or another
HTTP-backed Routier plugin.

```ts
const plugin = new DirectUploadPlugin(
    new HttpTransportDbPlugin({ url: '/api/routier' }),
    {
        requestUpload: request => fetch('/api/uploads/sign', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        }).then(response => response.json()),
    }
);

await store.documents.addAsync({ title: 'Report', file });
await store.saveChangesAsync(); // signs, uploads, then sends the row over HTTP
```

## Extends

- [`BlobDbPlugin`](BlobDbPlugin.md)\<[`DirectUploader`](../type-aliases/DirectUploader.md)\>

## Constructors

### Constructor

> **new DirectUploadPlugin**(`plugin`, `options`): `DirectUploadPlugin`

Defined in: [plugins/blob/src/DirectUploadPlugin.ts:34](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/DirectUploadPlugin.ts#L34)

#### Parameters

##### plugin

`IDbPlugin`

##### options

[`DirectUploaderOptions`](../type-aliases/DirectUploaderOptions.md)

#### Returns

`DirectUploadPlugin`

#### Overrides

[`BlobDbPlugin`](BlobDbPlugin.md).[`constructor`](BlobDbPlugin.md#constructor)

## Properties

### files

> `readonly` **files**: `object`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:53](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L53)

#### upload()

> **upload**(`content`, `uploadOptions`): `Promise`\<`FileReferenceValue`\>

Hashes, asks for a grant, uploads if needed, and returns the reference.

Skips the transfer entirely when the server says the content is already stored.

##### Parameters

###### content

[`FileContent`](../type-aliases/FileContent.md)

###### uploadOptions

[`UploadOptions`](../type-aliases/UploadOptions.md) = `{}`

##### Returns

`Promise`\<`FileReferenceValue`\>

#### Inherited from

[`BlobDbPlugin`](BlobDbPlugin.md).[`files`](BlobDbPlugin.md#files)

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:56](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L56)

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

#### Inherited from

[`BlobDbPlugin`](BlobDbPlugin.md).[`databaseName`](BlobDbPlugin.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:60](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L60)

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

#### Inherited from

[`BlobDbPlugin`](BlobDbPlugin.md).[`query`](BlobDbPlugin.md#query)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:69](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L69)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Inherited from

[`BlobDbPlugin`](BlobDbPlugin.md).[`destroy`](BlobDbPlugin.md#destroy)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:76](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L76)

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

#### Inherited from

[`BlobDbPlugin`](BlobDbPlugin.md).[`bulkPersist`](BlobDbPlugin.md#bulkpersist)
