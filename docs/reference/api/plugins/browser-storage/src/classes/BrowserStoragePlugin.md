[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/browser-storage/src](../README.md) / BrowserStoragePlugin

# Class: BrowserStoragePlugin

Defined in: [plugins/browser-storage/src/BrowserStoragePlugin.ts:30](https://github.com/Agrejus/routier/blob/main/plugins/browser-storage/src/BrowserStoragePlugin.ts#L30)

## Extends

- `EphemeralDataPlugin`

## Constructors

### Constructor

> **new BrowserStoragePlugin**(`databaseName`, `storage`): `BrowserStoragePlugin`

Defined in: [plugins/browser-storage/src/BrowserStoragePlugin.ts:34](https://github.com/Agrejus/routier/blob/main/plugins/browser-storage/src/BrowserStoragePlugin.ts#L34)

#### Parameters

##### databaseName

`string`

##### storage

`Storage`

#### Returns

`BrowserStoragePlugin`

#### Overrides

`EphemeralDataPlugin.constructor`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: core/dist/plugins/EphemeralDataPlugin.d.ts:14

See `IDbPlugin.databaseName`. A getter rather than the field itself so a subclass whose
database is identified by more than a name can widen it — `FileSystemPlugin` returns the
resolved file path, because one name in two directories is two databases.

##### Returns

`string`

#### Inherited from

`EphemeralDataPlugin.databaseName`

## Methods

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/browser-storage/src/BrowserStoragePlugin.ts:56](https://github.com/Agrejus/routier/blob/main/plugins/browser-storage/src/BrowserStoragePlugin.ts#L56)

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`EphemeralDataPlugin.destroy`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: core/dist/plugins/EphemeralDataPlugin.d.ts:30

All-or-nothing across every collection in the save.

The naive shape — validate/apply/save one schema at a time — leaks partial saves:
a conflict in the SECOND collection left the first collection's changes applied
(measured in the finance stress app as one orphan ledger row per conflict). So the
work is phased: every collection loads and validates BEFORE anything is applied,
mutations apply with an undo log, and a failure anywhere reverts the memory state
(and re-saves any files already written) so the caller sees a save that did nothing.

The remaining honesty gap is crash-safety across FILES: a process dying between two
file writes can leave disk partially updated. Guarding that needs a journal, which
a memory-first plugin does not pretend to have.

#### Parameters

##### event

`DbPluginBulkPersistEvent`

##### done

`PluginEventCallbackPartialResult`\<`BulkPersistResult`\>

#### Returns

`void`

#### Inherited from

`EphemeralDataPlugin.bulkPersist`

***

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: core/dist/plugins/EphemeralDataPlugin.d.ts:66

Executes a query operation on the database.

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TEntity`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TEntity`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Inherited from

`EphemeralDataPlugin.query`
