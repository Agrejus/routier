import { Result } from '../common/Result';
import { CompiledSchema, InferType, SchemaId } from '../schema';
import { CallbackResult, DeepPartial } from '../types';
import { now } from '../utilities/index';
import { CollectionChanges, CollectionChangesResult, DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, IQuery } from './types';

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
};

export type BulkOperationsLogContext<TEntity extends {}> = {
    schemas: Map<SchemaId, CompiledSchema<TEntity>>;
    operations: CollectionChanges<TEntity>;
    result?: CollectionChangesResult<TEntity>;
    error?: any;
    duration: number;
    operationId: string;
    isCriticalError?: boolean;
} & Record<string, unknown>;

export type LoggingOptions<TEntity extends {}, TShape> = LoggingHookOptions<TEntity, TShape> & {
    logStyle?: 'minimal' | 'detailed';
};

export type LoggingHookOptions<TEntity extends {}, TShape> = {
    onQueryRequest?: LogHook<QueryLogContext<TEntity, TShape>>;
    onQueryResponse?: LogHook<QueryLogContext<TEntity, TShape>>;
    onBulkOperationsRequest?: LogHook<BulkOperationsLogContext<TEntity>>;
    onBulkOperationsResponse?: LogHook<BulkOperationsLogContext<TEntity>>;
}

// Helper functions to reduce code duplication
const logEntities = (data: { entities: any[] }, count: number) => {
    let loggedCount = 0;
    // Show all if there are just a few
    data.entities.forEach((item, i) => {
        if (loggedCount >= count) {
            return;
        }

        console.log(`[${i}]:`, item);
        loggedCount++;
    });
}

const logEntitiesWithLimit = (data: { entities: any[] }, totalCount: number, maxShow: number = 5) => {
    if (totalCount <= maxShow) {
        logEntities(data, maxShow);
    } else {
        console.log(`Showing first 3 of ${totalCount}:`);
        logEntities(data, 3);
        console.log(`... and ${totalCount - 3} more`);
    }
}

const logArrayWithLimit = <T>(items: T[], totalCount: number, maxShow: number = 5, logFn: (item: T, index: number) => void) => {
    if (totalCount <= maxShow) {
        items.forEach(logFn);
    } else {
        console.log(`Showing first 3 of ${totalCount}:`);
        items.slice(0, 3).forEach(logFn);
        console.log(`... and ${totalCount - 3} more`);
    }
}

const getSpeedInfo = (duration: number) => {
    if (duration > 1000) {
        return {
            emoji: '🐢',
            color: '#F44336',
            text: 'SLOW'
        };
    } else if (duration > 300) {
        return {
            emoji: '⏱️',
            color: '#FF9800',
            text: 'MEDIUM'
        };
    } else {
        return {
            emoji: '⚡',
            color: '#4CAF50',
            text: 'FAST'
        };
    }
}

const formatResult = <T extends {}>(result: CollectionChangesResult<T>) => {
    const entities = {
        adds: result.adds,
        updates: result.updates,
    }

    const counts = {
        adds: entities.adds.entities.length,
        updates: entities.updates.entities.length,
        removes: result.removed.count,
        total: 0
    }

    counts.total = counts.adds + counts.updates + counts.removes

    return {
        entities,
        counts
    }
}

const formatRequest = <T extends {}>(operations: CollectionChanges<T>) => {
    const entities = {
        adds: operations.adds,
        updates: operations.updates,
        removes: operations.removes
    }

    const counts = {
        adds: entities.adds.entities.length,
        updates: entities.updates.changes.length,
        removes: entities.removes.entities.length,
        total: 0
    }

    counts.total = counts.adds + counts.updates + counts.removes

    return {
        entities,
        counts
    }
}

const logErrorSection = (error: any, isCriticalError: boolean) => {
    console.groupCollapsed(`Error:`, 'color: #F44336;');
    if (isCriticalError) {
        console.log('Exception thrown during operation execution:');
    }
    console.error(error);
    console.groupEnd();
}

const logDuration = (duration: number, headerColor: string, speedText: string) => {
    console.log(
        `%cDuration:`,
        `color: ${headerColor};`,
        `${duration.toFixed(2)}ms (${speedText})`
    );
}

export class DbPluginLogging implements IDbPlugin {
    plugin: IDbPlugin;
    private _logStyle: 'minimal' | 'detailed';
    private _hooks: Omit<LoggingOptions<any, any>, "logStyle">;
    private _shouldLog: boolean;

    private constructor(plugin: IDbPlugin, options?: LoggingOptions<any, any>) {
        this.plugin = plugin;
        this._logStyle = options?.logStyle ?? 'detailed';
        this._hooks = {
            onQueryRequest: options?.onQueryRequest,
            onQueryResponse: options?.onQueryResponse,
            onBulkOperationsRequest: options?.onBulkOperationsRequest,
            onBulkOperationsResponse: options?.onBulkOperationsResponse
        };
        // Only log in development mode by default
        this._shouldLog = isDevelopment;
    }

    /**
     * Creates a new DbPluginLogging that wraps a database plugin with logging functionality.
     * 
     * @param plugin The database plugin to wrap with logging
     * @param options Configuration options for the logger
     * @returns A new DbPluginLogging instance
     */
    static create(plugin: IDbPlugin, options?: LoggingOptions<any, any>) {
        return new DbPluginLogging(plugin, options);
    }

    /**
     * Adds or updates a hook for extending the logging functionality
     * @param hookName The name of the hook to set
     * @param hookFn The hook function to call
     */
    setHook<N extends keyof LoggingHookOptions<unknown, unknown>>(hookName: N, hookFn: LoggingHookOptions<unknown, unknown>[N]) {
        this._hooks[hookName] = hookFn;
        return this; // For chaining
    }

    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {
        const { operation, schemas } = event;
        const start = now();

        // Create context for hooks and logging
        const context: QueryLogContext<TEntity, TShape> = {
            query: operation,
            duration: 0,
            schema: operation.schema
        };

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
                this._logQueryResult(context);

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
            this._logQueryResult(context);

            // Call the response hook if defined
            if (this._hooks.onQueryResponse) {
                this._hooks.onQueryResponse(context);
            }

            // Since we can't return null for TShape, we need to cast it
            done(Result.error(e));
        }
    }

    private _logQueryResult<TEntity extends {}, TShape extends any = TEntity>(
        context: QueryLogContext<TEntity, TShape>
    ): void {
        // Skip logging if not in development environment
        if (!this._shouldLog) return;

        const { query, result, error, duration, isCriticalError, schema } = context;
        const pluginName = "constructor" in this.plugin ? ` [${this.plugin.constructor.name}]` : "";
        const schemaName = schema.collectionName;

        if (this._logStyle === 'minimal') {
            if (error) {
                const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                console.error(`${isCriticalError ? '💀' : '❌'} Query ${errorType} [${schemaName}]:`, error);
            } else {
                console.log(`✅ Query [${schemaName}] completed in ${duration.toFixed(2)}ms`);
            }
            return;
        }

        const speedInfo = getSpeedInfo(duration);

        // Create appropriate header based on success/error
        const headerStyle = error
            ? `color: ${isCriticalError ? '#D50000' : '#F44336'}; font-weight: bold;`
            : `color: ${speedInfo.color}; font-weight: bold;`;

        // Add result count to the header
        let resultCount = '';
        if (!error && result != null) {
            if (Array.isArray(result)) {
                resultCount = ` (${result.length} items)`;
            } else if (typeof result === 'object' && result !== null) {
                resultCount = ' (1 item)';
            }
        }

        const headerTitle = error
            ? `${isCriticalError ? '💀' : '❌'}${pluginName} QUERY ERROR: ${schemaName}`
            : `${speedInfo.emoji}${pluginName} QUERY: ${schemaName}${resultCount}`;

        console.groupCollapsed(`%c ${headerTitle}`, headerStyle);

        // QUERY INFORMATION SECTION
        console.groupCollapsed('Request:');

        // Collection
        console.log('Collection:', schemaName);

        // Expression
        const builtIns = [
            "schema",
            "expression",
            "options",
            "filters",
            "filter",
            "changeTracking"
        ];

        for (const key in query) {
            if (builtIns.includes(key)) {
                continue;
            }

            console.groupCollapsed(`__${key}__`);
            console.log((query as any)[key]);
            console.groupEnd();
        }

        if (query.expression) {
            console.groupCollapsed('Expression:');
            console.log(query.expression);
            console.groupEnd();
        }

        // Filters
        const filters = query.options.getValues("filter");
        if (filters.length > 0) {
            console.groupCollapsed('Filters:');
            filters.forEach((filter, index) => {
                console.log(`Filter ${index + 1}:`, filter);
            });
            console.groupEnd();
        }

        // Options
        if (query.options) {
            console.groupCollapsed('Options:');

            // Clean up options for display
            const options = {
                skip: query.options.getValues("skip"),
                take: query.options.getValues("take"),
                sort: query.options.getValues("sort"),
                min: query.options.getValues("min"),
                max: query.options.getValues("max"),
                count: query.options.getValues("count"),
                sum: query.options.getValues("sum"),
                distinct: query.options.getValues("distinct"),
                map: query.options.getValues("map")
            };

            // Display as a table if possible
            console.table(
                Object.entries(options)
                    .filter(([_, value]) => value !== undefined)
                    .reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {} as any)
            );
            console.groupEnd();
        }

        // Change tracking
        const isTracking = query.changeTracking;
        console.log(
            `${isTracking ? '✓' : '✗'} Change Tracking:`,
            isTracking
        );

        console.groupEnd(); // End query details

        // RESULT SECTION
        if (error) {
            logErrorSection(error, isCriticalError);
        } else {
            // Display the result with improved formatting
            const isArray = Array.isArray(result);

            console.groupCollapsed('Response:');

            if (isArray) {
                console.log(`Total Items: ${(result as any[]).length}`);

                if ((result as any[]).length > 0) {
                    // Show summary structure for large arrays
                    if ((result as any[]).length > 10) {
                        console.log('First 3 items:');
                        (result as any[]).slice(0, 3).forEach((item, i) => {
                            console.log(`Item ${i}:`, item);
                        });
                        console.log(`... and ${(result as any[]).length - 3} more items`);
                    } else {
                        // Show all items for smaller arrays
                        console.table(result);
                    }
                } else {
                    console.log('Empty result array');
                }
            } else {
                console.log(result);
            }

            console.groupEnd();
        }

        logDuration(duration, speedInfo.color, speedInfo.text);

        console.groupEnd(); // End main group
    }

    destroy(done: (error?: any) => void): void {
        try {
            this.plugin.destroy(done);
        } catch (e: any) {
            done(e);
        }
    }

    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: CallbackResult<Map<SchemaId, CollectionChangesResult<TEntity>>>): void {
        const { operation, schemas } = event;
        const start = now();
        const operationId = Math.random().toString(36).substring(2, 8);

        // Create context for hooks and logging
        const context: BulkOperationsLogContext<TEntity> = {
            schemas,
            operations: operation,
            duration: 0,
            operationId
        };

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
                this._logBulkOperationsResult(context);

                // Call the response hook if defined
                if (this._hooks.onBulkOperationsResponse) {
                    this._hooks.onBulkOperationsResponse(context);
                }

                if (result.ok === Result.SUCCESS) {
                    done(result);
                } else {
                    done(Result.error(result.error));
                }
            });
        } catch (e: any) {
            const end = now();
            const duration = end - start;

            // Update context with error information
            context.error = e;
            context.duration = duration;
            context.isCriticalError = true;

            // Log the error
            this._logBulkOperationsResult(context);

            // Call the response hook if defined
            if (this._hooks.onBulkOperationsResponse) {
                this._hooks.onBulkOperationsResponse(context);
            }

            done(Result.error(e));
        }
    }

    private _logBulkOperationsResult<TEntity extends {}>(
        context: BulkOperationsLogContext<TEntity>
    ): void {
        // Skip logging if not in development environment
        if (!this._shouldLog) return;

        const { schema, operations, result, error, duration, isCriticalError } = context;

        if (this._logStyle === 'minimal') {
            if (error) {
                const errorType = isCriticalError ? 'CRITICAL ERROR' : 'Error';
                console.error(`${isCriticalError ? '💀' : '❌'} Bulk Operations ${errorType}:`, error);
            } else {
                console.log(`✅ Bulk Operations completed in ${duration.toFixed(2)}ms`);
            }
            return;
        }

        const pluginName = "constructor" in this.plugin ? ` [${this.plugin.constructor.name}]` : "";
        const speedInfo = getSpeedInfo(duration);

        // Create appropriate header based on success/error
        const headerStyle = error
            ? `color: ${isCriticalError ? '#D50000' : '#F44336'}; font-weight: bold;`
            : `color: ${speedInfo.color}; font-weight: bold;`;

        // Add operation count to the header
        let operationCount = '';
        const formattedResult = result ? formatResult(result) : null;
        const formattedRequest = formatRequest(operations);

        if (!error && result) {
            operationCount = ` (${formattedRequest.counts.total} → ${formattedResult!.counts.total})`;
        }

        const headerTitle = error
            ? `${isCriticalError ? '💀' : '❌'}${pluginName} BULK OPERATIONS ERROR:`
            : `${speedInfo.emoji}${pluginName} BULK OPERATIONS: ${operationCount}`;

        console.groupCollapsed(`%c ${headerTitle}`, headerStyle);

        // OPERATIONS INFORMATION SECTION
        console.groupCollapsed('Request:');

        // Show collection and summary
        // console.log('Collection:', schemaName);

        // Display summary as a table
        console.log('Summary:');
        console.table({
            'Operations': {
                adds: {
                    count: formattedRequest.counts.adds
                },
                removes: {
                    count: formattedRequest.counts.removes
                },
                updates: {
                    count: formattedRequest.counts.updates
                },
                total: formattedRequest.counts.total
            }
        });

        // Show operations in a structured format
        if (formattedRequest.counts.adds > 0) {
            console.groupCollapsed(`Adds (${formattedRequest.counts.adds}):`);
            logEntitiesWithLimit(operations.adds, formattedRequest.counts.adds);
            console.groupEnd();
        }

        if (formattedRequest.counts.removes > 0) {
            console.groupCollapsed(`Removes (${formattedRequest.counts.removes}):`);
            logEntitiesWithLimit(operations.removes, formattedRequest.counts.removes);
            console.groupEnd();
        }

        if (formattedRequest.counts.updates > 0) {
            console.groupCollapsed(`Updates (${formattedRequest.counts.updates}):`);

            const entities: DeepPartial<InferType<any>>[] = [];
            for (const item of operations.updates.changes) {
                entities.push(item.delta);

                if (entities.length >= 5) {
                    break;
                }
            }

            logArrayWithLimit(entities, formattedRequest.counts.updates, 5, (entity: DeepPartial<InferType<any>>, i: number) => {
                console.groupCollapsed(`[${i}] Update`);
                console.log('Delta:', entity);
                console.groupEnd();
            });

            console.groupEnd();
        }

        console.groupEnd(); // End operations details

        // RESULT SECTION
        if (error) {
            logErrorSection(error, isCriticalError);
        } else if (result && formattedResult) {
            // Display the results in a structured format
            console.groupCollapsed('Response:');

            // Summary information formatted as a table with before/after comparison
            console.log('Summary:');
            console.table({
                'Adds': {
                    requested: formattedRequest.counts.adds,
                    completed: formattedResult.counts.adds
                },
                'Removes': {
                    requested: formattedRequest.counts.removes,
                    completed: formattedResult.counts.removes
                },
                'Updates': {
                    requested: formattedRequest.counts.updates,
                    completed: formattedResult.counts.updates
                },
                'Total': {
                    requested: formattedRequest.counts.total,
                    completed: formattedResult.counts.total
                }
            });

            // Show result details
            if (formattedResult.counts.adds > 0) {
                console.groupCollapsed(`Add Results (${formattedResult.counts.adds}):`);
                logArrayWithLimit(formattedResult.entities.adds.entities, formattedResult.counts.adds, 5, (item: any, i: number) => {
                    console.log(`[${i}]:`, item);
                });
                console.groupEnd();
            }

            if (formattedResult.counts.updates > 0) {
                console.groupCollapsed(`Update Results (${formattedResult.counts.updates}):`);
                logArrayWithLimit(Array.from(result.updates.entities), formattedResult.counts.updates, 5, (item: any, i: number) => {
                    console.log(`[${i}]:`, item);
                });
                console.groupEnd();
            }

            if (formattedResult.counts.removes > 0) {
                console.log(`Removed Count: ${formattedResult.counts.removes}`);
            }

            console.groupEnd(); // End results group
        }

        logDuration(duration, speedInfo.color, speedInfo.text);

        console.groupEnd(); // End main group
    }
}