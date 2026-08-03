import { describe, expect, it } from "@jest/globals";
import { TrampolinePipeline } from "./TrampolinePipeline";

/**
 * A trampoline exists so a long chain of synchronous steps does not grow the call stack.
 * These tests cover that guarantee, the sync/async mixing that makes the trampoline
 * necessary, and error propagation.
 */
describe("TrampolinePipeline", () => {
    describe("composition", () => {
        it("passes the initial value through an empty pipeline", () => {
            const pipeline = new TrampolinePipeline<number>();
            let received: number | undefined;

            pipeline.filter<number>(41, data => { received = data; });

            expect(received).toBe(41);
        });

        it("runs a single synchronous processor", () => {
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => done(data + 1));
            let received: number | undefined;

            pipeline.filter<number>(1, data => { received = data; });

            expect(received).toBe(2);
        });

        it("chains synchronous processors in order", () => {
            const order: string[] = [];
            const pipeline = new TrampolinePipeline<string>()
                .pipe<string>((data, done) => { order.push("first"); done(`${data}-1`); })
                .pipe<string>((data, done) => { order.push("second"); done(`${data}-2`); })
                .pipe<string>((data, done) => { order.push("third"); done(`${data}-3`); });
            let received: string | undefined;

            pipeline.filter<string>("start", data => { received = data; });

            expect(order).toEqual(["first", "second", "third"]);
            expect(received).toBe("start-1-2-3");
        });

        it("runs asynchronous processors", async () => {
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => { setTimeout(() => done(data * 2), 0); });

            const received = await new Promise<number>(resolve => {
                pipeline.filter<number>(21, data => resolve(data));
            });

            expect(received).toBe(42);
        });

        it("mixes synchronous and asynchronous processors in one chain", async () => {
            const order: string[] = [];
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => { order.push("sync-1"); done(data + 1); })
                .pipe<number>((data, done) => { order.push("async"); setTimeout(() => done(data + 1), 0); })
                .pipe<number>((data, done) => { order.push("sync-2"); done(data + 1); });

            const received = await new Promise<number>(resolve => {
                pipeline.filter<number>(0, data => resolve(data));
            });

            // Resuming after an async hop is where a trampoline can lose steps or run them
            // twice, so both the order and the accumulated value matter.
            expect(order).toEqual(["sync-1", "async", "sync-2"]);
            expect(received).toBe(3);
        });

        it("runs each processor exactly once", async () => {
            const counts = [0, 0, 0];
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => { counts[0]++; done(data); })
                .pipe<number>((data, done) => { counts[1]++; setTimeout(() => done(data), 0); })
                .pipe<number>((data, done) => { counts[2]++; done(data); });

            await new Promise<void>(resolve => {
                pipeline.filter<number>(0, () => resolve());
            });

            expect(counts).toEqual([1, 1, 1]);
        });

        it("calls done exactly once for a successful run", async () => {
            let doneCount = 0;
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => done(data))
                .pipe<number>((data, done) => { setTimeout(() => done(data), 0); });

            await new Promise<void>(resolve => {
                pipeline.filter<number>(0, () => { doneCount++; resolve(); });
            });
            // Give any stray continuation a chance to fire before asserting.
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(doneCount).toBe(1);
        });
    });

    describe("stack safety", () => {
        it("runs 100k synchronous steps without overflowing the stack", () => {
            const pipeline = new TrampolinePipeline<number>();

            for (let i = 0; i < 100_000; i++) {
                pipeline.pipe<number>((data, done) => done((data as number) + 1));
            }

            let received: number | undefined;
            // Recursing per step would exhaust the stack long before 100k. This is the
            // property the trampoline exists to provide.
            pipeline.filter<number>(0, data => { received = data; });

            expect(received).toBe(100_000);
        });

        it("keeps the stack flat rather than growing it per step", () => {
            const depths: number[] = [];
            const measureDepth = () => (new Error().stack ?? "").split("\n").length;
            const pipeline = new TrampolinePipeline<number>();

            for (let i = 0; i < 500; i++) {
                pipeline.pipe<number>((data, done) => { depths.push(measureDepth()); done(data); });
            }

            pipeline.filter<number>(0, () => { /* no assertion on the result here */ });

            // Depth must not grow with step count. Compared loosely because the harness
            // contributes frames of its own; the point is that step 500 is not ~500 frames
            // deeper than step 1.
            expect(Math.abs(depths[depths.length - 1] - depths[0])).toBeLessThan
                (50);
        });
    });

    describe("error propagation", () => {

        // FIXED (was docs/known-issues.md #3): the trampoline used to swallow the error and
        // break without calling `done`, leaving every caller hanging.
        it("reports a synchronous processor error to done", () => {
            const failure = new Error("processor failed");
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((_data, done) => done(null as never, failure));

            let receivedError: any;
            let called = false;
            pipeline.filter<number>(0, (_data, error) => { called = true; receivedError = error; });

            expect(called).toBe(true);
            expect(receivedError).toBe(failure);
        });

        it("reports a thrown processor error to done", () => {
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>(() => { throw new Error("processor threw"); });

            let called = false;
            pipeline.filter<number>(0, () => { called = true; });

            expect(called).toBe(true);
        });

        it("does not run processors after a failing one", () => {
            let laterRan = false;
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((_data, done) => done(null as never, new Error("stop here")))
                .pipe<number>((data, done) => { laterRan = true; done(data); });

            pipeline.filter<number>(0, () => { /* result unused; this asserts side effects */ });

            // Whatever happens to `done`, the pipeline must not keep processing after a
            // failure. This half of the contract does hold.
            expect(laterRan).toBe(false);
        });

        it("calls done exactly once when a processor fails", () => {
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((_data, done) => done(null as never, new Error("boom")));

            let calls = 0;
            pipeline.filter<number>(0, () => { calls++; });

            // Exactly once, not zero (the old hang) and not twice — the error path returns
            // immediately and finalStepSentinel checks the error flag before reporting
            // success, so only one of them can fire.
            expect(calls).toBe(1);
        });

        it("resets its error state between runs so an instance stays reusable", () => {
            const pipeline = new TrampolinePipeline<number>()
                .pipe<number>((data, done) => {
                    if (data < 0) {
                        done(null as never, new Error("negative"));
                        return;
                    }
                    done(data + 1);
                });

            pipeline.filter<number>(-1, () => { /* fails, done not called */ });

            let received: number | undefined;
            pipeline.filter<number>(1, data => { received = data; });

            expect(received).toBe(2);
        });
    });

    describe("data flow", () => {
        it("hands each processor the previous processor's output", () => {
            const seen: unknown[] = [];
            const pipeline = new TrampolinePipeline<number>()
                .pipe<string>((data, done) => { seen.push(data); done(`n${data}`); })
                .pipe<number>((data, done) => { seen.push(data); done(Number(String(data).slice(1))); });

            pipeline.filter<number>(5, () => { /* result checked via `seen` */ });

            expect(seen).toEqual([5, "n5"]);
        });

        it("carries undefined and null through without stopping the chain", () => {
            const pipeline = new TrampolinePipeline<unknown>()
                .pipe<unknown>((_data, done) => done(undefined))
                .pipe<unknown>((data, done) => done(data === undefined ? null : "unexpected"));

            let received: unknown = "not-set";
            pipeline.filter<unknown>("start", data => { received = data; });

            // A falsy payload must not be mistaken for "no result" and halt the pipeline.
            expect(received).toBeNull();
        });
    });
});
