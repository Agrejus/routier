import { describe, it, expect } from '@jest/globals';
import { hash, fastHash } from './strings';

describe('hash', () => {
    it('should produce the same hash for the same input', () => {
        const result1 = hash('test');
        const result2 = hash('test');
        expect(result1).toBe(result2);
    });

    it('should produce different hashes for different inputs', () => {
        const result1 = hash('test');
        const result2 = hash('test2');
        expect(result1).not.toBe(result2);
    });

    it('should respect seed value', () => {
        const result1 = hash('test', 0);
        const result2 = hash('test', 1);
        expect(result1).not.toBe(result2);
    });
});

describe('fastHash', () => {
    it('should produce the same hash for the same input', () => {
        const result1 = fastHash('test');
        const result2 = fastHash('test');
        expect(result1).toBe(result2);
    });

    it('should produce different hashes for different inputs', () => {
        const result1 = fastHash('test');
        const result2 = fastHash('test2');
        expect(result1).not.toBe(result2);
    });

    it('should respect seed value', () => {
        const result1 = fastHash('test', 5381);
        const result2 = fastHash('test', 0);
        expect(result1).not.toBe(result2);
    });

    it('should return a positive 32-bit integer', () => {
        const result = fastHash('test');
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
        expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle empty string', () => {
        const result = fastHash('');
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode characters', () => {
        const result1 = fastHash('test');
        const result2 = fastHash('test🚀');
        expect(result1).not.toBe(result2);
    });

    it('should be deterministic across multiple calls', () => {
        const results: number[] = [];
        for (let i = 0; i < 10; i++) {
            results.push(fastHash('test'));
        }
        results.forEach(result => {
            expect(result).toBe(results[0]);
        });
    });
});

