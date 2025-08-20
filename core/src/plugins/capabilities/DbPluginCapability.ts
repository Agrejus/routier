import { ResolvedChanges } from "../../collections";
import { PartialResultType, ResultType } from "../../results";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "../types";

export type DbPluginCapabilityEvent = "queryStart" | "queryComplete" | "destroyStart" | "destroyComplete" | "bulkPersistStart" | "bulkPersistComplete";

export interface IDbPluginCapability {
    apply<T extends IDbPlugin>(plugin: T): void;
}

/**
 * Extends plugin functionality through hooks and event handlers without
 * changing the plugin's type. Essential for maintaining type safety
 * in routier's core systems.
 */
export class DbPluginCapability {

    private events: Record<string, { before?: Function, after?: Function }> = {};

    add<TRoot extends {}, TShape extends any = TRoot>(name: "queryStart", callback: (event: DbPluginQueryEvent<TRoot, TShape>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: "queryComplete", callback: (event: ResultType<TShape>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: "destroyStart", callback: (event: DbPluginEvent<TRoot>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: "destroyComplete", callback: (event: ResultType<never>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: "bulkPersistStart", callback: (event: DbPluginBulkPersistEvent<TRoot>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: "bulkPersistComplete", callback: (event: PartialResultType<ResolvedChanges<TRoot>>) => void): DbPluginCapability;
    add<TRoot extends {}, TShape extends any = TRoot>(name: DbPluginCapabilityEvent, callback: Function): DbPluginCapability {

        this.resolve(name);

        switch (name) {
            case "queryStart":
                this.events["query"].before = callback;
                break;
            case "queryComplete":
                this.events["query"].after = callback;
                break;
            case "destroyStart":
                this.events["destroy"].before = callback;
                break;
            case "destroyComplete":
                this.events["destroy"].after = callback;
                break;
            case "bulkPersistStart":
                this.events["bulkPersist"].before = callback;
                break;
            case "bulkPersistComplete":
                this.events["bulkPersist"].after = callback;
                break;
        }

        return this;
    }

    private resolve(name: DbPluginCapabilityEvent) {

        switch (name) {
            case "queryStart":
            case "queryComplete":
                if (!this.events["query"]) {
                    this.events["query"] = {};
                }
                return;
            case "destroyStart":
            case "destroyComplete":
                if (!this.events["destroy"]) {
                    this.events["destroy"] = {};
                }
                return;
            case "bulkPersistStart":
            case "bulkPersistComplete":
                if (!this.events["bulkPersist"]) {
                    this.events["bulkPersist"] = {};
                }
                return;

            default:
                throw new Error("Exhaustive check")
        }
    }

    apply<T extends IDbPlugin>(plugin: T) {

        const methodWrappers: { method: keyof IDbPlugin, events: { before?: Function, after?: Function } }[] = [
            { method: 'query', events: this.events.query },
            { method: 'destroy', events: this.events.destroy },
            { method: 'bulkPersist', events: this.events.bulkPersist }
        ];

        // apply the mixins
        for (let i = 0, length = methodWrappers.length; i < length; i++) {

            const { events, method } = methodWrappers[i];

            if (events?.before || events?.after) {
                const original = plugin[method].bind(plugin);
                plugin[method] = ((event: unknown, done: Function) => {
                    events.before?.(event, done);

                    if (events.after) {
                        return original(event, (result: unknown) => {
                            events.after(result);
                            done(result);
                        });
                    }

                    return original(event, done);
                });
            }
        }
    }
}