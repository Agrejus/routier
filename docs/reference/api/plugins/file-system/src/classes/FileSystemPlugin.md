[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/file-system/src](../README.md) / FileSystemPlugin

# Class: FileSystemPlugin

Defined in: [plugins/file-system/src/FileSystemPlugin.ts:25](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/file-system/src/FileSystemPlugin.ts#L25)

## Extends

- `EphemeralDataPlugin`

## Constructors

### Constructor

> **new FileSystemPlugin**(`path`, `databaseName`): `FileSystemPlugin`

Defined in: [plugins/file-system/src/FileSystemPlugin.ts:29](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/file-system/src/FileSystemPlugin.ts#L29)

#### Parameters

##### path

`string`

##### databaseName

`string`

#### Returns

`FileSystemPlugin`

#### Overrides

`EphemeralDataPlugin.constructor`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/file-system/src/FileSystemPlugin.ts:53](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/file-system/src/FileSystemPlugin.ts#L53)

The resolved path, not the bare file name: `orders.json` in two directories is two
databases, and scoping subscriptions by the name alone would let them notify each other.
Same value as the registry key, which is the same question asked about collections.

##### Returns

`string`

#### Overrides

`EphemeralDataPlugin.databaseName`

## Methods

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

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/file-system/src/FileSystemPlugin.ts:87](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/file-system/src/FileSystemPlugin.ts#L87)

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`EphemeralDataPlugin.destroy`
