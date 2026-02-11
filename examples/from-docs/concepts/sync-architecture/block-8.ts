export abstract class SyncDataStore extends DataStore {
  
  // Get sync metadata for a schema
  protected getSyncMetadata(schemaId: string): SyncMetadata | null {
    // Retrieve from CDC table/collection
  }
  
  // Update sync metadata with server-provided timestamp
  protected updateSyncMetadata(
    schemaId: string, 
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    // Update CDC table atomically
  }
  
  // Enhanced fetch with timestamp support
  abstract fetchRemoteData<T extends {}>(
    schema: CompiledSchema<T>,
    sinceTimestamp: number | null,  // Client's last known server timestamp
    done: CallbackResult<{ data: T[], serverTimestamp: number }>
  ): void;
  
  // Queue local change for later sync
  protected queueLocalChange(
    schemaId: string,
    change: PendingChange
  ): void {
    // Add to QUEUE table
  }
  
  // Process queued changes
  protected processQueuedChanges(
    schemaId: string,
    done: CallbackResult<void>
  ): void {
    // Send QUEUE items to server
    // Update CDC with server timestamp on success
    // Remove from QUEUE on success
  }
  
  // Atomic sync operation
  private atomicSyncRemoteData<T>(
    schema: CompiledSchema<T>,
    remoteData: T[],
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    // 1. Calculate changes
    // 2. Apply data changes
    // 3. Update CDC metadata
    // 4. Commit atomically (or rollback both on failure)
  }
}