export class TagCollection implements Disposable {

    private data: Map<object, unknown> = new Map<object, unknown>();
    private _size: number = 0;

    get size() {
        return this._size;
    }

    get(key: object) {
        return this.data.get(key);
    }

    has(key: object) {
        return this.data.has(key);
    }

    set(key: object, tag: unknown) {
        this._size++;
        return this.data.set(key, tag);
    }

    delete(key: object) {
        const result = this.data.delete(key);

        if (result) {
            this._size--;
        }

        return result;
    }

    setMany(keys: object[], tag: unknown) {
        this._size += keys.length;
        for (let i = 0, length = keys.length; i < length; i++) {
            const key = keys[i];
            this.set(key, tag);
        }
    }

    combine(tags: TagCollection) {
        for (const [key, value] of tags) {
            this.data.set(key, value);
        }
    }

    values() {
        return this.data.values();
    }

    keys() {
        return this.data.keys();
    }

    [Symbol.dispose]() {
        this.data.clear();
    }

    [Symbol.iterator]() {
        return this.data[Symbol.iterator]();
    }
}