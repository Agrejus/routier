export { OptimisticUpdatesDbPlugin } from './OptimisticUpdatesDbPlugin';
export { HttpDbPlugin } from './HttpDbPlugin';
export { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
export { HttpTransportDbPlugin } from './HttpTransportDbPlugin';
export type { HttpTransportDbPluginOptions } from './HttpTransportDbPlugin';
export { PluginSyncEngine } from './PluginSyncEngine';
export type {
    PluginSyncEngineOptions,
    QueryFailureMode,
    MirrorFailureMode,
    PersistAckMode,
    DestroyFailureMode,
    MirrorPersistPayloadMode,
} from './PluginSyncEngine';

/** Plugin configuration. */
export type { HttpPluginOptions, QuerySerializationContext } from './HttpDbPlugin';
export type { HttpSwrDbPluginOptions, AutoSyncOptions, SyncOutcome } from './HttpSwrDbPlugin';

/**
 * Types an application needs to write the callbacks it passes in: the auth handshake
 * (`onAuthError`) and the changes the queue has permanently given up on (`onSyncDeadLetter`).
 */
export type { AuthErrorEvent, AuthErrorHandler } from './auth';
export type { DeadLetteredChange, QueuedChangeKind, UnsyncedQueueRow } from './UnsyncedQueue';

/**
 * Carries the HTTP status, so an application can classify a failure the same way the plugin
 * does rather than matching on message text.
 */
export { HttpStatusError, isAuthStatus, isConflictStatus, isPermanentStatus } from './httpUtils';
