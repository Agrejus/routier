import { QueryOption, QueryOptionName, QueryOptionTarget } from "./types";

export class QueryOptionsCollection {

    private options: Map<QueryOptionName, QueryOption<unknown>> = new Map<QueryOptionName, QueryOption<unknown>>();
    private lastTarget: QueryOptionTarget | null = null;

    get items() {
        return this.options;
    }

    static get EMPTY() {
        return new QueryOptionsCollection();
    }

    static isEmpty(options: QueryOptionsCollection) {
        return options.items.size === 0;
    }

    add<T>(name: QueryOptionName, value: QueryOption<T>["value"]) {

        // if (option.name === "map" && ) {

        //     // evaluate the .map function to see if we are renaming properties, 
        //     // if we are we need to perform everything after in memory

        // }

        this.options.set(name, {
            name,
            value,
            target: "database" // this will be dynamic
        });
    }

    get<T>(name: QueryOptionName): QueryOption<T> | undefined {
        return this.options.get(name) as QueryOption<T>;
    }

    getValue<T>(name: QueryOptionName): QueryOption<T>["value"] | undefined {
        return this.options.get(name)?.value as QueryOption<T>["value"] | undefined;
    }
}