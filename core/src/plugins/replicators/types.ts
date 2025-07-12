import { SchemaId } from '../../schema';
import { CollectionChangesResult, DbPluginBulkPersistEvent, IDbPlugin, IdbPluginCollection } from '../types';

export type OperationsPayload = {
    plugins: IDbPlugin[];
    index: number;
}

export type PersistPayload<TEntity extends {}> = OperationsPayload & {
    event: DbPluginBulkPersistEvent<TEntity>;
    result?: Map<SchemaId, CollectionChangesResult<TEntity>>;
}

export type IDbPluginReplicator = IDbPlugin & {
    plugins: IdbPluginCollection;
}