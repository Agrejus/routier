import { SchemaFunction } from './table/SchemaFunction';
import { SchemaComputed } from './table/SchemaComputed';
import { SchemaBase } from "./property/base/SchemaBase";
import { PropertyInfo } from './PropertyInfo';
import { CodeBuilder, FunctionBuilder, SlotBlock } from '../codegen';
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
import { hash } from "../utilities";
import { CollectionName, CompiledSchema, CompiledSchemaCore, GetHashTypeFunction, HashFunction, HashType, IdType, Index, InferCreateType, InferType, Prepare, Preprocess, SchemaId, SchemaTypes } from './types';
import { DeepPartial } from '../types';
import { SchemaSubscription } from './communication/broadcast';
import { CompareIdsHandlerBuilder } from '../codegen/handlers/CompareIdsHandlerBuilder';

export class SchemaDefinition<T extends {}> extends SchemaBase<T, any> {

    instance: T;
    type = SchemaTypes.Definition;
    collectionName: CollectionName;

    constructor(collectionName: CollectionName, schema: T) {
        super();
        this.collectionName = collectionName;
        this.instance = schema;
        this.isNullable = false;
        this.isOptional = false;
    }

    modify<R>(builder: (d: {
        function: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: CollectionName, injected: I) => UU, injected?: I) => SchemaFunction<UU, I, "unmapped">;
        computed: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: CollectionName, injected: I) => UU, injected?: I) => SchemaComputed<UU, I, "computed" | "unmapped">;
    }) => R) {

        const b = {
            function: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: CollectionName, injected?: I) => UU, injected?: I) => new SchemaFunction<UU, I, "unmapped">(fn as any, injected),
            computed: <UU, I = never>(fn: (entity: InferType<CompiledSchema<T>>, collectionName: CollectionName, injected?: I) => UU, injected?: I) => new SchemaComputed<UU, I, "computed" | "unmapped">(fn as any, injected)
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
                    let tracking = resolvedParent[TRACKING_KEY];

                    if (tracking == null) {
                        tracking = resolvedParent[TRACKING_KEY] = {
                            [CHANGES_ENTITY_KEY]: {},
                            [DIRTY_ENTITY_MARKER]: false,
                            [ORIGINAL_ENTITY_KEY]: {},
                            [PAUSED_ENTITY_KEY]: false
                        };
                    }

                    if (key === TRACKING_KEY) {
                        return true;
                    }

                    if (tracking[PAUSED_ENTITY_KEY] === true) {
                        Reflect.set(indexableEntity, property, value);
                        return true;
                    }

                    const resolvedPath = path == null ? key : `${path}.${key}`;
                    const changesMap = tracking[CHANGES_ENTITY_KEY];
                    const originalMap = tracking[ORIGINAL_ENTITY_KEY];
                    const existingChange = changesMap[resolvedPath];

                    if (existingChange != null) {
                        if (originalMap[resolvedPath] === value) {
                            // we are changing the value back to the original value, remove the change
                            delete originalMap[resolvedPath];
                            delete changesMap[resolvedPath];
                            tracking[DIRTY_ENTITY_MARKER] = Object.keys(originalMap).length > 0;
                        } else {
                            // track the change
                            changesMap[resolvedPath] = value;
                        }
                    } else {
                        // don't keep updating, keep the original value
                        changesMap[resolvedPath] = value;
                        originalMap[resolvedPath] = originalValue;
                        tracking[DIRTY_ENTITY_MARKER] = true;
                    }

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
            const compareIdsHandlerBuilder = new CompareIdsHandlerBuilder();

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
            const compareIdsHandler = compareIdsHandlerBuilder.build();

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
            enricherFunctionRoot.slot("changeTracker").raw(`\tfunction ${this.createChangeTracker.toString()}`);
            enricherFunctionRoot.slot("changeTrackerFunction").raw(`\tconst changeTracker = createChangeTracker();`);
            const enricherFunctionBody = enricherFunctionRoot.function(undefined, { name: "function" }).parameters("entity", "changeTrackingType").return();

            enricherFunctionBody.slot("enableChangeTracking")
                .variable("enableChangeTracking")
                .value('changeTrackingType === "proxy" ? changeTracker : e => e');

            enricherFunctionBody.slot("append");
            enricherFunctionBody.slot("enriched");
            enricherFunctionBody.slot("declarations");
            enricherFunctionBody.slot("assignment");
            enricherFunctionBody.slot("ifs");
            enricherFunctionBody.slot("tracking").if('changeTrackingType === "immutable"', { name: "freeze" });
            enricherFunctionBody.slot("return").raw('\treturn enableChangeTracking(enriched);');

            const preprocessCodeBuilder = new CodeBuilder();
            preprocessCodeBuilder.slot("main");
            preprocessCodeBuilder.slot("return").raw(`     return result;`);

            const postprocessCodeBuilder = new CodeBuilder();
            postprocessCodeBuilder.slot("main");
            postprocessCodeBuilder.slot("return").raw(`     return result;`);

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
            cloneCodeBuilder.slot("result").raw("const result = {};");;
            cloneCodeBuilder.slot("assignments");
            cloneCodeBuilder.slot("if");
            cloneCodeBuilder.slot("return").raw(`     return result;`);

            const compareCodeBuilder = new CodeBuilder();
            compareCodeBuilder.slot("result");
            compareCodeBuilder.slot("return").raw(`     return result;`);

            const compareIdsCodeBuilder = new CodeBuilder();
            compareIdsCodeBuilder.slot("ifs");
            compareIdsCodeBuilder.slot("return").raw(`     return true;`);

            const deserializeCodeBuilder = new CodeBuilder();
            deserializeCodeBuilder.slot("functions");
            deserializeCodeBuilder.slot("result");
            deserializeCodeBuilder.slot("if");
            deserializeCodeBuilder.slot("return").raw(`     return entity;`);

            const serializeCodeBuilder = new CodeBuilder();
            serializeCodeBuilder.slot("result").raw("const result = {};");
            serializeCodeBuilder.slot("assignments");
            serializeCodeBuilder.slot("functions");
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

            const idProperties: PropertyInfo<any>[] = [];
            const allPropertyNamesAndPaths: string[] = [];
            let hashType: HashType = HashType.Ids;
            let hasIdentities = false;
            let hasIdentityKeys = false;

            this._iterate(schema, (property) => {

                properties.push(property);
                propertyMap.set(property.id, property);
                allPropertyNamesAndPaths.push(property.getSelectrorPath({ parent: "entity" }));

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
                compareIdsHandler.handle(property, compareIdsCodeBuilder);
            });

            if (idProperties.length === 0) {
                throw new Error(`Schema must have a key.  Use .key() to mark a property as a key.  Collection Name: ${this.collectionName}`)
            }

            const enrichParams = enricherFunctionRoot.getParameters();
            const mergeParams = mergeFunctionRoot.getParameters();
            const enrichGenerator = Function(`return ${enricherCodeBuilder.toString()}`);
            const mergeGenerator = Function(`return ${mergeCodeBuilder.toString()}`);

            // After enricher is used, we modify it to be deserialize and enrich
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("functions"));
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("result"));
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("if"));
            enricherFunctionRoot.replace("function", new FunctionBuilder(undefined).parameters("unserialized", "changeTrackingType").return());

            const postProcessGenerator = Function(`return ${enricherCodeBuilder.toString()}`);
            const postProcessParams = enricherFunctionRoot.getParameters();

            // Combine prepare and serialize
            preprocessCodeBuilder.get<SlotBlock>("main").insert(prepareCodeBuilder.get<SlotBlock>("result"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(prepareCodeBuilder.get<SlotBlock>("assignments"));

            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("assignments"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("functions"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("if"));


            const getIdsFunction = Function("entity", idSelectorCodeBuilder.toString()) as (entity: InferType<T>) => [IdType];
            const getHashTypeFunction = Function("entity", hashTypeCodeBuilder.toString()) as GetHashTypeFunction<T>;
            const prepareFunction = Function("entity", prepareCodeBuilder.toString()) as Prepare<T>;
            const cloneFunction = Function("entity", cloneCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const deserializeFunction = Function("unserialized", deserializeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const serializeFunction = Function("entity", serializeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const compareFunction = Function("a", "b", compareCodeBuilder.toString()) as (a: InferType<T>, b: InferType<T>) => boolean;
            const stripFunction = Function("entity", stripCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const hashFunction = Function("entity", "type", hashCodeBuilder.toString()) as HashFunction<T>;
            const enableChangeTrackingFunction = Function("entity", changeTrackingCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const freezeFunction = Function("entity", freezeCodeBuilder.toString()) as (entity: InferType<T>) => InferType<T>;
            const compareIdsFunction = Function("a", "b", compareIdsCodeBuilder.toString()) as (a: InferType<T>, b: InferType<T>) => boolean;
            const preprocessFunction = Function("entity", preprocessCodeBuilder.toString()) as Preprocess<T>;

            const enricherFactoryFunction = enrichGenerator();
            const postProcessFactoryFunction = postProcessGenerator();
            const mergeFactoryFunction = mergeGenerator();
            const postProcessFunction = postProcessFactoryFunction(...postProcessParams.map(w => w.value))
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
            const id = hash([...allPropertyNamesAndPaths, this.collectionName].join(",")) as SchemaId;

            // memoize this by the validProperties
            // TODO: See if we can generate a function to do this and eliminate loops
            const deserializePartial = (item: Record<string, unknown>, properties: PropertyInfo<T>[]) => {

                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i];
                    const value = property.getValue(item);

                    if (value == null) {
                        continue;
                    }

                    const deserialized = property.deserialize(value);
                    property.setValue(item, deserialized);
                }

                return item as DeepPartial<InferType<T>>;
            }

            const result: CompiledSchemaCore<T> = {
                preprocess: preprocessFunction,
                postprocess: postProcessFunction,
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
                deserializePartial,
                deserialize: deserializeFunction,
                serialize: serializeFunction,
                compare: compareFunction,
                compareIds: compareIdsFunction,
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
            };

            return {
                createSubscription: (signal?: AbortSignal) => new SchemaSubscription(result, signal),
                ...result
            }
        } catch (e) {
            throw new SchemaError(e, `Error compiling schema for collection: ${this.collectionName}`);
        }
    }
}
