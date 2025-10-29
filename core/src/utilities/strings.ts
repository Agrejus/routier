export const hash = (value: string, seed: number = 0) => {
    // From Stack Overflow
    // https://stackoverflow.com/a/52171480/3329760
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;

    for (let i = 0, ch: number; i < value.length; i++) {
        ch = value.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Fast string hash optimized for comparisons.
 * Uses djb2 algorithm - very fast and good distribution for short to medium strings.
 * Same input always produces same output (deterministic).
 * 
 * @param value - The string to hash
 * @param seed - Optional seed value (default: 5381)
 * @returns A positive 32-bit integer hash value
 * 
 * @example
 * ```ts
 * fastHash("test") === fastHash("test") // true
 * fastHash("test") !== fastHash("test2") // true
 * ```
 */
export const fastHash = (value: string, seed: number = 5381): number => {
    let hash = seed;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) + hash) + value.charCodeAt(i);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
}