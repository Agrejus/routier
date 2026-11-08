import { MemoryPlugin } from './MemoryPlugin';

export type { MemoryDatabase } from './databases';

export const assertIsMemoryPlugin = (value: unknown): asserts value is MemoryPlugin => {
    if (value instanceof MemoryPlugin) {
        return;
    }

    throw new TypeError(`Value is not instance of type MemoryPlugin`);
}

export { MemoryPlugin } 