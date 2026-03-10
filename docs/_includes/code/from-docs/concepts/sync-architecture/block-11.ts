private atomicSyncWithCompensation<T>(
  schema: CompiledSchema<T>,
  remoteData: T[],
  serverTimestamp: number,
  done: CallbackResult<void>
): void {
  const collection = this.collections.get(schema.id);
  const { adds, updates, removals } = this.calculateChanges(schema, remoteData);
  
  // Store original state for rollback
  const originalState = this.snapshotCollection(collection);
  
  // Step 1: Apply data changes
  this.applyChanges(collection, adds, updates, removals, (changeResult) => {
    if (changeResult.ok === Result.ERROR) {
      return done(changeResult);
    }
    
    // Step 2: Update CDC metadata
    this.updateSyncMetadata(schema.id, serverTimestamp, (metadataResult) => {
      if (metadataResult.ok === Result.ERROR) {
        // CDC update failed - rollback data changes
        this.rollbackChanges(collection, originalState, () => {
          done(Result.error("Failed to update CDC metadata"));
        });
        return;
      }
      
      // Both succeeded
      done(Result.success());
    });
  });
}