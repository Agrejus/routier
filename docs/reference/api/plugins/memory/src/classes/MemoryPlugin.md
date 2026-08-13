[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/memory/src](../README.md) / MemoryPlugin

# Class: MemoryPlugin

Defined in: [plugins/memory/src/MemoryPlugin.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L9)

## Extends

- `EphemeralDataPlugin`

## Constructors

### Constructor

> **new MemoryPlugin**(`databaseName?`): `MemoryPlugin`

Defined in: [plugins/memory/src/MemoryPlugin.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L11)

#### Parameters

##### databaseName?

`string`

#### Returns

`MemoryPlugin`

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

***

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [plugins/memory/src/MemoryPlugin.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L19)

##### Returns

`number`

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

### getCollectionSize()

> **getCollectionSize**(`collectionName`): `number`

Defined in: [plugins/memory/src/MemoryPlugin.ts:42](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L42)

#### Parameters

##### collectionName

`string`

#### Returns

`number`

***

### seed()

> **seed**\<`TEntity`\>(`schema`, `data`): `void`

Defined in: [plugins/memory/src/MemoryPlugin.ts:51](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L51)

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

#### Parameters

##### schema

`CompiledSchema`\<`TEntity`\>

##### data

`Record`\<`string`, `unknown`\>[]

#### Returns

`void`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/memory/src/MemoryPlugin.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/memory/src/MemoryPlugin.ts#L66)

Clears the named database — for EVERY plugin instance using that name, not just this one.

The registry is keyed by database name and shared process-wide, which is what makes two
`MemoryPlugin("app")` instances behave like two connections to one database. The other
side of that: destroy is not scoped to the instance it is called on. A test that
destroys its store empties the database out from under every other store that named it.

Give each test its own database name if they run in one process.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`EphemeralDataPlugin.destroy`
