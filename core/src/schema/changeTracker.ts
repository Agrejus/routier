/**
 * Builds the proxy factory that change-tracks an entity.
 *
 * Generated schema code receives the result as a bound value — a parameter of the generated
 * factory — and never refers to this module by name. Name references do not survive a minifier,
 * which renames the declaration but cannot see inside generated source text (#40, #46). The
 * returned function holds no per-entity state, so one per compiled schema is shared by every
 * entity it tracks.
 */
export type TrackedShape = {
    readonly objects: ReadonlySet<string>;
    readonly arrays: ReadonlySet<string>;
    readonly arraysOfNested: ReadonlySet<string>;
};

const withoutIndexes = (path: string) => path.split(".").filter(segment => /^\d+$/.test(segment) === false).join(".");

export function createChangeTracker(shape: TrackedShape) {
    const DIRTY_ENTITY_MARKER: string = "isDirty";
    const CHANGES_ENTITY_KEY: string = "changes";
    const ORIGINAL_ENTITY_KEY: string = "original";
    const PAUSED_ENTITY_KEY: string = "isPaused";
    const TRACKING_KEY: string = "__tracking__";
    const PROXY_MARKER: string = "__isProxy__";
    const proxies = new WeakMap<object, object>();

    const isTrackable = (value: unknown): value is Record<string, unknown> => {
        if (typeof value !== "object" || value === null) {
            return false;
        }

        const prototype = Object.getPrototypeOf(value);

        return Array.isArray(value) || prototype === null || Object.getPrototypeOf(prototype) === null;
    };

    const isPaused = (root: { [key: string]: any }) => root[TRACKING_KEY] != null && root[TRACKING_KEY][PAUSED_ENTITY_KEY] === true;

    const trackingOf = (root: { [key: string]: any }) => {
        if (root[TRACKING_KEY] == null) {
            Object.defineProperty(root, TRACKING_KEY, {
                value: Object.defineProperty({
                    [CHANGES_ENTITY_KEY]: {},
                    [DIRTY_ENTITY_MARKER]: false,
                    [ORIGINAL_ENTITY_KEY]: {},
                    [PAUSED_ENTITY_KEY]: false
                }, "raw", { value: root, enumerable: false }),
                configurable: true,
                writable: true,
                enumerable: false
            });
        }

        return root[TRACKING_KEY];
    };

    const record = (root: { [key: string]: any }, resolvedPath: string, originalValue: unknown, value: unknown) => {
        const tracking = trackingOf(root);

        if (Object.hasOwn(tracking[CHANGES_ENTITY_KEY], resolvedPath) === false) {
            tracking[CHANGES_ENTITY_KEY][resolvedPath] = value;
            tracking[ORIGINAL_ENTITY_KEY][resolvedPath] = originalValue;
            tracking[DIRTY_ENTITY_MARKER] = true;
            return;
        }

        if (tracking[ORIGINAL_ENTITY_KEY][resolvedPath] === value) {
            delete tracking[ORIGINAL_ENTITY_KEY][resolvedPath];
            delete tracking[CHANGES_ENTITY_KEY][resolvedPath];
            tracking[DIRTY_ENTITY_MARKER] = Object.keys(tracking[ORIGINAL_ENTITY_KEY]).length > 0;
            return;
        }

        tracking[CHANGES_ENTITY_KEY][resolvedPath] = value;
    };

    const createHandler = <TEntity extends {}>(path?: string, parent?: TEntity): ProxyHandler<TEntity> => {
        const pathOf = (key: string) => (path == null ? key : `${path}.${key}`);

        const holdsSchemaData = (target: object, key: string) => {
            const declared = withoutIndexes(pathOf(key));

            if (Array.isArray(target)) {
                return shape.arraysOfNested.has(declared);
            }

            return shape.objects.has(declared) || shape.arrays.has(declared) || [...shape.arraysOfNested].some(array => declared.startsWith(`${array}.`));
        };

        return {
            set(target, property, value) {
                const indexable: { [key: string]: any } = target;
                const originalValue = indexable[property as string];

                if (originalValue === value) {
                    return true;
                }

                const root: { [key: string]: any } = parent ?? target;
                const key = String(property);

                trackingOf(root);

                if (key === TRACKING_KEY) {
                    return true;
                }

                if (isPaused(root) === false) {
                    record(root, pathOf(key), originalValue, value);
                }

                return Reflect.set(target, property, value);
            },
            deleteProperty(target, property) {
                const root: { [key: string]: any } = parent ?? target;

                if (typeof property === "string" && Object.hasOwn(target, property) && isPaused(root) === false) {
                    record(root, pathOf(property), (target as { [key: string]: unknown })[property], undefined);
                }

                return Reflect.deleteProperty(target, property);
            },
            get(target, property) {
                if (property === PROXY_MARKER) {
                    return true;
                }

                const value = target[property as keyof TEntity];

                if (typeof property !== "string" || isTrackable(value) === false || value[PROXY_MARKER] === true || holdsSchemaData(target, property) === false) {
                    return value;
                }

                const known = proxies.get(value);

                if (known != null) {
                    return known;
                }

                const root: { [key: string]: any } = parent ?? target;
                const tracked = track(value, pathOf(property), root);
                proxies.set(value, tracked);

                return tracked;
            }
        };
    };

    const rootHandler = createHandler();

    const track = <TEntity extends {}>(entity: TEntity, path?: string, parent?: TEntity): TEntity => {
        const handler = parent == null
            ? rootHandler as ProxyHandler<TEntity>
            : createHandler(path, parent);

        return new Proxy(entity, handler);
    };

    return track;
}
