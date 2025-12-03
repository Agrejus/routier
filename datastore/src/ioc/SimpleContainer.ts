export class SimpleContainer<TContainer extends {}> {

    // Same dependency for life of container
    private singletonDependencies: Partial<TContainer> = {};

    // One per request, will be new when begin scope is called
    private scopedDependencies: Partial<TContainer> = {};
    private scopedFactories: {
        [K in keyof TContainer]?: () => TContainer[K]
    } = {};

    // New dependency every time
    private transientFactories: {
        [K in keyof TContainer]?: () => TContainer[K]
    } = {};

    constructor(singletonDependencies?: Partial<TContainer>) {
        this.singletonDependencies = singletonDependencies ?? {};
    }

    singleton<K extends keyof TContainer>(
        key: K,
        value: () => TContainer[K]
    ): this {
        // Call factory method right away since it's a singleton
        this.singletonDependencies[key] = value();
        return this;
    }

    scoped<K extends keyof TContainer>(
        key: K,
        factory: () => TContainer[K]
    ): this {
        Object.assign(this.scopedFactories, { [key]: factory });
        return this;
    }

    transient<K extends keyof TContainer>(
        key: K,
        factory: () => TContainer[K]
    ): this {
        Object.assign(this.transientFactories, { [key]: factory });
        return this;
    }

    beginScope() {
        this.scopedDependencies = {};
    }

    endScope() {
        this.scopedDependencies = {};
    }

    resolve<K extends keyof TContainer>(
        key: K
    ): TContainer[K] {

        if (this.singletonDependencies[key]) {
            return this.singletonDependencies[key];
        }

        if (this.scopedFactories[key]) {

            if (this.scopedDependencies[key]) {
                return this.scopedDependencies[key];
            }

            const scopedValue = this.scopedFactories[key]();

            this.scopedDependencies[key] = scopedValue;

            return scopedValue;
        }

        if (this.transientFactories[key]) {
            return this.transientFactories[key]();
        }

        throw new Error(`Value not registered for key.  Key: ${String(key)}`);
    }
}