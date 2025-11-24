import { SchemaCollection, TagCollection } from "@routier/core/collections";
import { EntityUpdateInfo, IQuery, QueryOptionsCollection } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema } from "@routier/core/schema";
import { IChangeTracker } from "../../change-tracking/types";
import { DataBridge } from "../../data-access/DataBridge";

export interface QueryableDependencies<TRoot extends {}> {
    schema: CompiledSchema<TRoot>;
    schemas: SchemaCollection;
    scopedQueryOptions: QueryOptionsCollection<TRoot>;
    changeTrackingType: ChangeTrackingType;
    dataBridge: DataBridge<TRoot>;
    removeQueryChangeTracker: IChangeTracker<IQuery<TRoot, TRoot>>;
    updateChangeTracker: IChangeTracker<TRoot, EntityUpdateInfo<TRoot>>;
    queryOptions: QueryOptionsCollection<any>;
    isSubScribed: boolean;
    skipInitialQuery: boolean;
    tags: TagCollection;
}