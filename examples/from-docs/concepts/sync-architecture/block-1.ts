interface SyncMetadata {
  schemaId: string;              // Collection identifier
  lastSyncTimestamp: number;     // Server-provided timestamp from last successful sync
}