interface PendingChange {
  schemaId: string;
  entityId: string;              // Hash of entity IDs
  changeType: 'add' | 'update' | 'remove';
  localTimestamp: number;        // When change was made locally (for ordering only)
  serverTimestamp?: number;      // Server-provided timestamp after successful sync
  entityData?: any;              // Full entity data for adds/updates
  retryCount?: number;           // Number of retry attempts
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}