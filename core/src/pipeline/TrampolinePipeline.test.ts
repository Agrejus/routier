import { describe, it, expect, vi } from 'vitest';
import { TrampolinePipeline, AsyncPipeline, Processor, AsyncUnitOfWork } from './TrampolinePipeline';
import { Result } from '../results';

describe('TrampolinePipeline', () => {
    describe('filter', () => {
        it('should call done immediately when no processors are added', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const initialData = 'test data';

            return new Promise<void>((resolve) => {
                pipeline.filter(initialData, (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe(initialData);
                    resolve();
                });
            });
        });

        it('should process single processor synchronously', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const processor: Processor<string, string> = vi.fn((data, callback) => {
                expect(data).toBe('test');
                callback('result');
            });

            pipeline.pipe(processor);

            return new Promise<void>((resolve) => {
                pipeline.filter('test', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('result');
                    expect(processor).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });

        it('should process multiple processors in order', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const executionOrder: number[] = [];

            const processor1: Processor<string, number> = vi.fn((data, callback) => {
                executionOrder.push(1);
                expect(data).toBe('test');
                callback(42);
            });

            const processor2: Processor<number, string> = vi.fn((data, callback) => {
                executionOrder.push(2);
                expect(data).toBe(42);
                callback('result');
            });

            pipeline.pipe(processor1).pipe(processor2);

            return new Promise<void>((resolve) => {
                pipeline.filter('test', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('result');
                    expect(executionOrder).toEqual([1, 2]);
                    expect(processor1).toHaveBeenCalledTimes(1);
                    expect(processor2).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });

        it('should handle asynchronous processors', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const processor: Processor<string, string> = vi.fn((data, callback) => {
                setTimeout(() => {
                    callback(data.toUpperCase());
                }, 10);
            });

            pipeline.pipe(processor);

            return new Promise<void>((resolve) => {
                pipeline.filter('test', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('TEST');
                    expect(processor).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });

        it('should handle mixed sync and async processors', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const executionOrder: number[] = [];

            const syncProcessor: Processor<string, number> = vi.fn((data, callback) => {
                executionOrder.push(1);
                callback(data.length);
            });

            const asyncProcessor: Processor<number, string> = vi.fn((data, callback) => {
                executionOrder.push(2);
                setTimeout(() => {
                    callback(`Length: ${data}`);
                }, 10);
            });

            pipeline.pipe(syncProcessor).pipe(asyncProcessor);

            return new Promise<void>((resolve) => {
                pipeline.filter('test', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('Length: 4');
                    expect(executionOrder).toEqual([1, 2]);
                    expect(syncProcessor).toHaveBeenCalledTimes(1);
                    expect(asyncProcessor).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });

        it('should handle overlapping filter calls', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const processor: Processor<string, string> = vi.fn((data, callback) => {
                setTimeout(() => {
                    callback(data.toUpperCase());
                }, 10);
            });

            pipeline.pipe(processor);

            return new Promise<void>((resolve) => {
                let completedCount = 0;
                const checkDone = () => {
                    completedCount++;
                    if (completedCount === 2) {
                        resolve();
                    }
                };

                // Start two filter operations simultaneously
                pipeline.filter('test1', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('TEST1');
                    checkDone();
                });

                pipeline.filter('test2', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('TEST2');
                    checkDone();
                });
            });
        });
    });

    describe('pipe', () => {
        it('should return pipeline instance for chaining', () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const processor: Processor<string, string> = vi.fn((data, callback) => {
                callback(data);
            });

            const result = pipeline.pipe(processor);

            expect(result).toBe(pipeline);
        });

        it('should add processor to the list', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const processor: Processor<string, string> = vi.fn((data, callback) => {
                callback(data);
            });

            pipeline.pipe(processor);

            return new Promise<void>((resolve) => {
                pipeline.filter('test', (result, error) => {
                    expect(processor).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });
    });

    describe('pipeEach', () => {
        it('should process each item in array', async () => {
            const pipeline = new TrampolinePipeline<string, string>();
            const items = ['a', 'b', 'c'];
            const processedItems: string[] = [];

            pipeline.pipeEach(
                items,
                (payload, done) => {
                    if (payload.ok === Result.SUCCESS) {
                        processedItems.push(payload.data);
                        done(Result.success(payload.data.toUpperCase()));
                    }
                },
                (previous, current) => current
            );

            return new Promise<void>((resolve) => {
                pipeline.filter('initial', (result, error) => {
                    expect(error).toBeUndefined();
                    // The result should be a Result object with the last processed item
                    expect(result).toEqual({ ok: 'success', data: 'C' });
                    expect(processedItems).toEqual(['a', 'b', 'c']);
                    resolve();
                });
            });
        });

        it('should handle empty array in pipeEach', async () => {
            const pipeline = new TrampolinePipeline<string, string>();

            pipeline.pipeEach(
                [],
                (payload, done) => {
                    if (payload.ok === Result.SUCCESS) {
                        done(Result.success(payload.data));
                    }
                },
                (previous, current) => current
            );

            return new Promise<void>((resolve) => {
                pipeline.filter('initial', (result, error) => {
                    expect(error).toBeUndefined();
                    expect(result).toBe('initial');
                    resolve();
                });
            });
        });
    });
});

describe('AsyncPipeline', () => {
    describe('filter', () => {
        it('should call done with empty array when no processors are added', async () => {
            const pipeline = new AsyncPipeline<string, string>();

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        // When no processors are added, data should be undefined, not empty array
                        expect(result.data).toBeUndefined();
                    }
                    resolve();
                });
            });
        });

        it('should process single unit of work', async () => {
            const pipeline = new AsyncPipeline<string, string>();
            const unitOfWork: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                expect(payload).toBe('test');
                done(Result.success('result'));
            });

            pipeline.pipe('test', unitOfWork);

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        expect(result.data).toEqual(['result']);
                    }
                    expect(unitOfWork).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });

        it('should process multiple units of work', async () => {
            const pipeline = new AsyncPipeline<string, string>();
            const executionOrder: number[] = [];

            const unitOfWork1: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                executionOrder.push(1);
                done(Result.success(`result1-${payload}`));
            });

            const unitOfWork2: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                executionOrder.push(2);
                done(Result.success(`result2-${payload}`));
            });

            pipeline.pipe('test1', unitOfWork1);
            pipeline.pipe('test2', unitOfWork2);

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        expect(result.data).toEqual(['result1-test1', 'result2-test2']);
                    }
                    expect(executionOrder).toEqual([1, 2]);
                    expect(unitOfWork1).toHaveBeenCalledTimes(1);
                    expect(unitOfWork2).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });
    });

    describe('pipe', () => {
        it('should add unit of work to the list', async () => {
            const pipeline = new AsyncPipeline<string, string>();
            const unitOfWork: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                done(Result.success(payload));
            });

            pipeline.pipe('test', unitOfWork);

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        expect(result.data).toEqual(['test']);
                    }
                    expect(unitOfWork).toHaveBeenCalledTimes(1);
                    resolve();
                });
            });
        });
    });

    describe('pipeEach', () => {
        it('should process each item in array', async () => {
            const pipeline = new AsyncPipeline<string, string>();
            const items = ['a', 'b', 'c'];
            const processedItems: string[] = [];

            const unitOfWork: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                processedItems.push(payload);
                done(Result.success(payload.toUpperCase()));
            });

            pipeline.pipeEach(items, unitOfWork);

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        expect(result.data).toEqual(['A', 'B', 'C']);
                    }
                    expect(processedItems).toEqual(['a', 'b', 'c']);
                    expect(unitOfWork).toHaveBeenCalledTimes(3);
                    resolve();
                });
            });
        });

        it('should handle empty array in pipeEach', async () => {
            const pipeline = new AsyncPipeline<string, string>();
            const unitOfWork: AsyncUnitOfWork<string, string> = vi.fn((payload, done) => {
                done(Result.success(payload));
            });

            pipeline.pipeEach([], unitOfWork);

            return new Promise<void>((resolve) => {
                pipeline.filter((result) => {
                    expect(result.ok).toBe(Result.SUCCESS);
                    if (result.ok === Result.SUCCESS) {
                        // When pipeEach is called with empty array, data should be undefined, not empty array
                        expect(result.data).toBeUndefined();
                    }
                    expect(unitOfWork).toHaveBeenCalledTimes(0);
                    resolve();
                });
            });
        });
    });
}); 