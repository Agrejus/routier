export type Expect = {
    (actual: any): {
        toBe(expected: any): void;
        toEqual(expected: any): void;
        toStrictEqual(expected: any): void;
        toBeDefined(): void;
        toBeNull(): void;
        toBeTruthy(): void;
        toBeFalsy(): void;
        toContain(expected: any): void;
        toHaveLength(expected: number): void;
        toThrow(expected?: string | RegExp): void;
        toBeGreaterThan(expected: number): void;
        toBeLessThan(expected: number): void;
        toBeLessThanOrEqual(expected: number): void;
        toBeGreaterThanOrEqual(expected: number): void;
        toBeTypeOf(type: string): void;
        toHaveProperty(property: string): void;
        toBeUndefined(): void;
        toHaveBeenCalledTimes(times: number): void;
        rejects: {
            toThrow(expected?: string | RegExp): void;
        };
        not: {
            toBe(expected: any): void;
            toEqual(expected: any): void;
            toStrictEqual(expected: any): void;
            toBeDefined(): void;
            toBeNull(): void;
            toBeTruthy(): void;
            toBeFalsy(): void;
            toContain(expected: any): void;
            toHaveLength(expected: number): void;
            toThrow(expected?: string | RegExp): void;
            toBeGreaterThan(expected: number): void;
            toBeLessThan(expected: number): void;
            toBeLessThanOrEqual(expected: number): void;
            toBeGreaterThanOrEqual(expected: number): void;
            toBeTypeOf(type: string): void;
            toHaveProperty(property: string): void;
            toBeUndefined(): void;
            toHaveBeenCalledTimes(times: number): void;
        };
    };
    any: (type: any) => any
};

export type MockFunction = {
    (...args: any[]): any;
    toHaveBeenCalledTimes(times: number): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: any[]): void;
    mock: {
        calls: any[][];
    };
};

export type Fn = () => any;

export type TestingOptions = { expect: Expect, fn: Fn, describe: (suite: string, test: () => void) => void, it: (name: string, test: () => Promise<void>) => void, debug?: DebugTestInfo };
export type DebugTestInfo = { suite?: string, name?: string }