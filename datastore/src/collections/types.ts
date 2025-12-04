import { SchemaCollection } from "@routier/core/collections";
import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, ISchemaSubscription } from "@routier/core/schema";
import { ChangeTracker } from "../change-tracking/ChangeTracker";
import { DataBridge } from "../data-access/DataBridge";
import { CollectionPipelines } from "../types";

export class CollectionDependencies<TRoot extends {}> {
    readonly plugin: IDbPlugin;
    readonly schema: CompiledSchema<TRoot>;
    readonly schemas: SchemaCollection;
    readonly pipelines: CollectionPipelines;
    readonly signal: AbortSignal;
    readonly scopedQueryOptions: QueryOptionsCollection<TRoot>;
    readonly subscription: ISchemaSubscription<TRoot>;
    readonly changeTracker: ChangeTracker<TRoot>;
    readonly dataBridge: DataBridge<TRoot>;

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
        this.plugin = plugin;
        this.schema = schema;
        this.schemas = schemas;
        this.pipelines = pipelines;
        this.signal = signal;
        this.scopedQueryOptions = scopedQueryOptions;
        this.subscription = subscription;
        this.changeTracker = changeTracker;
        this.dataBridge = dataBridge;
    }
}

export class RequestContext<TRoot extends {}> {

    constructor() {
        this.queryOptions = new QueryOptionsCollection<TRoot>();
        this.isSubScribed = false;
        this.skipInitialQuery = false;
        this.changeTrackingType = "proxy";
    }

    queryOptions: QueryOptionsCollection<TRoot>;
    isSubScribed: boolean;
    skipInitialQuery: boolean;
    changeTrackingType: ChangeTrackingType;
}
