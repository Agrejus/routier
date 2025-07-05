import { describe, it, expect, vi } from 'vitest';
import { DataBridge } from './DataBridge';

describe('DataBridge', () => {
    it('delegates bulkOperations to the strategy with correct arguments', () => {
        const strategy = { bulkOperations: vi.fn() };
        const options = { signal: undefined };
        // @ts-expect-error private constructor
        const bridge = new DataBridge(strategy as any, options as any);
        const event = { operation: {} };
        const done = vi.fn();
        bridge.bulkOperations(event as any, done);
        expect(strategy.bulkOperations).toHaveBeenCalledWith(options, event, done);
    });

    it('delegates query to the strategy with correct arguments', () => {
        const strategy = { query: vi.fn() };
        const options = { signal: undefined };
        // @ts-expect-error private constructor
        const bridge = new DataBridge(strategy as any, options as any);
        const event = { operation: {} };
        const done = vi.fn();
        bridge.query(event as any, done);
        expect(strategy.query).toHaveBeenCalledWith(options, event, done);
    });

    it('sets up subscription and triggers callback on message', () => {
        const strategy = { query: vi.fn() };
        const options = { signal: undefined };
        const onMessage = vi.fn();
        const dispose = vi.fn();
        const subscription = { onMessage, [Symbol.dispose]: dispose };
        const schema = { createSubscription: vi.fn(() => subscription) };
        const event = { operation: { options: new Map([['filter', []]]) }, schema };
        // @ts-expect-error private constructor
        const bridge = new DataBridge(strategy as any, options as any);
        const done = vi.fn();
        bridge.subscribe(event as any, done);
        expect(schema.createSubscription).toHaveBeenCalledWith(options.signal);
        expect(typeof subscription.onMessage).toBe('function');
    });
}); 