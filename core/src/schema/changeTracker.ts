/**
 * Builds the proxy factory that change-tracks an entity.
 *
 * Generated schema code receives the result as a bound value — a parameter of the generated
 * factory — and never refers to this module by name. Name references do not survive a minifier,
 * which renames the declaration but cannot see inside generated source text (#40, #46). The
 * returned function holds no per-entity state, so one per compiled schema is shared by every
 * entity it tracks.
 */
export function createChangeTracker() {
    const DIRTY_ENTITY_MARKER: string = "isDirty";
    const CHANGES_ENTITY_KEY: string = "changes";
    const ORIGINAL_ENTITY_KEY: string = "original";
    const PAUSED_ENTITY_KEY: string = "isPaused";
    const TRACKING_KEY: string = "__tracking__";
    const PROXY_MARKER: string = "__isProxy__";

    return <TEntity extends {}>(entity: TEntity, path?: string, parent?: TEntity) => {

        const proxyHandler: ProxyHandler<TEntity> = {
            set(entity, property, value) {
                const indexableEntity: { [key: string]: any } = entity;

                // if values are the same, do nothing
                //
                // Checked before `String(property)` on purpose. A write that changes
                // nothing is the common case, not the exception: `schema.merge` copies
                // every property of a re-read row into the attached entity, and on an
                // unchanged row every one of those writes lands here and returns.
                // Building the string key first made that path cost 156ns a write, of
                // which 125ns was the `String()` call alone; checking first takes it to
                // 31ns, against a 14ns floor for the same writes on a plain object.
                // Indexing by `property` rather than by `key` reads the same slot for
                // string keys, and the correct one for symbols (which `String()` would
                // have mangled into a "Symbol(x)" lookup).
                const originalValue = indexableEntity[property as string];

                if (originalValue === value) {
                    return true;
                }

                const key = String(property);
                const resolvedParent: { [key: string]: any } = parent ?? entity;

                if (resolvedParent[TRACKING_KEY] == null) {
                    // defineProperty, not assignment: a plain assignment creates an ENUMERABLE
                    // property, and this is the lazy path that runs on the first tracked write —
                    // so every entity the caller had edited came back from a query with
                    // `__tracking__` visible to Object.entries, JSON.stringify and any deep
                    // compare (defect #26). Both bootstrap paths below already define it
                    // non-enumerable; this one was the outlier.
                    Object.defineProperty(resolvedParent, TRACKING_KEY, {
                        value: {
                            [CHANGES_ENTITY_KEY]: {},
                            [DIRTY_ENTITY_MARKER]: false,
                            [ORIGINAL_ENTITY_KEY]: {},
                            [PAUSED_ENTITY_KEY]: false
                        },
                        configurable: true,
                        writable: true,
                        enumerable: false
                    });
                }

                if (key == TRACKING_KEY) {
                    return true;
                }

                if (resolvedParent[TRACKING_KEY] != null && resolvedParent[TRACKING_KEY][PAUSED_ENTITY_KEY] === true) {
                    Reflect.set(indexableEntity, property, value);
                    return true;
                }

                const resolvedPath = path == null ? key : `${path}.${key}`;
                const changes = resolvedParent[TRACKING_KEY];

                if (changes[CHANGES_ENTITY_KEY][resolvedPath] != null) {

                    if (changes[ORIGINAL_ENTITY_KEY][resolvedPath] === value) {
                        // we are changing the value back to the original value, remove the change
                        //
                        // These two stay `delete`, unlike the `__tracking__` sites on the entity
                        // itself. Assigning undefined here would be read as "still changed" by
                        // the isDirty count below, which asks Object.keys — and a key assigned
                        // undefined is still a key. Counting only defined values does not rescue
                        // it either: an original value of undefined is legitimate (a property
                        // that was unset and then given a value), so a defined-value count would
                        // report a genuinely dirty entity as clean. Removing the key is the only
                        // representation that keeps "present" and "changed" the same question.
                        //
                        // The cost is bounded in a way the entity sites are not: these bags hold
                        // one key per changed path, they are internal to the tracking record, and
                        // this branch only runs when a value is set BACK to its original.
                        delete changes[ORIGINAL_ENTITY_KEY][resolvedPath];
                        delete changes[CHANGES_ENTITY_KEY][resolvedPath];
                    } else {
                        // track the change
                        changes[CHANGES_ENTITY_KEY][resolvedPath] = value;
                    }

                } else if (changes[CHANGES_ENTITY_KEY][resolvedPath] == null) {
                    // don't keep updating, keep the original value
                    changes[CHANGES_ENTITY_KEY][resolvedPath] = value;
                    changes[ORIGINAL_ENTITY_KEY][resolvedPath] = originalValue;
                }

                const isDirty = Object.keys(changes[ORIGINAL_ENTITY_KEY]).length > 0;
                changes[DIRTY_ENTITY_MARKER] = isDirty;

                Reflect.set(indexableEntity, property, value);

                return true;
            },
            get(target, property, receiver) {

                if (property === PROXY_MARKER) {
                    return true;
                }

                return Reflect.get(target, property, receiver);
            }
        }

        return new Proxy(entity, proxyHandler) as TEntity;
    }
}
