import { ITranslatedValue } from './types';

export class TranslatedArrayValue<T> implements ITranslatedValue<T> {

    readonly value: T;
    readonly isTransformed: boolean;
    readonly isEmpty: boolean;

    constructor(value: unknown, isTransformed: boolean) {
        this.value = value as T;
        this.isEmpty = value == null || (Array.isArray(value) && value.length === 0);
        this.isTransformed = isTransformed;
    }

    forEach(callback: (item: unknown) => unknown): void {
        const data = this.value as unknown[];
        for (let i = 0, length = data.length; i < length; i++) {
            const result = callback(data[i]);

            if (result) {
                // reassign if the callback returns a result
                data[i] = result;
            }
        }
    }
}