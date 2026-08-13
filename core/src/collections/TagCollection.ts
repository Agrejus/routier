export class TagCollection implements Disposable {

    private data: Map<object, unknown> = new Map<object, unknown>();

    // Delegated to the map rather than tracked in a counter field: every mutation path
    // (set, setMany, combine, delete, dispose) would otherwise have to maintain it, and
    // a missed path silently reports a size that disagrees with the contents.
    get size() {
        return this.data.size;
    }

    get(key: object) {
        return this.data.get(key);
    }

    has(key: object) {
        return this.data.has(key);
    }

    set(key: object, tag: unknown) {
        return this.data.set(key, tag);
    }

    delete(key: object) {
        return this.data.delete(key);
    }

    setMany(keys: object[], tag: unknown) {
        for (let i = 0, length = keys.length; i < length; i++) {
            const key = keys[i];
            this.set(key, tag);
        }
    }

    combine(tags: TagCollection) {
        for (const [key, value] of tags) {
            this.set(key, value);
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