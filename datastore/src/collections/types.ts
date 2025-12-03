import { SchemaCollection } from "@routier/core/collections";
import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, ISchemaSubscription } from "@routier/core/schema";
import { ChangeTracker } from "../change-tracking/ChangeTracker";
import { DataBridge } from "../data-access/DataBridge";
import { CollectionPipelines } from "../types";

export interface CollectionDependencies<TRoot extends {}> {
    schema: CompiledSchema<TRoot>;
    schemas: SchemaCollection;
    scopedQueryOptions: QueryOptionsCollection<TRoot>;
    dataBridge: DataBridge<TRoot>;
    subscription: ISchemaSubscription<TRoot>;
    changeTracker: ChangeTracker<TRoot>;
    request: RequestContext<TRoot>;
    pipelines: CollectionPipelines;
    signal: AbortSignal;
    plugin: IDbPlugin;
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
