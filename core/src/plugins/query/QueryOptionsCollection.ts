import { PropertyExpression } from "../../expressions";
import { forEach, isPropertyExpression } from "../../expressions/utils";
import { QueryOption, QueryOptionName, QueryOptionExecutionTarget, QueryOptionValueMap } from "./types";

export type QueryCollectionItem<T, K extends QueryOptionName> = { index: number, option: QueryOption<T, K> };

export class QueryOptionsCollection<T> {

    private options: Map<QueryOptionName, QueryCollectionItem<any, any>[]> = new Map<QueryOptionName, QueryCollectionItem<any, any>[]>();
    private nextExecutionTarget: QueryOptionExecutionTarget = "database";
    private nextIndex: number = 0;
    private enumeratedItems: QueryCollectionItem<any, any>[] = [];

    get items() {
        return this.options;
    }

    get isEmpty() {
        return this.items.size === 0;
    }

    static EMPTY<R>() {
        return new QueryOptionsCollection<R>();
    }

    static isEmpty<T>(options: QueryOptionsCollection<T>) {
        return options.isEmpty;
    }

    add<K extends QueryOptionName>(name: K, value: QueryOption<T, K>["value"]) {

        if (name === "map") {
            const mapValue = value as QueryOptionValueMap<T>["map"];

            // Evaluate the map value to see if we are renaming properties, 
            // if we are we need to perform everything after in memory
            if (mapValue.fields.some(x => x.isRename === true) || mapValue.fields.some(x => x.property?.isUnmapped === true)) {
                // Cut over to memory execution since we are renaming a property with .map
                // We do not want to figure out how the new name flows through the entire query
                this.nextExecutionTarget = "memory";
            }
        }

        if (name === "filter") {
            // Need to check for unmapped properties
            const filterValue = value as QueryOptionValueMap<T>["filter"];

            forEach(filterValue.expression, (expression) => {

                if (isPropertyExpression(expression) && expression.property.isUnmapped) {
                    // Cut over to memory execution, unmapped properties are not in the database and
                    // cannot be queried
                    this.nextExecutionTarget = "memory";
                    return false;
                }

                return true;
            });
        }

        const item: QueryCollectionItem<T, K> = {
            index: this.nextIndex,
            option: {
                name,
                target: this.nextExecutionTarget,
                value
            }
        }

        this.nextIndex++;

        const found = this.options.get(name);

        this.options.set(name, [...found ?? [], item]);
    }

    split(): { memory: QueryOptionsCollection<T>, database: QueryOptionsCollection<T> } {
        this.resolveEnumeration();

        const sortedItems = this.enumeratedItems.toSorted((a, b) => a.index - b.index);
        const memoryQueryOptionsCollection = new QueryOptionsCollection<T>();
        const databaseQueryOptionsCollection = new QueryOptionsCollection<T>();

        for (let i = 0, length = sortedItems.length; i < length; i++) {
            const sortedItem = sortedItems[i];

            if (sortedItem.option.target === "database") {
                databaseQueryOptionsCollection.add(sortedItem.option.name, sortedItem.option.value);
                continue;
            }

            memoryQueryOptionsCollection.add(sortedItem.option.name, sortedItem.option.value);
        }

        return {
            memory: memoryQueryOptionsCollection,
            database: databaseQueryOptionsCollection
        }
    }

    has<K extends QueryOptionName>(name: K): boolean {
        return this.options.has(name);
    }

    get<K extends QueryOptionName>(name: K): QueryCollectionItem<T, K>[] {
        return this.options.get(name) ?? [] as QueryCollectionItem<T, K>[];
    }

    getLast<K extends QueryOptionName>(name: K): QueryOption<T, K> | null {
        this.resolveEnumeration();

        for (let i = this.enumeratedItems.length - 1; i >= 0; i--) {
            const item = this.enumeratedItems[i];

            if (item.option.name === name) {
                return item.option;
            }
        }

        return null
    }

    getValues<K extends QueryOptionName>(name: K): QueryCollectionItem<T, K>["option"]["value"][] | undefined {

        const found = this.options.get(name);

        if (found == null) {
            return [];
        }

        return found.map(w => w.option.value) as QueryCollectionItem<T, K>["option"]["value"][];
    }

    private getEnumeration() {
        return [...this.options.values()].flat().toSorted((a, b) => a.index - b.index);
    }

    private resolveEnumeration() {
        if (this.enumeratedItems.length != this.nextIndex) {
            this.enumeratedItems = this.getEnumeration();
        }
    }

    forEach(iterator: (item: QueryCollectionItem<T, any>["option"]) => void) {
        this.resolveEnumeration();

        for (let i = 0, length = this.enumeratedItems.length; i < length; i++) {
            iterator(this.enumeratedItems[i].option);
        }
    }
}