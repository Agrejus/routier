import { SchemaFunction } from './table/SchemaFunction';
import { SchemaComputed } from './table/SchemaComputed';
import { SchemaBase } from "./property/base/SchemaBase";
import { PropertyInfo } from './PropertyInfo';
import { CodeBuilder } from '../codegen';
import { EnrichmentHandlerBuilder } from '../codegen/handlers/EnrichmentHandlerBuilder';
import { MergeHandlerBuilder } from '../codegen/handlers/MergeHandlerBuilder';
import { PrepareHandlerBuilder } from '../codegen/handlers/PrepareHandlerBuilder';
import { StripHandlerBuilder } from '../codegen/handlers/StripHandlerBuilder';
import { CloneHandlerBuilder } from '../codegen/handlers/CloneHandlerBuilder';
import { CompareHandlerBuilder } from '../codegen/handlers/CompareHandlerBuilder';
import { DeserializeHandlerBuilder } from '../codegen/handlers/DeserializeHandlerBuilder';
import { HashTypeHandlerBuilder } from '../codegen/handlers/HashTypeHandlerBuilder';
import { IdSelectorHandlerBuilder } from '../codegen/handlers/IdSelectorHandlerBuilder';
import { HashHandlerBuilder } from '../codegen/handlers/HashHandlerBuilder';
import { EnableChangeTrackingHandlerBuilder } from '../codegen/handlers/EnableChangeTrackingHandlerBuilder';
import { FreezeHandlerBuilder } from '../codegen/handlers/FreezeHandlerBuilder';
import { SchemaError } from '../errors/SchemaError';
import { SerializeHandlerBuilder } from "../codegen/handlers/SerializeHandlerBuilder";
import { uuid, hash } from "../utilities";
import { CompiledSchema, GetHashTypeFunction, HashFunction, HashType, ICollectionSubscription, IdType, Index, InferCreateType, InferType, SchemaTypes, SubscriptionChanges } from './types';

type UniDirectionalSubscriptionPayload<T extends {}> = {
    id: string;
    changes: SubscriptionChanges<T>;
}

// This is intented to run the "OnMessage" event whenever we "send".  For context
// when we make a change, we query to see if we have any changes.  We need to run a fetch because we could have 
// many db sets
class CollectionSubscription<T extends {}> implements ICollectionSubscription<T> {

    private _channel;
    private _id = uuid();
    private _callback: ((changes: SubscriptionChanges<T>) => void) | null = null;

    constructor(id: number, signal?: AbortSignal) {
        // The id is the computed id from the collection.  We need a static id so we can communicate across different
        // instances of a data store
        this._channel = new BroadcastChannel(`__routier-unidirectional-subscription-channel-${id}`);
        this._channel.onmessage = (event: any) => {
            const message = event.data as UniDirectionalSubscriptionPayload<T>;
            if (message.id === this._id) {
                return;
            }

            if (this._callback != null) {
                this._callback(message.changes);
            }
        };

        if (signal) {
            signal.addEventListener("abort", () => {
                this[Symbol.dispose]();
            }, { once: true });
        }
    }

    send(changes: SubscriptionChanges<T>) {
        const message: UniDirectionalSubscriptionPayload<T> = {
            id: this._id,
            changes
        }
        this._channel.postMessage(message)
    }

    onMessage(callback: (changes: SubscriptionChanges<T>) => void) {
        this._callback = callback;
    }

    [Symbol.dispose](): void {
        this._channel.onmessage = null;
        this._channel.close();
        this._channel = null;
    }
}

export class SchemaDefinition<T extends {}> extends SchemaBase<T, any> {

    instance: T;
    type = SchemaTypes.Definition;
    collectionName: string;

    constructor(collectionName: string, schema: T) {
        super();
        this.collectionName = collectionName;
        this.instance = schema;
        this.isNullable = false;
        this.isOptional = false;
    }

    modify<R>(builder: (d: {
        function: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: string, injected: I) => UU, injected?: I) => SchemaFunction<UU, I, "unmapped">;
        computed: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: string, injected: I) => UU, injected?: I) => SchemaComputed<UU, I, "unmapped">;
    }) => R) {

        const b = {
            function: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: string, injected?: I) => UU, injected?: I) => new SchemaFunction<UU, I, "unmapped">(fn as any, injected),
            computed: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: string, injected?: I) => UU, injected?: I) => new SchemaComputed<UU, I, "unmapped">(fn as any, injected)
        }

        const r = builder(b)

        return new SchemaDefinition<R & T>(this.collectionName, { ...this.instance, ...r });
    }

    private _iterate(
        instance: SchemaBase<any, any>,
        callback: (property: PropertyInfo<any>) => void
    ) {
        const explore: {
            path: string | null;
            instance:
            | SchemaBase<any, any>
            | { [key: string]: SchemaBase<any, any> };
            parents: {
                schema: { [key: string]: SchemaBase<any, any> };
                propertyInfo: PropertyInfo<any>;
            }[];
            propertyInfo: PropertyInfo<any> | null;
        }[] = [
                { path: null, instance, parents: [], propertyInfo: null }
            ];
        const properties: PropertyInfo<any>[] = [];

        for (let i = 0; i < explore.length; i++) {
            const item = explore[i];

            if (item.instance.type === SchemaTypes.Definition) {
                explore.push({
                    path: null,
                    instance: item.instance.instance,
                    parents: [],
                    propertyInfo: null
                });
                continue;
            }

            const instanceObj = item.instance as {
                [key: string]: SchemaBase<any, any>;
            };
            for (const key in instanceObj) {
                const propertyInstance = instanceObj[key] as SchemaBase<any, any>;
                const previousParent =
                    item.parents.length === 0
                        ? null
                        : item.parents[item.parents.length - 1].propertyInfo;

                if (propertyInstance.type === SchemaTypes.Object) {
                    const propertyInfo = new PropertyInfo<any>(
                        propertyInstance,
                        key,
                        previousParent
                    );
                    explore.push({
                        path: [item.path, key].filter((w) => w != null).join("."),
                        instance: propertyInstance.instance,
                        parents: [
                            ...item.parents,
                            { schema: instanceObj, propertyInfo: propertyInfo }
                        ],
                        propertyInfo
                    });

                    if (previousParent === null) {
                        properties.push(propertyInfo);
                        continue;
                    }

                    previousParent.children.push(propertyInfo);
                    continue;
                }

                const childPrimitivePropertyInfo = new PropertyInfo<any>(
                    (item.instance as any)[key],
                    key,
                    previousParent
                );
                if (previousParent === null) {
                    properties.push(childPrimitivePropertyInfo);
                    continue;
                }

                previousParent.children.push(childPrimitivePropertyInfo);
            }
        }

        // Recursively trigger callbacks on properties and their children
        function recursiveCallback(prop: PropertyInfo<any>) {
            callback(prop);
            for (const child of prop.children) {
                recursiveCallback(child);
            }
        }

        for (const prop of properties) {
            recursiveCallback(prop);
        }
    }

    private createChangeTracker() {

        const DIRTY_ENTITY_MARKER: string = "isDirty";
        const CHANGES_ENTITY_KEY: string = "changes";
        const ORIGINAL_ENTITY_KEY: string = "original";
        const PAUSED_ENTITY_KEY: string = "isPaused";
        const TRACKING_KEY: string = "__tracking__";
        const PROXY_MARKER: string = "__isProxy__";

        return <TEntity extends {}>(entity: TEntity, path?: string, parent?: TEntity) => {

            const proxyHandler: ProxyHandler<TEntity> = {
                set: (entity, property, value) => {
                    const indexableEntity: { [key: string]: any } = entity;
                    const key = String(property);
                    const originalValue = indexableEntity[key];

                    // if values are the same, do nothing
                    if (originalValue === value) {
                        return true;
                    }

                    const resolvedParent: { [key: string]: any } = parent ?? entity;

                    if (resolvedParent[TRACKING_KEY] == null) {
                        resolvedParent[TRACKING_KEY] = {
                            [CHANGES_ENTITY_KEY]: {},
                            [DIRTY_ENTITY_MARKER]: false,
                            [ORIGINAL_ENTITY_KEY]: {},
                            [PAUSED_ENTITY_KEY]: false
                        }
                    }

                    if (key == TRACKING_KEY) {
                        return true;
                    }

                    if (resolvedParent[TRACKING_KEY] != null && resolvedParent[TRACKING_KEY][PAUSED_ENTITY_KEY] === true) {
                        Reflect.set(indexableEntity, property, value);
                        return true;
                    }

                    const resolvedPath = path == null ? key : `${path}.${key}`;
                    const changes = resolvedParent[TRACKING_KEY];

                    if (changes[CHANGES_ENTITY_KEY][resolvedPath] != null) {

                        if (changes[ORIGINAL_ENTITY_KEY][resolvedPath] === value) {
                            // we are changing the value back to the original value, remove the change
                            delete changes[ORIGINAL_ENTITY_KEY][resolvedPath];
                            delete changes[CHANGES_ENTITY_KEY][resolvedPath];
                        } else {
                            // track the change
                            changes[CHANGES_ENTITY_KEY][resolvedPath] = value;
                        }

                    } else if (changes[CHANGES_ENTITY_KEY][resolvedPath] == null) {
                        // don't keep updating, keep the original value
                        changes[CHANGES_ENTITY_KEY][resolvedPath] = value;
                        changes[ORIGINAL_ENTITY_KEY][resolvedPath] = originalValue;
                    }

                    const isDirty = Object.keys(changes[ORIGINAL_ENTITY_KEY]).length > 0;
                    changes[DIRTY_ENTITY_MARKER] = isDirty;

                    Reflect.set(indexableEntity, property, value);

                    return true;
                },
                get: (target, property, receiver) => {

                    if (property === PROXY_MARKER) {
                        return true;
                    }

                    return Reflect.get(target, property, receiver);
                }
            }

            return new Proxy(entity, proxyHandler) as TEntity
        }
    }

    compile(): CompiledSchema<T> {

        try {


            const schema = this;
            const properties: PropertyInfo<T>[] = [];
            const propertyMap: Map<string, PropertyInfo<T>> = new Map<string, PropertyInfo<T>>();

            const enrichmentHandlerBuilder = new EnrichmentHandlerBuilder();
            const mergeHandlerFactory = new MergeHandlerBuilder();
            const prepareHandlerBuilder = new PrepareHandlerBuilder();
            const stripHandlerBuilder = new StripHandlerBuilder();
            const cloneHandlerBuilder = new CloneHandlerBuilder();
            const compareHandlerBuilder = new CompareHandlerBuilder();
            const deserializeHandlerBuilder = new DeserializeHandlerBuilder();
            const hashTypeHandlerBuilder = new HashTypeHandlerBuilder();
            const idSelectorHandlerBuilder = new IdSelectorHandlerBuilder();
            const hashHandlerBuilder = new HashHandlerBuilder();
            const enableChangeTrackingHandlerBuilder = new EnableChangeTrackingHandlerBuilder();
            const freezeHandlerBuilder = new FreezeHandlerBuilder();
            const serializeHandlerBuilder = new SerializeHandlerBuilder();

            const enricher = enrichmentHandlerBuilder.build();
            const merge = mergeHandlerFactory.build();
            const prepare = prepareHandlerBuilder.build();
            const strip = stripHandlerBuilder.build();
            const clone = cloneHandlerBuilder.build();
            const compare = compareHandlerBuilder.build();
            const deserialize = deserializeHandlerBuilder.build();
            const hashTypeHandler = hashTypeHandlerBuilder.build();
            const idSelectorHandler = idSelectorHandlerBuilder.build();
            const hashHandler = hashHandlerBuilder.build();
            const enableChangeTrackingHandler = enableChangeTrackingHandlerBuilder.build();
            const freezeHandler = freezeHandlerBuilder.build();
            const serializeHandler = serializeHandlerBuilder.build();

            const changeTrackingCodeBuilder = new CodeBuilder();
            changeTrackingCodeBuilder.raw(`function ${this.createChangeTracker.toString()}`);
            changeTrackingCodeBuilder.slot("declarations").variable("enableChangeTracking").value('createChangeTracker()');
            changeTrackingCodeBuilder.slot("assignment");
            changeTrackingCodeBuilder.slot("return").raw('\treturn enableChangeTracking(entity);');

            const freezeCodeBuilder = new CodeBuilder();
            freezeCodeBuilder.slot("assignment");
            freezeCodeBuilder.slot("return").raw('\treturn Object.freeze(entity);');

            const enricherCodeBuilder = new CodeBuilder();
            const enricherFunctionRoot = enricherCodeBuilder.factory("factory", { name: "factory" }).parameters({ name: "collectionName", value: this.collectionName });
            const enricherFunctionBody = enricherFunctionRoot.function(undefined, { name: "function" }).parameters("entity", "changeTrackingType").return();

            enricherFunctionBody.raw(`function ${this.createChangeTracker.toString()}`);
            enricherFunctionBody.variable("enableChangeTracking").value('changeTrackingType === "entity" ? createChangeTracker() : e => e');

            enricherFunctionBody.slot("enriched");
            enricherFunctionBody.slot("declarations");
            enricherFunctionBody.slot("ifs");
            enricherFunctionBody.slot("assignment");
            enricherFunctionBody.slot("tracking").if('changeTrackingType === "immutable"', { name: "freeze" });
            enricherFunctionBody.raw('\treturn enableChangeTracking(enriched);');

            const mergeCodeBuilder = new CodeBuilder();

            const mergeFunctionRoot = mergeCodeBuilder.factory("factory", { name: "factory" }).parameters({ name: "collectionName", value: this.collectionName });
            const mergeFunctionBody = mergeFunctionRoot.function(undefined, { name: "function" }).parameters("destination", "source").return();

            const pauseFunctionBody = mergeFunctionBody.function("pause")
                .appendBody("// initiate change tracking if needed");

            pauseFunctionBody.if("destination.__tracking__ == null")
                .appendBody("destination.__tracking__ = {};");

            pauseFunctionBody.appendBody("destination.__tracking__.isPaused = true;");

            mergeFunctionBody.function("unpause")
                .appendBody("// unpause change tracking if needed")
                .if("destination.__tracking__ != null")
                .appendBody("destination.__tracking__.isPaused  = false;");

            mergeFunctionBody.slot("header").raw(`pause()`);
            mergeFunctionBody.slot("assignments");
            mergeFunctionBody.slot("ifs");
            mergeFunctionBody.slot("return").raw(`
    unpause();

    return destination;`);

            const prepareCodeBuilder = new CodeBuilder();
            prepareCodeBuilder.slot("result");
            prepareCodeBuilder.slot("assignments");
            prepareCodeBuilder.slot("return").raw(`     return result;`);

            const stripCodeBuilder = new CodeBuilder();
            stripCodeBuilder.slot("result");
            stripCodeBuilder.slot("return").raw(`     return result;`);

            const cloneCodeBuilder = new CodeBuilder();
            cloneCodeBuilder.slot("result");
            cloneCodeBuilder.slot("return").raw(`     return result;`);

            const compareCodeBuilder = new CodeBuilder();
            compareCodeBuilder.slot("result");
            compareCodeBuilder.slot("return").raw(`     return result;`);

            const deserializeCodeBuilder = new CodeBuilder();
            deserializeCodeBuilder.slot("result");
            deserializeCodeBuilder.slot("if");
            deserializeCodeBuilder.slot("return").raw(`     return result;`);

            const serializeCodeBuilder = new CodeBuilder();
            serializeCodeBuilder.slot("result");
            serializeCodeBuilder.slot("if");
            serializeCodeBuilder.slot("return").raw(`     return result;`);

            const idSelectorCodeBuilder = new CodeBuilder();
            idSelectorCodeBuilder.slot("result");
            idSelectorCodeBuilder.slot("return").raw(`     return result;`);

            const hashTypeCodeBuilder = new CodeBuilder();
            hashTypeCodeBuilder.slot("ifs");
            hashTypeCodeBuilder.slot("return").raw(`     return "Ids";`);

            const hashCodeBuilder = new CodeBuilder();
            hashCodeBuilder.slot("functions").raw(`
    function stringifyDate(d) {

        if (d == null) {
            return "";
        }

        if (typeof d === "string") {
            return d;
        }

        if (d.toISOString != null) {
            return d.toISOString();
        }

        return d.toString();
    } 
`);
            const hashCodeBuilderIfBlock = hashCodeBuilder.if(`type === "Ids"`, { name: "hash-id-if" });
            hashCodeBuilderIfBlock.slot("if-body");
            hashCodeBuilderIfBlock.appendBody("return result");
            hashCodeBuilder.slot("hash-object-return");
            hashCodeBuilder.raw(`   return result;`)

            const stringifier = new CodeBuilder();
            const returnObject = stringifier.object();

            const idProperties: PropertyInfo<any>[] = [];
            const allPropertyNamesAndPaths: string[] = [];
            let hashType: HashType = HashType.Ids;
            let hasIdentities = false;
            let hasIdentityKeys = false;

            this._iterate(schema, (property) => {

                properties.push(property);
                propertyMap.set(property.id, property);
                allPropertyNamesAndPaths.push(property.getSelectrorPath({ parent: "entity" }));

                // Check if the property or any parent is nullable/optional
                const isParentNullableOrOptional = property.hasNullableParents;
                const isPropertyNullableOrOptional = property.isNullable || property.isOptional || isParentNullableOrOptional;

                // Construct the selector path with or without null-safe operators
                const selectorPath = property.getSelectrorPath({ parent: "entity" });
                const name = property.name;

                if (property.isIdentity === true) {
                    hasIdentities = true;
                }

                if (property.isKey === true) {
                    idProperties.push(property);
                }

                if (property.isKey === true && property.isIdentity === true) {
                    hasIdentityKeys = true;
                }

                enricher.handle(property, enricherCodeBuilder);
                merge.handle(property, mergeCodeBuilder);
                prepare.handle(property, prepareCodeBuilder);
                strip.handle(property, stripCodeBuilder);
                clone.handle(property, cloneCodeBuilder);
                compare.handle(property, compareCodeBuilder);
                deserialize.handle(property, deserializeCodeBuilder);
                serializeHandler.handle(property, serializeCodeBuilder)
                hashTypeHandler.handle(property, hashTypeCodeBuilder);
                idSelectorHandler.handle(property, idSelectorCodeBuilder);
                hashHandler.handle(property, hashCodeBuilder);
                enableChangeTrackingHandler.handle(property, changeTrackingCodeBuilder);
                freezeHandler.handle(property, freezeCodeBuilder);
            });

            // console.log(prepareCodeBuilder.toString());
            // console.log(stripCodeBuilder.toString());
            // console.log(cloneCodeBuilder.toString());
            // console.log(compareCodeBuilder.toString());
            // console.log(deserializeCodeBuilder.toString());
            // console.log(hashTypeCodeBuilder.toString());
            // console.log(idSelectorCodeBuilder.toString());
            // console.log(enricherCodeBuilder.toString());
            // console.log(mergeCodeBuilder.toString());
            // console.log(changeTrackingCodeBuilder.toString());
            // console.log(freezeCodeBuilder.toString());

            if (idProperties.length === 0) {
                throw new Error(`Schema must have a key.  Use .key() to mark a property as a key.  Collection Name: ${this.collectionName}`)
            }

            const enrichParams = enricherFunctionRoot.getParameters()
            const mergeParams = mergeFunctionRoot.getParameters()
            const enrichGenerator = Function(`return ${enricherCodeBuilder.toString()}`);
            const mergeGenerator = Function(`return ${mergeCodeBuilder.toString()}`);

            const getIdsFunction = Function("entity", idSelectorCodeBuilder.toString()) as (entity: InferType<T>) => [IdType];
            const getHashTypeFunction = Function("entity", hashTypeCodeBuilder.toString()) as GetHashTypeFunction<T>;
            const prepareFunction = Function("entity", prepareCodeBuilder.toString()) as (entity: InferCreateType<T>) => InferCreateType<T>;
            const cloneFunction = Function("entity", cloneCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const deserializeFunction = Function("entity", deserializeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const serializeFunction = Function("entity", serializeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const compareFunction = Function("a", "b", compareCodeBuilder.toString()) as (a: InferType<T>, fromDb: InferType<T>) => boolean;;
            const stripFunction = Function("entity", stripCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const hashFunction = Function("entity", "type", hashCodeBuilder.toString()) as HashFunction<T>;
            const enableChangeTrackingFunction = Function("entity", changeTrackingCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const freezeFunction = Function("entity", freezeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;

            const enricherFactoryFunction = enrichGenerator();
            const mergeFactoryFunction = mergeGenerator();
            const enricherFunction = enricherFactoryFunction(...enrichParams.map(w => w.value));
            const mergeFunction = mergeFactoryFunction(...mergeParams.map(w => w.value));

            const idPropertyNames = idProperties.map(w => w.name);
            const getId = (entity: InferType<T>) => {
                if (idPropertyNames.length > 1) {
                    return hashFunction(entity, HashType.Ids) as IdType;
                }

                return getIdsFunction(entity as any)[0] as IdType;
            }

            const getProperty = (id: string) => propertyMap.get(id);
            const id = hash([...allPropertyNamesAndPaths, this.collectionName].join(","));

            return {
                createSubscription: (signal?: AbortSignal) => new CollectionSubscription(id, signal),
                getId,
                getProperty,
                properties,
                idProperties,
                hasIdentities,
                hashType,
                getHashType: getHashTypeFunction,
                merge: mergeFunction,
                prepare: prepareFunction,
                clone: cloneFunction,
                deserialize: deserializeFunction,
                serialize: serializeFunction,
                compare: compareFunction,
                strip: stripFunction,
                hash: hashFunction,
                id,
                getIds: getIdsFunction,
                enrich: enricherFunction,
                collectionName: this.collectionName,
                hasIdentityKeys,
                freeze: freezeFunction,
                enableChangeTracking: enableChangeTrackingFunction,
                definition: this,
                getIndexes: () => {

                    const indexes: Index[] = [];

                    for (let i = 0, length = properties.length; i < length; i++) {
                        const property = properties[i];

                        if (property.indexes.length === 0) {
                            continue; // No Index
                        }

                        for (let j = 0, l = property.indexes.length; j < l; j++) {
                            const indexName = property.indexes[j];

                            // Test for compound indexes
                            const connections = properties.filter(w =>
                                w !== property && // Don't match with self
                                w.indexes.some(index => index === indexName)
                            );

                            const indexedProperties = [property, ...connections];

                            if (indexedProperties.length === 1) {
                                // Not a compound property
                                if (indexedProperties[0].isKey) {
                                    indexes.push({
                                        properties: indexedProperties,
                                        type: "primary-key",
                                        name: indexName
                                    });
                                    continue;
                                }

                                if (indexedProperties[0].isDistinct) {
                                    indexes.push({
                                        properties: indexedProperties,
                                        type: "unique",
                                        name: indexName
                                    });
                                    continue;
                                }

                                indexes.push({
                                    properties: indexedProperties,
                                    type: "single",
                                    name: indexName
                                });
                                continue;
                            }

                            if (indexes.some(w => w.name === indexName)) {
                                continue; // Already in a compound index
                            }

                            indexes.push({
                                properties: indexedProperties,
                                type: "compound",
                                name: indexName
                            });
                        }
                    }

                    return indexes;
                }
            }
        } catch (e) {
            throw new SchemaError(e, `Error compiling schema for collection: ${this.collectionName}`);
        }
    }
}
