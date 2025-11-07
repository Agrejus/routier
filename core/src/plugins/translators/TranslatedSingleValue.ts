import { ITranslatedValue } from './types';

export class TranslatedSingleValue<T> implements ITranslatedValue<T> {

    value: T;

    constructor(value: unknown) {
        this.value = value as T;
    }

    forEach(callback: (item: unknown) => unknown): void {
        const result = callback(this.value) as T;

        if (result) {
            this.value = result;
        }
    }
}