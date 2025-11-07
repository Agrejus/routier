export interface ITranslatedValue<T> {
    readonly value: T;
    /**
     * Iterates over items in the collection, calling the callback for each item.
     * If the callback returns a value, that value will replace the original item in the collection.
     * 
     * @param callback Function called for each item. If it returns a value, that value replaces the original item.
     */
    forEach(callback: (item: unknown) => unknown): void
}