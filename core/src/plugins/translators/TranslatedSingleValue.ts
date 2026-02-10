import { ITranslatedValue } from './types';

export class TranslatedSingleValue<T> implements ITranslatedValue<T> {

    value: T;
    readonly isTransformed: boolean;
    readonly isEmpty: boolean;

    constructor(value: unknown, isTransformed: boolean) {
        this.value = value as T;
        this.isEmpty = value == null;
        this.isTransformed = isTransformed;
    }

    forEach(callback: (item: unknown) => unknown): void {
        const result = callback(this.value) as T;

        if (result) {
            this.value = result;
        }
    }
}