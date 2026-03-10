import { describe, expect, it } from '@jest/globals';
import { isNodeRuntime } from './runtime';

describe("runtime utilities", () => {
    it("isNodeRuntime returns true in the Node test environment", () => {
        expect(isNodeRuntime()).toBe(true);
    });
});
