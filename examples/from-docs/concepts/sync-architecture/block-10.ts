class SyncDataStore {
  private metadataSchema: CompiledSchema<SyncMetadata>;
  private metadataCollection: Collection<SyncMetadata>;
  
  constructor(plugin: IDbPlugin) {
    super(plugin);
    
    // Create metadata schema
    this.metadataSchema = s.define("__sync_metadata__", {
      schemaId: s.string().key(),
      lastSyncTimestamp: s.number()
    }).compile();
    
    this.metadataCollection = this.collection(this.metadataSchema).create();
  }
  
  private atomicSyncWithMetadata<T>(
    schema: CompiledSchema<T>,
    remoteData: T[],
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    const collection = this.collections.get(schema.id);
    const { adds, updates, removals } = this.calculateChanges(schema, remoteData);
    
    // Create bulk changes including both data AND metadata
    const bulkChanges = new BulkPersistChanges();
    
    // Data changes
    const schemaChanges = bulkChanges.resolve(schema.id);
    schemaChanges.adds = adds;
    schemaChanges.updates = updates.map(u => u.remote);
    schemaChanges.removes = removals;
    
    // Metadata update
    const metadataChanges = bulkChanges.resolve(this.metadataSchema.id);
    const existingMetadata = this.getSyncMetadata(schema.id);
    if (existingMetadata) {
      metadataChanges.updates = [{
        schemaId: schema.id,
        lastSyncTimestamp: serverTimestamp
      }];
    } else {
      metadataChanges.adds = [{
        schemaId: schema.id,
        lastSyncTimestamp: serverTimestamp
      }];
    }
    
    // Single atomic operation via saveChanges
    this.saveChanges((result) => {
      if (result.ok === Result.ERROR) {
        // Everything rolled back automatically
        return done(result);
      }
      
      // Both data and metadata updated atomically
      done(Result.success());
    });
  }
}