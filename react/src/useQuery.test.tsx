import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Result } from '@routier/core/results';
import { useQuery } from './useQuery';

/**
 * Coverage for the React binding, which previously had none.
 *
 * `useQuery` adapts routier's callback-style queries to React state. Its contract is a
 * discriminated union — pending, success, error — plus a subscription lifecycle: the query
 * runs on mount, re-runs when deps change, and any unsubscribe function it returns must be
 * called on cleanup. A missed unsubscribe leaks a live query per unmount, which is the kind
 * of defect that only shows up as a slow memory climb in a long-lived app.
 *
 * The query function is a plain callback here rather than a real datastore: the hook's job
 * is state management, and driving the callback directly is what makes the intermediate
 * states observable.
 */

const success = <T,>(data: T) => ({ ok: Result.SUCCESS, data }) as any;
const failure = (message: string) => ({ ok: 'error', error: new Error(message) }) as any;

describe('useQuery initial state', () => {
    it('starts pending before the query calls back', () => {
        const { result } = renderHook(() => useQuery<string[]>(() => { /* never calls back */ }));

        expect(result.current.status).toBe('pending');
        expect(result.current.loading).toBe(true);
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
    });

    it('runs the query once on mount', () => {
        const query = jest.fn();

        renderHook(() => useQuery<string[]>(query as any));

        expect(query).toHaveBeenCalledTimes(1);
    });
});

describe('useQuery success', () => {
    it('exposes the data once the query succeeds', async () => {
        const { result } = renderHook(() => useQuery<string[]>(cb => { cb(success(['a', 'b'])); }));

        await waitFor(() => expect(result.current.status).toBe('success'));
        expect((result.current as any).data).toEqual(['a', 'b']);
    });

    it('reports loading false and isSuccess true on success', async () => {
        const { result } = renderHook(() => useQuery<string[]>(cb => { cb(success([])); }));

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(result.current.isError).toBe(false);
    });

    it('surfaces an empty result as success rather than pending', async () => {
        // An empty list is a legitimate answer, not an absence of one.
        const { result } = renderHook(() => useQuery<string[]>(cb => { cb(success([])); }));

        await waitFor(() => expect(result.current.status).toBe('success'));
        expect((result.current as any).data).toEqual([]);
    });

    it('updates when the query calls back again', async () => {
        // Live queries call back repeatedly as data changes; the hook must keep up rather
        // than latch the first result.
        let emit: (r: any) => void = () => undefined;
        const { result } = renderHook(() => useQuery<string[]>(cb => { emit = cb; }));

        act(() => emit(success(['first'])));
        await waitFor(() => expect((result.current as any).data).toEqual(['first']));

        act(() => emit(success(['second'])));
        await waitFor(() => expect((result.current as any).data).toEqual(['second']));
    });
});

describe('useQuery error', () => {
    it('exposes an Error once the query fails', async () => {
        const { result } = renderHook(() => useQuery<string[]>(cb => { cb(failure('boom')); }));

        await waitFor(() => expect(result.current.status).toBe('error'));
        expect((result.current as any).error).toBeInstanceOf(Error);
        expect((result.current as any).error.message).toBe('boom');
    });

    it('reports loading false and isError true on failure', async () => {
        const { result } = renderHook(() => useQuery<string[]>(cb => { cb(failure('boom')); }));

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(result.current.isSuccess).toBe(false);
    });

    it('substitutes a message when the failure carries none', async () => {
        // Consumers render `error.message`; an undefined message would render as blank.
        const { result } = renderHook(() =>
            useQuery<string[]>(cb => { cb({ ok: 'error', error: undefined } as any); }));

        await waitFor(() => expect(result.current.status).toBe('error'));
        expect((result.current as any).error.message).toBe('Unknown error');
    });

    it('recovers to success if a later callback succeeds', async () => {
        let emit: (r: any) => void = () => undefined;
        const { result } = renderHook(() => useQuery<string[]>(cb => { emit = cb; }));

        act(() => emit(failure('transient')));
        await waitFor(() => expect(result.current.isError).toBe(true));

        act(() => emit(success(['recovered'])));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.isError).toBe(false);
    });
});

describe('useQuery subscription lifecycle', () => {
    it('calls the returned unsubscribe on unmount', () => {
        const unsubscribe = jest.fn();
        const { unmount } = renderHook(() => useQuery<string[]>(() => unsubscribe as any));

        unmount();

        // Skipping this leaks one live query per unmounted component.
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('unmounts cleanly when the query returns nothing', () => {
        const { unmount } = renderHook(() => useQuery<string[]>(() => { /* no unsubscribe */ }));

        expect(() => unmount()).not.toThrow();
    });

    it('unmounts cleanly when the query returns a non-function', () => {
        // The hook guards on typeof; a truthy non-function must not be called.
        const { unmount } = renderHook(() => useQuery<string[]>(() => ({} as any)));

        expect(() => unmount()).not.toThrow();
    });

    it('does not re-run when deps are unchanged', () => {
        const query = jest.fn();
        const { rerender } = renderHook(() => useQuery<string[]>(query as any, ['stable']));

        rerender();

        expect(query).toHaveBeenCalledTimes(1);
    });

    it('re-runs when a dep changes', () => {
        const query = jest.fn();
        let dep = 'a';
        const { rerender } = renderHook(() => useQuery<string[]>(query as any, [dep]));

        dep = 'b';
        rerender();

        expect(query).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes the previous query before re-running', () => {
        const unsubscribe = jest.fn();
        let dep = 'a';
        const { rerender } = renderHook(() =>
            useQuery<string[]>(() => unsubscribe as any, [dep]));

        dep = 'b';
        rerender();

        // Otherwise a dep change accumulates subscriptions instead of replacing them.
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('returns to pending while a dep-triggered re-run is in flight', async () => {
        let emit: (r: any) => void = () => undefined;
        let dep = 'a';
        const { result, rerender } = renderHook(() =>
            useQuery<string[]>(cb => { emit = cb; }, [dep]));

        act(() => emit(success(['first'])));
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        dep = 'b';
        rerender();

        // Showing the previous query's data while a new one loads would display results that
        // do not match the current inputs.
        expect(result.current.status).toBe('pending');
        expect(result.current.loading).toBe(true);
    });
});
