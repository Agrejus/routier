export interface ITranslatedValue<T> {
    readonly value: T;
    /**
     * Iterates over items in the collection, calling the callback for each item.
     * If the callback returns a value, that value replaces the original item (e.g. so
     * changeTracker.resolve() can swap in attached/merged entities).
     *
     * @param callback Function called for each item. If it returns a value, that value replaces the original item.
     */
    forEach(callback: (item: unknown) => unknown): void

    /**
     * True if the translator remapped or transformed the data from the database shape;
     * false if the data is unchanged and in the same shape as the database.
     */
    readonly isTransformed: boolean;

    readonly isEmpty: boolean;
}