import { ITranslatedValue } from './types';

export class TranslatedGroupValue<T> implements ITranslatedValue<T> {

    readonly value: T;

    constructor(value: unknown) {
        this.value = value as T;
    }

    forEach(callback: (item: unknown) => unknown): void {
        const group = this.value as Record<string, unknown[]>;
        const keys = Object.keys(group);
        for (let i = 0, length = keys.length; i < length; i++) {
            const key = keys[i];
            const data = group[key];

            for (let j = 0, len = data.length; j < len; j++) {

                const result = callback(data[j]);

                if (result) {
                    // reassign if the callback returns a result
                    data[j] = result;
                }
            }
        }
    }
}