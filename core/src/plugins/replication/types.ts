import { IDbPlugin, ReplicationPluginOptions, OptimisticReplicationPluginOptions } from '../types';

export type IDbPluginReplicator = IDbPlugin & {
    plugins: ReplicationPluginOptions | OptimisticReplicationPluginOptions;
}

export type HydrationStatus = "pending" | "fulfilled" | "rejected";