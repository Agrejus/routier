// In IDbPlugin interface
interface IDbPlugin {
  // ... existing methods ...
  
  beginTransaction?(): string | Promise<string>;
  commitTransaction?(txId: string, done: CallbackResult<void>): void;
  rollbackTransaction?(txId: string, done: CallbackResult<void>): void;
  
  // OR: Atomic bulk operation
  atomicBulkPersistWithMetadata?(
    event: DbPluginBulkPersistEvent & { 
      metadata?: Map<string, SyncMetadata> 
    },
    done: PluginEventCallbackPartialResult<BulkPersistResult>
  ): void;
}