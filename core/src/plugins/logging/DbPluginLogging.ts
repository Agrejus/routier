import { CompiledSchema, SchemaId } from '../../schema';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, IQuery } from '../types';
import { PendingChanges, ResolvedChanges } from '../../collections';
import { CallbackPartialResult, CallbackResult, Result, ResultType } from '../../results';
import { now } from '../../performance';
import { uuid } from '../../utilities';

// Check if we're in development environment
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

// Hook types for extensibility
export type LogHook<T> = (data: T & Record<string, unknown>) => void;

export type QueryLogContext<TEntity extends {}, TShape extends any = TEntity> = {
    query: IQuery<TEntity, TShape> & Record<string, unknown>;
    schema: CompiledSchema<TEntity>;
    result?: TShape;
    error?: any;
    duration: number;
    isCriticalError?: boolean;
    timestamp: number;
    id: string;
};

export type BulkOperationsLogContext<TEntity extends {}> = {
    schemas: Map<SchemaId, CompiledSchema<TEntity>>;
    operations: PendingChanges<TEntity>;
    result?: ResolvedChanges<TEntity>;
    error?: any;
    duration: number;
    operationId: string;
    isCriticalError?: boolean;
    timestamp: number;
} & Record<string, unknown>;

export type LoggingOptions<TEntity extends {}, TShape> = LoggingHookOptions<TEntity, TShape> & {
    logStyle?: 'minimal' | 'detailed' | 'redux';
    maxLogEntries?: number;
};

export type LoggingHookOptions<TEntity extends {}, TShape> = {
    onQueryRequest?: LogHook<QueryLogContext<TEntity, TShape>>;
    onQueryResponse?: LogHook<QueryLogContext<TEntity, TShape>>;
    onBulkOperationsRequest?: LogHook<BulkOperationsLogContext<TEntity>>;
    onBulkOperationsResponse?: LogHook<BulkOperationsLogContext<TEntity>>;
}

// Performance indicators
const getPerformanceIndicator = (duration: number) => {
    if (duration > 1000) {
        return { emoji: '🐌', color: '#ef4444', label: 'SLOW', level: 'error' };
    }

    if (duration > 500) {
        return { emoji: '🐢', color: '#f97316', label: 'MEDIUM', level: 'warning' };
    }

    if (duration > 100) {
        return { emoji: '⚡', color: '#eab308', label: 'FAST', level: 'info' };
    }

    return { emoji: '🚀', color: '#22c55e', label: 'INSTANT', level: 'success' };
};

// Generate unique operation IDs
const generateOperationId = () => uuid(8);

// Redux-style action logging
const logReduxAction = (action: string, payload: any, meta?: any) => {
    const timestamp = new Date().toISOString();
    const actionId = generateOperationId();

    console.groupCollapsed(
        `%c${action} %c@ ${timestamp}`,
        'color: #3b82f6; font-weight: bold; font-size: 14px;',
        'color: #6b7280; font-size: 12px;'
    );

    console.group('Action');
    console.log('Type:', action);
    console.log('ID:', actionId);
    console.log('Timestamp:', timestamp);
    console.groupEnd();

    if (payload) {
        console.group('Payload');
        console.log(payload);
        console.groupEnd();
    }

    if (meta) {
        console.group('Meta');
        console.log(meta);
        console.groupEnd();
    }

    console.groupEnd();
};

// Enhanced error logging
const logError = (error: any, context: string, isCritical: boolean = false) => {
    const errorStyle = isCritical
        ? 'color: #dc2626; font-weight: bold; background: #fef2f2; padding: 4px 8px; border-radius: 4px;'
        : 'color: #ea580c; font-weight: bold; background: #fff7ed; padding: 4px 8px; border-radius: 4px;';

    console.groupCollapsed(`%c${isCritical ? '💀 CRITICAL ERROR' : '❌ ERROR'} in ${context}`, errorStyle);

    if (isCritical) {
        console.log('%cThis error occurred during operation execution and may indicate a system failure.', 'color: #dc2626; font-weight: bold;');
    }

    console.error('Error Details:', error);

    if (error.stack) {
        console.group('Stack Trace');
        console.log(error.stack);
        console.groupEnd();
    }

    if (error.message) {
        console.log('Error Message:', error.message);
    }

    console.groupEnd();
};

// Enhanced duration logging
const logDuration = (duration: number, performance: ReturnType<typeof getPerformanceIndicator>) => {
    console.log(
        `%c⏱️ Duration: ${duration.toFixed(2)}ms %c(${performance.label})`,
        `color: ${performance.color}; font-weight: bold; font-size: 13px;`,
        `color: #6b7280; font-size: 12px;`
    );
};

export class DbPluginLogging implements IDbPlugin {
    private plugin: IDbPlugin;
    private _logStyle: 'minimal' | 'detailed' | 'redux';
    private _hooks: Omit<LoggingOptions<any, any>, "logStyle" | "maxLogEntries" | "enableTimeline">;
    private _shouldLog: boolean;
    private _maxLogEntries: number;
    private _logHistory: Array<{ type: string; timestamp: number; data: any }> = [];

    private constructor(plugin: IDbPlugin, options?: LoggingOptions<any, any>) {
        this.plugin = plugin;
        this._logStyle = options?.logStyle ?? 'redux';
        this._maxLogEntries = options?.maxLogEntries ?? 100;
        this._hooks = {
            onQueryRequest: options?.onQueryRequest,
            onQueryResponse: options?.onQueryResponse,
            onBulkOperationsRequest: options?.onBulkOperationsRequest,
            onBulkOperationsResponse: options?.onBulkOperationsResponse
        };
        this._shouldLog = isDevelopment;
    }

    /**
     * Creates a new DbPluginLogging that wraps a database plugin with Redux-style logging functionality.
     * 
     * @param config Configuration object with Instance, options, and optional args
     * @returns A new LoggingPlugin instance that extends the provided class
     */
    static wrap<T extends IDbPlugin, A extends any[]>({
        Instance,
        options
    }: {
        Instance: new (...args: A) => T;
        args: A;
        options?: LoggingOptions<any, any>
    }) {

        // Create a new class that extends the provided Instance
        class LoggingPlugin extends (Instance as any) {
            _logStyle: 'minimal' | 'detailed' | 'redux';
            _hooks: Omit<LoggingOptions<any, any>, "logStyle" | "maxLogEntries" | "enableTimeline">;
            _shouldLog: boolean;
            _maxLogEntries: number;
            _logHistory: Array<{ type: string; timestamp: number; data: any }> = [];

            constructor(...args: ConstructorParameters<typeof Instance>) {
                super(...args);
                this._logStyle = options?.logStyle ?? 'redux';
                this._maxLogEntries = options?.maxLogEntries ?? 100;
                this._hooks = {
                    onQueryRequest: options?.onQueryRequest,
                    onQueryResponse: options?.onQueryResponse,
                    onBulkOperationsRequest: options?.onBulkOperationsRequest,
                    onBulkOperationsResponse: options?.onBulkOperationsResponse
                };
                this._shouldLog = isDevelopment;
            }

            addToHistory(type: string, data: any) {
                this._logHistory.push({
                    type,
                    timestamp: Date.now(),
                    data
                });

                // Keep only the last N entries
                if (this._logHistory.length > this._maxLogEntries) {
                    this._logHistory = this._logHistory.slice(-this._maxLogEntries);
                }
            }

            _logQueryRequest<TRoot extends {}, TShape extends unknown = TRoot>(
                context: QueryLogContext<TRoot, TShape>
            ): void {
                const { query, schema, id, timestamp } = context;

                if (this._logStyle === 'redux') {
                    logReduxAction(
                        'QUERY_REQUEST',
                        {
                            collection: schema.collectionName,
                            schemaId: schema.id,
                            changeTracking: query.changeTracking
                        },
                        {
                            operationId: id,
                            timestamp: new Date(timestamp).toISOString(),
                            options: this._extractQueryOptions(query)
                        }
                    );
                } else if (this._logStyle === 'detailed') {
                    console.groupCollapsed(`🔍 Query Request [${schema.collectionName}]`);
                    console.log('Operation ID:', id);
                    console.log('Schema:', schema.collectionName);
                    console.log('Change Tracking:', query.changeTracking);
                    console.log('Options:', this._extractQueryOptions(query));
                    console.groupEnd();
                } else {
                    console.log(`🔍 Query [${schema.collectionName}] started`);
                }

                this.addToHistory('QUERY_REQUEST', context);
            }

            _logQueryResult<TRoot extends {}, TShape extends unknown = TRoot>(
                context: QueryLogContext<TRoot, TShape>
            ): void {
                const { result, error, duration, isCriticalError, schema, id, timestamp } = context;
                const performance = getPerformanceIndicator(duration);

                if (this._logStyle === 'redux') {
                    if (error) {
                        logReduxAction(
                            'QUERY_ERROR',
                            {
                                collection: schema.collectionName,
                                error: error.message || error,
                                isCritical: isCriticalError
                            },
                            {
                                operationId: id,
                                duration,
                                timestamp: new Date(timestamp).toISOString(),
                                performance: performance.label
                            }
                        );
                        logError(error, `Query [${schema.collectionName}]`, isCriticalError);
                    } else {
                        logReduxAction(
                            'QUERY_SUCCESS',
                            {
                                collection: schema.collectionName,
                                resultCount: this._getResultCount(result),
                                resultType: this._getResultType(result)
                            },
                            {
                                operationId: id,
                                duration,
                                timestamp: new Date(timestamp).toISOString(),
                                performance: performance.label
                            }
                        );

                        // Log detailed result information
                        this._logQueryResultDetails(context, performance);
                    }
                } else if (this._logStyle === 'detailed') {
                    this._logDetailedQueryResult(context, performance);
                } else {
                    // Minimal logging
                    if (error) {
                        const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                        console.error(`${isCriticalError ? '💀' : '❌'} Query ${errorType} [${schema.collectionName}]:`, error);
                    } else {
                        console.log(`✅ Query [${schema.collectionName}] completed in ${duration.toFixed(2)}ms`);
                    }
                }

                this.addToHistory('QUERY_RESULT', context);
            }

            _logQueryResultDetails<TRoot extends {}, TShape extends unknown = TRoot>(
                context: QueryLogContext<TRoot, TShape>,
                performance: ReturnType<typeof getPerformanceIndicator>
            ): void {
                const { result, schema } = context;

                console.group('Result Details');

                if (Array.isArray(result)) {
                    console.log(`📊 Array Result: ${result.length} items`);

                    if (result.length > 0) {
                        if (result.length <= 5) {
                            console.table(result);
                        } else {
                            console.log('First 3 items:');
                            console.table(result.slice(0, 3));
                            console.log(`... and ${result.length - 3} more items`);
                        }
                    }
                } else if (result !== null && typeof result === 'object') {
                    console.log('📊 Object Result:');
                    console.log(result);
                } else {
                    console.log('📊 Primitive Result:', result);
                }

                console.groupEnd();

                logDuration(context.duration, performance);
            }

            _logDetailedQueryResult<TRoot extends {}, TShape extends unknown = TRoot>(
                context: QueryLogContext<TRoot, TShape>,
                performance: ReturnType<typeof getPerformanceIndicator>
            ): void {
                const { query, result, error, duration, isCriticalError, schema } = context;

                const headerTitle = error
                    ? `${isCriticalError ? '💀' : '❌'} Query Error [${schema.collectionName}]`
                    : `${performance.emoji} Query Success [${schema.collectionName}]`;

                const headerStyle = error
                    ? `color: ${isCriticalError ? '#dc2626' : '#ea580c'}; font-weight: bold;`
                    : `color: ${performance.color}; font-weight: bold;`;

                console.groupCollapsed(`%c${headerTitle}`, headerStyle);

                if (error) {
                    logError(error, `Query [${schema.collectionName}]`, isCriticalError);
                } else {
                    this._logQueryResultDetails(context, performance);
                }

                console.groupEnd();
            }

            _extractQueryOptions(query: IQuery<any, any>) {
                const options: Record<string, any> = {};

                if (query.options) {
                    const optionTypes = ['skip', 'take', 'sort', 'filter', 'map', 'distinct', 'count', 'sum', 'min', 'max'] as const;

                    optionTypes.forEach(type => {
                        try {
                            const values = query.options.getValues(type);
                            if (values.length > 0) {
                                options[type] = values;
                            }
                        } catch (e) {
                            // Skip if option type is not supported
                        }
                    });
                }

                return options;
            }

            _getResultCount(result: any): string {
                if (Array.isArray(result)) {
                    return `${result.length} items`;
                } else if (result !== null && typeof result === 'object') {
                    return '1 object';
                } else {
                    return '1 primitive';
                }
            }

            _getResultType(result: any): string {
                if (Array.isArray(result)) {
                    return 'array';
                } else if (result !== null && typeof result === 'object') {
                    return 'object';
                } else {
                    return typeof result;
                }
            }

            _logBulkOperationsRequest<TRoot extends {}>(
                context: BulkOperationsLogContext<TRoot>
            ): void {
                const { schemas, operations, operationId, timestamp } = context;
                const totalOperations = this._countTotalOperations(operations);

                if (this._logStyle === 'redux') {
                    logReduxAction(
                        'BULK_OPERATIONS_REQUEST',
                        {
                            totalOperations,
                            schemaCount: schemas.size,
                            operations: this._extractBulkOperations(operations)
                        },
                        {
                            operationId,
                            timestamp: new Date(timestamp).toISOString()
                        }
                    );
                } else if (this._logStyle === 'detailed') {
                    console.groupCollapsed(`🔄 Bulk Operations Request [${totalOperations} operations]`);
                    console.log('Operation ID:', operationId);
                    console.log('Total Operations:', totalOperations);
                    console.log('Schemas:', schemas.size);
                    console.log('Operations:', this._extractBulkOperations(operations));
                    console.groupEnd();
                } else {
                    console.log(`🔄 Bulk Operations [${totalOperations} operations] started`);
                }

                this.addToHistory('BULK_OPERATIONS_REQUEST', context);
            }

            _logBulkOperationsResult<TRoot extends {}>(
                context: BulkOperationsLogContext<TRoot>
            ): void {
                const { schemas, operations, result, error, duration, isCriticalError, operationId, timestamp } = context;
                const performance = getPerformanceIndicator(duration);
                const totalOperations = this._countTotalOperations(operations);

                if (this._logStyle === 'redux') {
                    if (error) {
                        logReduxAction(
                            'BULK_OPERATIONS_ERROR',
                            {
                                totalOperations,
                                error: error.message || error,
                                isCritical: isCriticalError
                            },
                            {
                                operationId,
                                duration,
                                timestamp: new Date(timestamp).toISOString(),
                                performance: performance.label
                            }
                        );
                        logError(error, 'Bulk Operations', isCriticalError);
                    } else {
                        logReduxAction(
                            'BULK_OPERATIONS_SUCCESS',
                            {
                                totalOperations,
                                completedOperations: this._countCompletedOperations(result),
                                schemaCount: schemas.size
                            },
                            {
                                operationId,
                                duration,
                                timestamp: new Date(timestamp).toISOString(),
                                performance: performance.label
                            }
                        );

                        // Log detailed result information
                        this._logBulkOperationsResultDetails(context, performance);
                    }
                } else if (this._logStyle === 'detailed') {
                    this._logDetailedBulkOperationsResult(context, performance);
                } else {
                    // Minimal logging
                    if (error) {
                        const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                        console.error(`${isCriticalError ? '💀' : '❌'} Bulk Operations ${errorType}:`, error);
                    } else {
                        console.log(`✅ Bulk Operations [${totalOperations} operations] completed in ${duration.toFixed(2)}ms`);
                    }
                }

                this.addToHistory('BULK_OPERATIONS_RESULT', context);
            }

            _logBulkOperationsResultDetails<TRoot extends {}>(
                context: BulkOperationsLogContext<TRoot>,
                performance: ReturnType<typeof getPerformanceIndicator>
            ): void {
                const { result, schemas } = context;

                console.group('Result Details');

                if (result) {
                    const completedCount = this._countCompletedOperations(result);
                    console.log(`📊 Completed: ${completedCount} operations`);

                    // Show results by schema
                    for (const [schemaId, operationResult] of result.result.all().data) {
                        const schema = schemas.get(schemaId);
                        const schemaName = schema?.collectionName || `Schema ${schemaId}`;

                        console.groupCollapsed(`${schemaName} Results`);
                        console.log(operationResult);
                        console.groupEnd();
                    }
                }

                console.groupEnd();

                logDuration(context.duration, performance);
            }

            _logDetailedBulkOperationsResult<TRoot extends {}>(
                context: BulkOperationsLogContext<TRoot>,
                performance: ReturnType<typeof getPerformanceIndicator>
            ): void {
                const { error, isCriticalError } = context;
                const totalOperations = this._countTotalOperations(context.operations);

                const headerTitle = error
                    ? `${isCriticalError ? '💀' : '❌'} Bulk Operations Error`
                    : `${performance.emoji} Bulk Operations Success [${totalOperations} operations]`;

                const headerStyle = error
                    ? `color: ${isCriticalError ? '#dc2626' : '#ea580c'}; font-weight: bold;`
                    : `color: ${performance.color}; font-weight: bold;`;

                console.groupCollapsed(`%c${headerTitle}`, headerStyle);

                if (error) {
                    logError(error, 'Bulk Operations', isCriticalError);
                } else {
                    this._logBulkOperationsResultDetails(context, performance);
                }

                console.groupEnd();
            }

            _countTotalOperations(operations: PendingChanges<any>): number {
                return operations.changes.all().data.length;
            }

            _countCompletedOperations(result: ResolvedChanges<any> | undefined): number {
                if (!result) {
                    return 0;
                }

                return result.result.all().data.length;
            }

            _extractBulkOperations(operations: PendingChanges<any>) {
                const summary: Record<string, number> = {};

                for (const [_, operation] of operations.changes.all().data) {
                    if ('entity' in operation) {
                        summary.single = (summary.single || 0) + 1;
                    } else {
                        summary.update = (summary.update || 0) + 1;
                    }
                }

                return summary;
            }

            bulkPersist<TRoot extends {}>(event: DbPluginBulkPersistEvent<TRoot>, done: CallbackPartialResult<ResolvedChanges<TRoot>>): void {
                const { operation, schemas } = event;
                const start = now();
                const operationId = generateOperationId();
                const timestamp = Date.now();

                // Create context for hooks and logging
                const context: BulkOperationsLogContext<TRoot> = {
                    schemas,
                    operations: operation.toResult(),
                    duration: 0,
                    operationId,
                    timestamp
                };

                // Log the bulk operations request
                if (this._shouldLog) {
                    this._logBulkOperationsRequest(context);
                }

                // Call the request hook if defined
                if (this._hooks.onBulkOperationsRequest) {
                    this._hooks.onBulkOperationsRequest(context);
                }

                try {
                    super.bulkPersist(event, (result: ResultType<ResolvedChanges<TRoot>>) => {
                        const end = now();
                        const duration = end - start;

                        // Update context with result information
                        if (result.ok === Result.SUCCESS) {
                            context.result = result.data;
                        } else {
                            context.error = result.error;
                        }

                        context.duration = duration;
                        context.isCriticalError = false;

                        // Log bulk operations result
                        if (this._shouldLog) {
                            this._logBulkOperationsResult(context);
                        }

                        // Call the response hook if defined
                        if (this._hooks.onBulkOperationsResponse) {
                            this._hooks.onBulkOperationsResponse(context);
                        }

                        // Pass through the original result
                        done(result);
                    });
                } catch (e: any) {
                    const end = now();
                    const duration = end - start;

                    // Update context with error information
                    context.error = e;
                    context.duration = duration;
                    context.isCriticalError = true;

                    // Log the error
                    if (this._shouldLog) {
                        this._logBulkOperationsResult(context);
                    }

                    // Call the response hook if defined
                    if (this._hooks.onBulkOperationsResponse) {
                        this._hooks.onBulkOperationsResponse(context);
                    }

                    done(Result.error(e));
                }
            }

            destroy<TRoot extends {}>(event: DbPluginEvent<TRoot>, done: CallbackResult<never>): void {
                try {
                    super.destroy(event, done);
                } catch (e: any) {
                    done(e);
                }
            }

            query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: CallbackResult<TShape>): void {
                const { operation, schemas } = event;
                const start = now();
                const operationId = generateOperationId();
                const timestamp = Date.now();

                // Create context for hooks and logging
                const context: QueryLogContext<TRoot, TShape> = {
                    query: operation,
                    duration: 0,
                    schema: operation.schema,
                    timestamp,
                    id: operationId
                };

                // Log the query request
                if (this._shouldLog) {
                    this._logQueryRequest(context);
                }

                // Call the request hook if defined
                if (this._hooks.onQueryRequest) {
                    this._hooks.onQueryRequest(context);
                }

                try {
                    // Wrap the callback to measure and log the execution time
                    super.query(event, (result: ResultType<TShape>) => {
                        const end = now();
                        const duration = end - start;

                        if (result.ok === Result.SUCCESS) {
                            context.result = result.data;
                        } else {
                            context.error = result.error;
                        }

                        // Update context with result information
                        context.duration = duration;
                        context.isCriticalError = false;

                        // Log the query result
                        if (this._shouldLog) {
                            this._logQueryResult(context);
                        }

                        // Call the response hook if defined
                        if (this._hooks.onQueryResponse) {
                            this._hooks.onQueryResponse(context);
                        }

                        // Call the original callback
                        done(result);
                    });
                } catch (e: any) {
                    const end = now();
                    const duration = end - start;

                    // Update context with error information
                    context.error = e;
                    context.duration = duration;
                    context.isCriticalError = true;

                    // Log the error
                    if (this._shouldLog) {
                        this._logQueryResult(context);
                    }

                    // Call the response hook if defined
                    if (this._hooks.onQueryResponse) {
                        this._hooks.onQueryResponse(context);
                    }

                    done(Result.error(e));
                }
            }

            /**
             * Get the log history for debugging purposes
             */
            getLogHistory() {
                return [...this._logHistory];
            }

            /**
             * Clear the log history
             */
            clearLogHistory() {
                this._logHistory = [];
            }
        };

        return LoggingPlugin;
    }

    /**
     * Adds or updates a hook for extending the logging functionality
     * @param hookName The name of the hook to set
     * @param hookFn The hook function to call
     */
    setHook<N extends keyof LoggingHookOptions<unknown, unknown>>(hookName: N, hookFn: LoggingHookOptions<unknown, unknown>[N]) {
        this._hooks[hookName] = hookFn;
        return this;
    }

    /**
     * Get the log history for debugging purposes
     */
    getLogHistory() {
        return [...this._logHistory];
    }

    /**
     * Clear the log history
     */
    clearLogHistory() {
        this._logHistory = [];
    }

    private addToHistory(type: string, data: any) {
        this._logHistory.push({
            type,
            timestamp: Date.now(),
            data
        });

        // Keep only the last N entries
        if (this._logHistory.length > this._maxLogEntries) {
            this._logHistory = this._logHistory.slice(-this._maxLogEntries);
        }
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {
        const { operation, schemas } = event;
        const start = now();
        const operationId = generateOperationId();
        const timestamp = Date.now();

        // Create context for hooks and logging
        const context: QueryLogContext<TEntity, TShape> = {
            query: operation,
            duration: 0,
            schema: operation.schema,
            timestamp,
            id: operationId
        };

        // Log the query request
        if (this._shouldLog) {
            this._logQueryRequest(context);
        }

        // Call the request hook if defined
        if (this._hooks.onQueryRequest) {
            this._hooks.onQueryRequest(context);
        }

        try {
            // Wrap the callback to measure and log the execution time
            this.plugin.query(event, (result) => {
                const end = now();
                const duration = end - start;

                if (result.ok === Result.SUCCESS) {
                    context.result = result.data;
                } else {
                    context.error = result.error;
                }

                // Update context with result information
                context.duration = duration;
                context.isCriticalError = false;

                // Log the query result
                if (this._shouldLog) {
                    this._logQueryResult(context);
                }

                // Call the response hook if defined
                if (this._hooks.onQueryResponse) {
                    this._hooks.onQueryResponse(context);
                }

                // Call the original callback
                done(result);
            });
        } catch (e: any) {
            const end = now();
            const duration = end - start;

            // Update context with error information
            context.error = e;
            context.duration = duration;
            context.isCriticalError = true;

            // Log the error
            if (this._shouldLog) {
                this._logQueryResult(context);
            }

            // Call the response hook if defined
            if (this._hooks.onQueryResponse) {
                this._hooks.onQueryResponse(context);
            }

            done(Result.error(e));
        }
    }

    private _logQueryRequest<TEntity extends {}, TShape extends any = TEntity>(
        context: QueryLogContext<TEntity, TShape>
    ): void {
        const { query, schema, id, timestamp } = context;

        if (this._logStyle === 'redux') {
            logReduxAction(
                'QUERY_REQUEST',
                {
                    collection: schema.collectionName,
                    schemaId: schema.id,
                    changeTracking: query.changeTracking
                },
                {
                    operationId: id,
                    timestamp: new Date(timestamp).toISOString(),
                    options: this._extractQueryOptions(query)
                }
            );
        } else if (this._logStyle === 'detailed') {
            console.groupCollapsed(`🔍 Query Request [${schema.collectionName}]`);
            console.log('Operation ID:', id);
            console.log('Schema:', schema.collectionName);
            console.log('Change Tracking:', query.changeTracking);
            console.log('Options:', this._extractQueryOptions(query));
            console.groupEnd();
        } else {
            console.log(`🔍 Query [${schema.collectionName}] started`);
        }

        this.addToHistory('QUERY_REQUEST', context);
    }

    private _logQueryResult<TEntity extends {}, TShape extends any = TEntity>(
        context: QueryLogContext<TEntity, TShape>
    ): void {
        const { result, error, duration, isCriticalError, schema, id, timestamp } = context;
        const performance = getPerformanceIndicator(duration);

        if (this._logStyle === 'redux') {
            if (error) {
                logReduxAction(
                    'QUERY_ERROR',
                    {
                        collection: schema.collectionName,
                        error: error.message || error,
                        isCritical: isCriticalError
                    },
                    {
                        operationId: id,
                        duration,
                        timestamp: new Date(timestamp).toISOString(),
                        performance: performance.label
                    }
                );
                logError(error, `Query [${schema.collectionName}]`, isCriticalError);
            } else {
                logReduxAction(
                    'QUERY_SUCCESS',
                    {
                        collection: schema.collectionName,
                        resultCount: this._getResultCount(result),
                        resultType: this._getResultType(result)
                    },
                    {
                        operationId: id,
                        duration,
                        timestamp: new Date(timestamp).toISOString(),
                        performance: performance.label
                    }
                );

                // Log detailed result information
                this._logQueryResultDetails(context, performance);
            }
        } else if (this._logStyle === 'detailed') {
            this._logDetailedQueryResult(context, performance);
        } else {
            // Minimal logging
            if (error) {
                const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                console.error(`${isCriticalError ? '💀' : '❌'} Query ${errorType} [${schema.collectionName}]:`, error);
            } else {
                console.log(`✅ Query [${schema.collectionName}] completed in ${duration.toFixed(2)}ms`);
            }
        }

        this.addToHistory('QUERY_RESULT', context);
    }

    private _logQueryResultDetails<TEntity extends {}, TShape extends any = TEntity>(
        context: QueryLogContext<TEntity, TShape>,
        performance: ReturnType<typeof getPerformanceIndicator>
    ): void {
        const { result, schema } = context;

        console.group('Result Details');

        if (Array.isArray(result)) {
            console.log(`📊 Array Result: ${result.length} items`);

            if (result.length > 0) {
                if (result.length <= 5) {
                    console.table(result);
                } else {
                    console.log('First 3 items:');
                    console.table(result.slice(0, 3));
                    console.log(`... and ${result.length - 3} more items`);
                }
            }
        } else if (result !== null && typeof result === 'object') {
            console.log('📊 Object Result:');
            console.log(result);
        } else {
            console.log('📊 Primitive Result:', result);
        }

        console.groupEnd();

        logDuration(context.duration, performance);
    }

    private _logDetailedQueryResult<TEntity extends {}, TShape extends any = TEntity>(
        context: QueryLogContext<TEntity, TShape>,
        performance: ReturnType<typeof getPerformanceIndicator>
    ): void {
        const { query, result, error, duration, isCriticalError, schema } = context;

        const headerTitle = error
            ? `${isCriticalError ? '💀' : '❌'} Query Error [${schema.collectionName}]`
            : `${performance.emoji} Query Success [${schema.collectionName}]`;

        const headerStyle = error
            ? `color: ${isCriticalError ? '#dc2626' : '#ea580c'}; font-weight: bold;`
            : `color: ${performance.color}; font-weight: bold;`;

        console.groupCollapsed(`%c${headerTitle}`, headerStyle);

        if (error) {
            logError(error, `Query [${schema.collectionName}]`, isCriticalError);
        } else {
            this._logQueryResultDetails(context, performance);
        }

        console.groupEnd();
    }

    private _extractQueryOptions(query: IQuery<any, any>) {
        const options: Record<string, any> = {};

        if (query.options) {
            const optionTypes = ['skip', 'take', 'sort', 'filter', 'map', 'distinct', 'count', 'sum', 'min', 'max'] as const;

            optionTypes.forEach(type => {
                try {
                    const values = query.options.getValues(type);
                    if (values.length > 0) {
                        options[type] = values;
                    }
                } catch (e) {
                    // Skip if option type is not supported
                }
            });
        }

        return options;
    }

    private _getResultCount(result: any): string {
        if (Array.isArray(result)) {
            return `${result.length} items`;
        } else if (result !== null && typeof result === 'object') {
            return '1 object';
        } else {
            return '1 primitive';
        }
    }

    private _getResultType(result: any): string {
        if (Array.isArray(result)) {
            return 'array';
        } else if (result !== null && typeof result === 'object') {
            return 'object';
        } else {
            return typeof result;
        }
    }

    destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: (error?: any) => void): void {
        try {
            this.plugin.destroy(event, done);
        } catch (e: any) {
            done(e);
        }
    }

    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: CallbackPartialResult<ResolvedChanges<TEntity>>): void {
        const { operation, schemas } = event;
        const start = now();
        const operationId = generateOperationId();
        const timestamp = Date.now();

        // Create context for hooks and logging
        const context: BulkOperationsLogContext<TEntity> = {
            schemas,
            operations: operation.toResult(),
            duration: 0,
            operationId,
            timestamp
        };

        // Log the bulk operations request
        if (this._shouldLog) {
            this._logBulkOperationsRequest(context);
        }

        // Call the request hook if defined
        if (this._hooks.onBulkOperationsRequest) {
            this._hooks.onBulkOperationsRequest(context);
        }

        try {
            this.plugin.bulkPersist(event, (result) => {
                const end = now();
                const duration = end - start;

                // Update context with result information
                if (result.ok === Result.SUCCESS) {
                    context.result = result.data;
                } else {
                    context.error = result.error;
                }

                context.duration = duration;
                context.isCriticalError = false;

                // Log bulk operations result
                if (this._shouldLog) {
                    this._logBulkOperationsResult(context);
                }

                // Call the response hook if defined
                if (this._hooks.onBulkOperationsResponse) {
                    this._hooks.onBulkOperationsResponse(context);
                }

                // Pass through the original result
                done(result);
            });
        } catch (e: any) {
            const end = now();
            const duration = end - start;

            // Update context with error information
            context.error = e;
            context.duration = duration;
            context.isCriticalError = true;

            // Log the error
            if (this._shouldLog) {
                this._logBulkOperationsResult(context);
            }

            // Call the response hook if defined
            if (this._hooks.onBulkOperationsResponse) {
                this._hooks.onBulkOperationsResponse(context);
            }

            done(Result.error(e));
        }
    }

    private _logBulkOperationsRequest<TEntity extends {}>(
        context: BulkOperationsLogContext<TEntity>
    ): void {
        const { schemas, operations, operationId, timestamp } = context;
        const totalOperations = this._countTotalOperations(operations);

        if (this._logStyle === 'redux') {
            logReduxAction(
                'BULK_OPERATIONS_REQUEST',
                {
                    totalOperations,
                    schemaCount: schemas.size,
                    operations: this._extractBulkOperations(operations)
                },
                {
                    operationId,
                    timestamp: new Date(timestamp).toISOString()
                }
            );
        } else if (this._logStyle === 'detailed') {
            console.groupCollapsed(`🔄 Bulk Operations Request [${totalOperations} operations]`);
            console.log('Operation ID:', operationId);
            console.log('Total Operations:', totalOperations);
            console.log('Schemas:', schemas.size);
            console.log('Operations:', this._extractBulkOperations(operations));
            console.groupEnd();
        } else {
            console.log(`🔄 Bulk Operations [${totalOperations} operations] started`);
        }

        this.addToHistory('BULK_OPERATIONS_REQUEST', context);
    }

    private _logBulkOperationsResult<TEntity extends {}>(
        context: BulkOperationsLogContext<TEntity>
    ): void {
        const { schemas, operations, result, error, duration, isCriticalError, operationId, timestamp } = context;
        const performance = getPerformanceIndicator(duration);
        const totalOperations = this._countTotalOperations(operations);

        if (this._logStyle === 'redux') {
            if (error) {
                logReduxAction(
                    'BULK_OPERATIONS_ERROR',
                    {
                        totalOperations,
                        error: error.message || error,
                        isCritical: isCriticalError
                    },
                    {
                        operationId,
                        duration,
                        timestamp: new Date(timestamp).toISOString(),
                        performance: performance.label
                    }
                );
                logError(error, 'Bulk Operations', isCriticalError);
            } else {
                logReduxAction(
                    'BULK_OPERATIONS_SUCCESS',
                    {
                        totalOperations,
                        completedOperations: this._countCompletedOperations(result),
                        schemaCount: schemas.size
                    },
                    {
                        operationId,
                        duration,
                        timestamp: new Date(timestamp).toISOString(),
                        performance: performance.label
                    }
                );

                // Log detailed result information
                this._logBulkOperationsResultDetails(context, performance);
            }
        } else if (this._logStyle === 'detailed') {
            this._logDetailedBulkOperationsResult(context, performance);
        } else {
            // Minimal logging
            if (error) {
                const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                console.error(`${isCriticalError ? '💀' : '❌'} Bulk Operations ${errorType}:`, error);
            } else {
                console.log(`✅ Bulk Operations [${totalOperations} operations] completed in ${duration.toFixed(2)}ms`);
            }
        }

        this.addToHistory('BULK_OPERATIONS_RESULT', context);
    }

    private _logBulkOperationsResultDetails<TEntity extends {}>(
        context: BulkOperationsLogContext<TEntity>,
        performance: ReturnType<typeof getPerformanceIndicator>
    ): void {
        const { result, schemas } = context;

        console.group('Result Details');

        if (result) {
            const completedCount = this._countCompletedOperations(result);
            console.log(`📊 Completed: ${completedCount} operations`);

            // Show results by schema
            for (const [schemaId, operationResult] of result.result.all().data) {
                const schema = schemas.get(schemaId);
                const schemaName = schema?.collectionName || `Schema ${schemaId}`;

                console.groupCollapsed(`${schemaName} Results`);
                console.log(operationResult);
                console.groupEnd();
            }
        }

        console.groupEnd();

        logDuration(context.duration, performance);
    }

    private _logDetailedBulkOperationsResult<TEntity extends {}>(
        context: BulkOperationsLogContext<TEntity>,
        performance: ReturnType<typeof getPerformanceIndicator>
    ): void {
        const { error, isCriticalError } = context;
        const totalOperations = this._countTotalOperations(context.operations);

        const headerTitle = error
            ? `${isCriticalError ? '💀' : '❌'} Bulk Operations Error`
            : `${performance.emoji} Bulk Operations Success [${totalOperations} operations]`;

        const headerStyle = error
            ? `color: ${isCriticalError ? '#dc2626' : '#ea580c'}; font-weight: bold;`
            : `color: ${performance.color}; font-weight: bold;`;

        console.groupCollapsed(`%c${headerTitle}`, headerStyle);

        if (error) {
            logError(error, 'Bulk Operations', isCriticalError);
        } else {
            this._logBulkOperationsResultDetails(context, performance);
        }

        console.groupEnd();
    }

    private _countTotalOperations(operations: PendingChanges<any>): number {
        return operations.changes.all().data.length;
    }

    private _countCompletedOperations(result: ResolvedChanges<any> | undefined): number {
        if (!result) {
            return 0;

        }

        return result.result.all().data.length;
    }

    private _extractBulkOperations(operations: PendingChanges<any>) {
        const summary: Record<string, number> = {};

        for (const [_, operation] of operations.changes.all().data) {
            if ('entity' in operation) {
                summary.single = (summary.single || 0) + 1;
            } else {
                summary.update = (summary.update || 0) + 1;
            }
        }

        return summary;
    }
}