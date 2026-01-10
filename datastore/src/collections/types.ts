import { SchemaCollection } from "@routier/core/collections";
import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, ISchemaSubscription } from "@routier/core/schema";
import { ChangeTracker } from "../change-tracking/ChangeTracker";
import { DataBridge } from "../data-access/DataBridge";
import { CollectionPipelines } from "../types";
import { uuid } from "@routier/core";

export class ComposerDependencies<TRoot extends {}> {
    readonly schema: CompiledSchema<TRoot>;

    constructor(
        schema: CompiledSchema<TRoot>,
    ) {
        this.schema = schema;
    }
}

export class CollectionDependencies<TRoot extends {}> extends ComposerDependencies<TRoot> {
    readonly plugin: IDbPlugin;
    readonly schemas: SchemaCollection;
    readonly pipelines: CollectionPipelines;
    readonly signal: AbortSignal;
    readonly subscription: ISchemaSubscription<TRoot>;
    readonly changeTracker: ChangeTracker<TRoot>;
    readonly dataBridge: DataBridge<TRoot>;
    readonly scopedQueryOptions: QueryOptionsCollection<TRoot>;

    constructor(
        plugin: IDbPlugin,
        schema: CompiledSchema<TRoot>,
        schemas: SchemaCollection,
        pipelines: CollectionPipelines,
        signal: AbortSignal,
        scopedQueryOptions: QueryOptionsCollection<TRoot>,
        subscription: ISchemaSubscription<TRoot>,
        changeTracker: ChangeTracker<TRoot>,
        dataBridge: DataBridge<TRoot>
    ) {
        super(schema);
        this.plugin = plugin;
        this.schemas = schemas;
        this.pipelines = pipelines;
        this.signal = signal;
        this.subscription = subscription;
        this.changeTracker = changeTracker;
        this.dataBridge = dataBridge;
        this.scopedQueryOptions = scopedQueryOptions;
    }
}

export class RequestContext<TRoot extends {}> {

    constructor() {
        this.queryOptions = new QueryOptionsCollection<TRoot>();
        this.isSubScribed = false;
        this.changeTrackingType = "proxy";
        this.id = uuid(8);
    }

    isSubScribed: boolean;
    readonly queryOptions: QueryOptionsCollection<TRoot>;
    readonly changeTrackingType: ChangeTrackingType;
    readonly id: string;
}
