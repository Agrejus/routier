import { assertIsNotNull } from "@routier/core";
import { QueryableDependencies } from "./types";

export class QueryableContainer<TRoot extends {}> {
    private dependencies: Partial<QueryableDependencies<TRoot>> = {};

    register<K extends keyof QueryableDependencies<TRoot>>(
        key: K,
        value: QueryableDependencies<TRoot>[K]
    ): this {
        this.dependencies[key] = value;
        return this;
    }

    resolve<K extends keyof QueryableDependencies<TRoot>>(
        key: K
    ): QueryableDependencies<TRoot>[K] {
        const dependency = this.dependencies[key];

        assertIsNotNull(dependency, `Dependency '${String(key)}' not found in container`);

        return dependency as QueryableDependencies<TRoot>[K];
    }
}