import { InferCreateType, InferType } from "../schema";

export class TagCollection {

    private data: WeakMap<Object, unknown> = new WeakMap<Object, unknown>();
    private _size: number = 0;

    get size() {
        return this._size;
    }

    get(key: Object) {
        return this.data.get(key);
    }

    has(key: Object) {
        return this.data.has(key);
    }

    set(key: Object, tag: unknown) {
        this._size++;
        return this.data.set(key, tag);
    }

    delete(key: Object) {
        const result = this.data.delete(key);

        if (result) {
            this._size--;
        }

        return result;
    }

    setMany(keys: Object[], tag: unknown) {
        this._size += keys.length;
        for (let i = 0, length = keys.length; i < length; i++) {
            const key = keys[i];
            this.set(key, tag);
        }
    }
}