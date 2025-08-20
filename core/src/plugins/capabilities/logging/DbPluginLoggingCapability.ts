import { IDbPlugin, DbPluginQueryEvent, DbPluginBulkPersistEvent, DbPluginEvent } from "../../../plugins/types";
import { DbPluginCapability, IDbPluginCapability } from "../DbPluginCapability";
import { ResultType, PartialResultType } from "../../../results";
import { ResolvedChanges } from "../../../collections";
import { now } from "../../../performance";

export class DbPluginLoggingCapability implements IDbPluginCapability {
    private logStyle: 'minimal' | 'detailed' | 'redux' = 'redux';
    private maxLogEntries: number = 100;
    private logHistory: Array<{ type: string; timestamp: number; data: any }> = [];

    constructor(options?: { logStyle?: 'minimal' | 'detailed' | 'redux'; maxLogEntries?: number }) {
        this.logStyle = options?.logStyle ?? 'redux';
        this.maxLogEntries = options?.maxLogEntries ?? 100;
    }

    apply<T extends IDbPlugin>(plugin: T) {
        const baseCapability = new DbPluginCapability();

        const pluginName = plugin.constructor.name;

        // Query logging
        baseCapability
            .add("queryStart", (event: DbPluginQueryEvent<any, any>) => {
                this.logReduxAction('QUERY_REQUEST', {
                    plugin: pluginName,
                    collection: event.operation.schema.collectionName,
                    schemaId: event.operation.schema.id,
                    changeTracking: event.operation.changeTracking
                }, {
                    timestamp: new Date().toISOString(),
                    options: this.extractQueryOptions(event.operation)
                });
                this.addToHistory('QUERY_REQUEST', event);
            })
            .add("queryComplete", (result: ResultType<any>) => {
                const duration = this.getOperationDuration();
                const performance = this.getPerformanceIndicator(duration);

                if (result.ok === 'success') {
                    this.logReduxAction('QUERY_SUCCESS', {
                        plugin: pluginName,
                        resultCount: this.getResultCount(result.data),
                        resultType: this.getResultType(result.data)
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    this.logReduxAction('QUERY_ERROR', {
                        plugin: pluginName,
                        error: result.error?.message || result.error,
                        isCritical: false
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                }
                this.addToHistory('QUERY_RESULT', { result, duration });
            });

        // Bulk operations logging
        baseCapability
            .add("bulkPersistStart", (event: DbPluginBulkPersistEvent<any>) => {
                const totalOperations = event.operation.changes.all().data.length;
                this.logReduxAction('BULK_OPERATIONS_REQUEST', {
                    plugin: pluginName,
                    totalOperations,
                    schemaCount: event.schemas.size,
                    operations: this.extractBulkOperations(event.operation)
                }, {
                    timestamp: new Date().toISOString()
                });
                this.addToHistory('BULK_OPERATIONS_REQUEST', event);
            })
            .add("bulkPersistComplete", (result: PartialResultType<ResolvedChanges<any>>) => {
                const duration = this.getOperationDuration();
                const performance = this.getPerformanceIndicator(duration);

                if (result.ok === 'success') {
                    this.logReduxAction('BULK_OPERATIONS_SUCCESS', {
                        plugin: pluginName,
                        completedOperations: this.countCompletedOperations(result.data),
                        schemaCount: result.data?.result.all().data.length || 0
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    this.logReduxAction('BULK_OPERATIONS_ERROR', {
                        plugin: pluginName,
                        error: result.error?.message || result.error,
                        isCritical: false
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                }
                this.addToHistory('BULK_OPERATIONS_RESULT', { result, duration });
            });

        // Destroy logging
        baseCapability
            .add("destroyStart", (event: DbPluginEvent<any>) => {
                this.logReduxAction('DESTROY_REQUEST', {
                    plugin: pluginName,
                    schemaCount: event.schemas.size
                }, {
                    timestamp: new Date().toISOString()
                });
                this.addToHistory('DESTROY_REQUEST', event);
            })
            .add("destroyComplete", (result: ResultType<never>) => {
                const duration = this.getOperationDuration();
                const performance = this.getPerformanceIndicator(duration);

                if (result.ok === 'success') {
                    this.logReduxAction('DESTROY_SUCCESS', {
                        plugin: pluginName
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    this.logReduxAction('DESTROY_ERROR', {
                        plugin: pluginName,
                        error: result.error?.message || result.error
                    }, {
                        duration: `${duration.toFixed(4)}ms`,
                        performance: performance.label,
                        timestamp: new Date().toISOString()
                    });
                }
                this.addToHistory('DESTROY_RESULT', { result, duration });
            });

        baseCapability.apply(plugin);
    }

    private startTime: number = 0;

    private getOperationDuration(): number {
        if (this.startTime === 0) {
            this.startTime = now();
            return 0;
        }
        const duration = now() - this.startTime;
        this.startTime = 0;
        return duration;
    }

    private getPerformanceIndicator(duration: number) {
        if (duration > 1000) return { emoji: '🐌', color: '#ef4444', label: 'SLOW', level: 'error' };
        if (duration > 500) return { emoji: '🐢', color: '#f97316', label: 'MEDIUM', level: 'warning' };
        if (duration > 100) return { emoji: '⚡', color: '#eab308', label: 'FAST', level: 'info' };
        return { emoji: '🚀', color: '#22c55e', label: 'INSTANT', level: 'success' };
    }

    private logReduxAction(action: string, payload: any, meta?: any) {
        if (this.logStyle !== 'redux') return;

        const timestamp = new Date().toISOString();
        const actionId = this.generateId();

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
    }

    private extractQueryOptions(query: any) {
        const options: Record<string, any> = {};
        if (query.options) {
            ['skip', 'take', 'sort', 'filter', 'map', 'distinct'].forEach(type => {
                try {
                    const values = query.options.getValues(type);
                    if (values.length > 0) options[type] = values;
                } catch (e) {
                    // Skip if option type not supported
                }
            });
        }
        return options;
    }

    private getResultCount(result: any): string {
        if (Array.isArray(result)) return `${result.length} items`;
        if (result !== null && typeof result === 'object') return '1 object';
        return '1 primitive';
    }

    private getResultType(result: any): string {
        if (Array.isArray(result)) return 'array';
        if (result !== null && typeof result === 'object') return 'object';
        return typeof result;
    }

    private extractBulkOperations(operations: any) {
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

    private countCompletedOperations(result: ResolvedChanges<any> | undefined): number {
        return result?.result.all().data.length || 0;
    }

    private addToHistory(type: string, data: any) {
        this.logHistory.push({
            type,
            timestamp: Date.now(),
            data
        });

        if (this.logHistory.length > this.maxLogEntries) {
            this.logHistory = this.logHistory.slice(-this.maxLogEntries);
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    // Public methods for debugging
    getLogHistory() {
        return [...this.logHistory];
    }

    clearLogHistory() {
        this.logHistory = [];
    }
}