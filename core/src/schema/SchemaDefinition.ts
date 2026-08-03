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
import { hash, logger } from "../utilities";
import { CollectionName, CompiledSchema, CompiledSchemaCore, CompiledSchemaWithMetadata, GetHashTypeFunction, HashFunction, HashType, IdType, Index, InferCreateType, InferType, Prepare, Preprocess, SchemaId, SchemaTypes, SetProperties } from './types';
import { DeepPartial } from '../types';
import { SchemaSubscription } from './communication/broadcast';
import { CompareIdsHandlerBuilder } from '../codegen/handlers/CompareIdsHandlerBuilder';
import { StandardJSONSchemaV1, createStandardJsonSchemaProps, rehydrateSchemaFromJsonString } from './utils/standardJsonSchema';
import { SetHandlerBuilder } from '../codegen/handlers';

function assertPropertyHandled(generatorName: string, property: PropertyInfo<any>, result: unknown): asserts result is {} {
    if (result == null) {
        throw new Error(`Schema compilation failed: no '${generatorName}' code generator handles property '${property.getAssignmentPath()}' (type: ${property.type}). Add a handler for this property shape or mark it not applicable in the ${generatorName} chain.`);
    }
}

function createChangeTracker() {
    const DIRTY_ENTITY_MARKER: string = "isDirty";
    const CHANGES_ENTITY_KEY: string = "changes";
    const ORIGINAL_ENTITY_KEY: string = "original";
    const PAUSED_ENTITY_KEY: string = "isPaused";
    const TRACKING_KEY: string = "__tracking__";
    const PROXY_MARKER: string = "__isProxy__";

    return <TEntity extends {}>(entity: TEntity, path?: string, parent?: TEntity) => {

        const proxyHandler: ProxyHandler<TEntity> = {
            set(entity, property, value) {
                const indexableEntity: { [key: string]: any } = entity;

                // if values are the same, do nothing
                //
                // Checked before `String(property)` on purpose. A write that changes
                // nothing is the common case, not the exception: `schema.merge` copies
                // every property of a re-read row into the attached entity, and on an
                // unchanged row every one of those writes lands here and returns.
                // Building the string key first made that path cost 156ns a write, of
                // which 125ns was the `String()` call alone; checking first takes it to
                // 31ns, against a 14ns floor for the same writes on a plain object.
                // Indexing by `property` rather than by `key` reads the same slot for
                // string keys, and the correct one for symbols (which `String()` would
                // have mangled into a "Symbol(x)" lookup).
                const originalValue = indexableEntity[property as string];

                if (originalValue === value) {
                    return true;
                }

                const key = String(property);
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
            get(target, property, receiver) {

                if (property === PROXY_MARKER) {
                    return true;
                }

                return Reflect.get(target, property, receiver);
            }
        }

        return new Proxy(entity, proxyHandler) as TEntity;
    }
}


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

    /**
     * Creates a SchemaDefinition from a JSON string containing a JSON Schema.
     * Parses the JSON string, rehydrates the schema structure, and compiles it.
     * 
     * @param jsonString - The JSON string containing the JSON Schema (typically from `schema['~standard'].jsonSchema.input()` or `output()`)
     * @param collectionName - Optional collection name override (if not present in JSON Schema metadata)
     * @returns A compiled schema ready to use
     * @throws Error if the JSON string is invalid or doesn't contain a valid JSON Schema
     * 
     * @example
     * ```typescript
     * // Serialize a schema to JSON
     * const jsonSchema = mySchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
     * const jsonString = JSON.stringify(jsonSchema);
     * 
     * // Rehydrate from JSON string
     * const rehydratedSchema = SchemaDefinition.fromJson(jsonString);
     * // Schema is already compiled and ready to use
     * ```
     */
    static fromJson(jsonString: string, collectionName?: string): CompiledSchema<any> {
        const schemaDefinition = rehydrateSchemaFromJsonString(jsonString, collectionName);
        return schemaDefinition.compile();
    }

    /**
     * Standard JSON Schema V1 implementation.
     * Provides JSON Schema conversion for Routier schemas.
     */
    get '~standard'(): StandardJSONSchemaV1.Props<InferCreateType<T>, InferType<T>> {
        const schema = this.compile();

        return createStandardJsonSchemaProps(schema);
    }

    private createReturnFunction<TResult>(builder: CodeBuilder): TResult {
        const body = builder.toString();
        try {
            return Function(`return ${body}`) as TResult;
        } catch (e) {
            logger.error(`Error compiling schema function.  Function Body: ${body}`)
            throw e;
        }
    }

    private createFunction<TResult>(builder: CodeBuilder, ...fnArgs: string[]): TResult {
        const body = builder.toString();

        try {
            return Function(...fnArgs, body) as TResult;
        } catch (e) {
            logger.error(`Error compiling schema function.  Function Body: ${body}`)
            throw e;
        }
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

    compile<TMetadata>(metadata: TMetadata): CompiledSchemaWithMetadata<T, TMetadata>
    compile(): CompiledSchema<T>;
    compile<TMetadata>(metadata?: TMetadata): CompiledSchema<T> | CompiledSchemaWithMetadata<T, TMetadata> {

        try {
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
            const setHandlerBuilder = new SetHandlerBuilder();

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
            const setHandlerHanlder = setHandlerBuilder.build();

            const changeTrackingCodeBuilder = new CodeBuilder();
            changeTrackingCodeBuilder.raw(`${createChangeTracker.toString()}`);
            changeTrackingCodeBuilder.slot("declarations").variable("enableChangeTracking").value('createChangeTracker()');
            // Nested proxies are installed by assigning through already-proxied parents;
            // pause tracking during setup so those writes don't register as changes
            changeTrackingCodeBuilder.slot("pause").raw('\tconst hadTracking = entity.__tracking__ != null;\n\tif (!hadTracking) { Object.defineProperty(entity, "__tracking__", { value: { changes: {}, isDirty: false, original: {}, isPaused: false }, configurable: true, writable: true, enumerable: false }); }\n\tconst wasPaused = entity.__tracking__.isPaused;\n\tentity.__tracking__.isPaused = true;');
            changeTrackingCodeBuilder.slot("assignment");
            // Tracking metadata is created lazily on the first real write; only restore
            // what already existed, never leave the bootstrap behind
            changeTrackingCodeBuilder.slot("return").raw('\tif (hadTracking) { entity.__tracking__.isPaused = wasPaused; } else { delete entity.__tracking__; }\n\treturn enableChangeTracking(entity);');

            const freezeCodeBuilder = new CodeBuilder();
            freezeCodeBuilder.slot("assignment");
            freezeCodeBuilder.slot("return").raw('\treturn Object.freeze(entity);');

            const enricherCodeBuilder = new CodeBuilder();

            const enricherFunctionRoot = enricherCodeBuilder.factory("factory", { name: "factory" }).parameters({ name: "collectionName", value: this.collectionName });
            enricherFunctionRoot.slot("changeTracker").raw(`${createChangeTracker.toString()}`);
            enricherFunctionRoot.slot("changeTrackerFunction").raw(`\tconst changeTracker = createChangeTracker();`);
            const enricherFunctionBody = enricherFunctionRoot.function(undefined, { name: "function" }).parameters("entity", "changeTrackingType").return();

            enricherFunctionBody.slot("enableChangeTracking")
                .variable("enableChangeTracking")
                .value('changeTrackingType === "proxy" ? changeTracker : e => e');

            enricherFunctionBody.slot("append");
            enricherFunctionBody.slot("enriched");
            // Nested proxies are installed by assigning through already-proxied parents;
            // pause tracking during setup so those writes don't register as changes.
            // Non-enumerable: computed properties run after this and may JSON.stringify
            // the entity (e.g. content-hash ids) — the bootstrap must not change their input
            enricherFunctionBody.slot("declarations").raw('\tif (changeTrackingType === "proxy") { Object.defineProperty(enriched, "__tracking__", { value: { changes: {}, isDirty: false, original: {}, isPaused: true }, configurable: true, writable: true, enumerable: false }); }');
            enricherFunctionBody.slot("assignment");
            enricherFunctionBody.slot("ifs");
            enricherFunctionBody.slot("tracking").if('changeTrackingType === "immutable"', { name: "freeze" });
            // The paused bootstrap tracking is deleted rather than unpaused: tracking
            // metadata is created lazily on the first real write, and callers assert
            // an untouched entity carries none
            // The __tracking__ bootstrap is temporary in EVERY mode, so it is always removed.
            // Proxy mode recreates it lazily on the first tracked write (see defect #2); the
            // non-proxy modes never wanted it, and gating the delete on "proxy" left them
            // carrying a stray `{ isPaused: false }` on every entity.
            enricherFunctionBody.slot("return").raw('\tif (changeTrackingType !== "immutable") { delete enriched.__tracking__; }\n\treturn enableChangeTracking(enriched);');

            const preprocessCodeBuilder = new CodeBuilder();
            preprocessCodeBuilder.slot("main");
            preprocessCodeBuilder.slot("return").raw(`     return result;`);

            const postprocessCodeBuilder = new CodeBuilder();
            postprocessCodeBuilder.slot("main");
            postprocessCodeBuilder.slot("return").raw(`     return result;`);

            const setCodeBuilder = new CodeBuilder();
            setCodeBuilder.slot("assignments");
            setCodeBuilder.slot("ifs");

            const mergeCodeBuilder = new CodeBuilder();

            const mergeFunctionRoot = mergeCodeBuilder.factory("factory", { name: "factory" }).parameters({ name: "collectionName", value: this.collectionName });
            const mergeFunctionBody = mergeFunctionRoot.function(undefined, { name: "function" }).parameters("destination", "source").return();

            // The pause bootstrap exists so a PROXIED destination does not record the
            // merge's own writes as changes. A destination with no tracking (diff and
            // immutable modes) gets a temporary bootstrap so the same generated code runs —
            // and unpause() DELETES it again, because leaving it behind is the
            // `{ isPaused: false }` residue of defect #16, this time on the merge path.
            const pauseFunctionBody = mergeFunctionBody.function("pause")
                .appendBody("// initiate change tracking if needed");

            pauseFunctionBody.if("destination.__tracking__ == null")
                .appendBody("destination.__tracking__ = {};")
                .appendBody("installedTrackingBootstrap = true;");

            pauseFunctionBody.appendBody("destination.__tracking__.isPaused = true;");

            const unpauseFunctionBody = mergeFunctionBody.function("unpause")
                .appendBody("// unpause change tracking, removing a bootstrap this merge installed");

            unpauseFunctionBody.if("installedTrackingBootstrap === true")
                .appendBody("delete destination.__tracking__;")
                .appendBody("return;");

            unpauseFunctionBody.if("destination.__tracking__ != null")
                .appendBody("destination.__tracking__.isPaused  = false;");

            mergeFunctionBody.slot("header").raw(`let installedTrackingBootstrap = false;
    pause()`);
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

        if (d.getTime != null) {
            return "" + d.getTime();
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

            this._iterate(this, (property) => {

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

                // Every chain must claim every property.  A null return means no
                // handler matched, and silently omitting the property from the
                // generated function corrupts data — fail the compile instead.
                assertPropertyHandled("enrich", property, enricher.handle(property, enricherCodeBuilder));
                assertPropertyHandled("merge", property, merge.handle(property, mergeCodeBuilder));
                assertPropertyHandled("prepare", property, prepare.handle(property, prepareCodeBuilder));
                assertPropertyHandled("strip", property, strip.handle(property, stripCodeBuilder));
                assertPropertyHandled("clone", property, clone.handle(property, cloneCodeBuilder));
                assertPropertyHandled("compare", property, compare.handle(property, compareCodeBuilder));
                assertPropertyHandled("deserialize", property, deserialize.handle(property, deserializeCodeBuilder));
                assertPropertyHandled("serialize", property, serializeHandler.handle(property, serializeCodeBuilder))
                assertPropertyHandled("hashType", property, hashTypeHandler.handle(property, hashTypeCodeBuilder));
                assertPropertyHandled("idSelector", property, idSelectorHandler.handle(property, idSelectorCodeBuilder));
                assertPropertyHandled("hash", property, hashHandler.handle(property, hashCodeBuilder));
                assertPropertyHandled("enableChangeTracking", property, enableChangeTrackingHandler.handle(property, changeTrackingCodeBuilder));
                assertPropertyHandled("freeze", property, freezeHandler.handle(property, freezeCodeBuilder));
                assertPropertyHandled("compareIds", property, compareIdsHandler.handle(property, compareIdsCodeBuilder));
                assertPropertyHandled("set", property, setHandlerHanlder.handle(property, setCodeBuilder));
            });

            if (idProperties.length === 0) {
                throw new Error(`Schema must have a key.  Use .key() to mark a property as a key.  Collection Name: ${this.collectionName}`)
            }

            const enrichParams = enricherFunctionRoot.getParameters();
            const mergeParams = mergeFunctionRoot.getParameters();

            const enrichGenerator = this.createReturnFunction<Function>(enricherCodeBuilder);
            const mergeGenerator = this.createReturnFunction<Function>(mergeCodeBuilder);

            // After enricher is used, we modify it to be deserialize and enrich
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("functions"));
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("result"));
            enricherFunctionBody.get<SlotBlock>("append").insert(deserializeCodeBuilder.get<SlotBlock>("if"));
            enricherFunctionRoot.replace("function", new FunctionBuilder(undefined).parameters("unserialized", "changeTrackingType").return());

            const postProcessGenerator = this.createReturnFunction<Function>(enricherCodeBuilder);
            const postProcessParams = enricherFunctionRoot.getParameters();

            // Combine prepare and serialize
            preprocessCodeBuilder.get<SlotBlock>("main").insert(prepareCodeBuilder.get<SlotBlock>("result"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(prepareCodeBuilder.get<SlotBlock>("assignments"));

            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("assignments"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("functions"));
            preprocessCodeBuilder.get<SlotBlock>("main").insert(serializeCodeBuilder.get<SlotBlock>("if"));

            const getIdsFunction = this.createFunction<(entity: InferType<T>) => [IdType]>(idSelectorCodeBuilder, "entity");
            const getHashTypeFunction = this.createFunction<GetHashTypeFunction<T>>(hashTypeCodeBuilder, "entity");
            const prepareFunction = this.createFunction<Prepare<T>>(prepareCodeBuilder, "entity");
            const cloneFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(cloneCodeBuilder, "entity");
            const deserializeFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(deserializeCodeBuilder, "unserialized");
            const serializeFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(serializeCodeBuilder, "entity");
            const compareFunction = this.createFunction<(a: InferType<T>, b: InferType<T>) => boolean>(compareCodeBuilder, "a", "b");
            const stripFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(stripCodeBuilder, "entity");
            const hashFunction = this.createFunction<HashFunction<T>>(hashCodeBuilder, "entity", "type");
            const enableChangeTrackingFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(changeTrackingCodeBuilder, "entity");
            const freezeFunction = this.createFunction<(entity: InferType<T>) => InferType<T>>(freezeCodeBuilder, "entity");
            const compareIdsFunction = this.createFunction<(a: InferType<T>, b: InferType<T>) => boolean>(compareIdsCodeBuilder, "a", "b");
            const preprocessFunction = this.createFunction<Preprocess<T>>(preprocessCodeBuilder, "entity");
            const setFunction = this.createFunction<SetProperties<T>>(setCodeBuilder, "destination", "source");

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
                set: setFunction,
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
                // Root only: a nested concurrency token has no conditional-update
                // representation in any plugin
                concurrencyProperty: properties.find(p => p.parent == null && p.isConcurrency === true) ?? null,
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

            if (metadata != null) {

                const compiledSchemaWithMetadata: CompiledSchemaWithMetadata<T, TMetadata> = {
                    ...result,
                    createSubscription: (signal?: AbortSignal, scope?: string) => new SchemaSubscription(result, signal, scope),
                    metadata
                };

                return compiledSchemaWithMetadata;
            }

            const compiledSchema = {
                createSubscription: (signal?: AbortSignal, scope?: string) => new SchemaSubscription(result, signal, scope),
                ...result
            };

            return compiledSchema;
        } catch (e) {
            throw new SchemaError(e, `Error compiling schema for collection: ${this.collectionName}`);
        }
    }
}
