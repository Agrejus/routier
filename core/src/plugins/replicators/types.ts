import { ResolvedChanges } from '../../common/collections/Changes';
import { DbPluginBulkPersistEvent, IDbPlugin, IdbPluginCollection } from '../types';

export type OperationsPayload = {
    plugins: IDbPlugin[];
    index: number;
}

export type PersistPayload<TEntity extends {}> = OperationsPayload & {
    event: DbPluginBulkPersistEvent<TEntity>;
    result: ResolvedChanges<TEntity>;
}

export type IDbPluginReplicator = IDbPlugin & {
    plugins: IdbPluginCollection;
}