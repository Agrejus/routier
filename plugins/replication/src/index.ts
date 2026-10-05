export { OptimisticUpdatesDbPlugin, type OptimisticUpdatesDbPluginOptions } from './OptimisticUpdatesDbPlugin';
export { HttpDbPlugin } from './HttpDbPlugin';
export { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
export { HttpTransportDbPlugin } from './HttpTransportDbPlugin';
export type { HttpTransportDbPluginOptions } from './HttpTransportDbPlugin';
export { PluginSyncEngine } from './PluginSyncEngine';
export type {
    MirrorErrorContext,
    PluginSyncEngineOptions,
    QueryFailureMode,
    MirrorFailureMode,
    PersistAckMode,
    DestroyFailureMode,
    MirrorPersistPayloadMode,
} from './PluginSyncEngine';

/** Plugin configuration. */
export type { HttpConnectionOptions, HttpPluginOptions, QuerySerializationContext } from './HttpDbPlugin';
export type { HttpSwrDbPluginOptions, AutoSyncOptions, SyncOutcome } from './HttpSwrDbPlugin';

export type {
    AnyRequestError,
    ChangesRejectedEvent,
    DeferAction,
    DoneAction,
    FailureDetails,
    FailureKind,
    HttpRequestError,
    OptimisticRequestError,
    ReadEvent,
    RejectAction,
    RejectedChange,
    ResponseHeaders,
    RetryAction,
    SwrRequestError,
    SyncedEvent,
    SyncEvent,
    SyncHooks,
    UseCachedAction,
} from './syncHooks';
export { createRetry, defaultSync, type RetryOptions } from './retry';
export type { QueuedChangeKind, UnsyncedQueueRow } from './UnsyncedQueue';

/**
 * Carries the HTTP status, so an application can classify a failure the same way the plugin
 * does rather than matching on message text.
 */
export { HttpStatusError, NetworkError, isAuthStatus, isConflictStatus, isPermanentStatus } from './httpUtils';
