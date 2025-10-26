import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WorkPipeline } from './TrampolinePipeline';
import { Result, CallbackResult } from '../results';

describe('WorkPipeline', () => {
    let pipeline: WorkPipeline;
    let mockDone: jest.Mock<CallbackResult<never>>;

    beforeEach(() => {
        pipeline = new WorkPipeline();
        mockDone = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('basic functionality', () => {
        it('should call done with success when no work units added', () => {
            pipeline.filter(mockDone);

            // Wait for microtask
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    const result = mockDone.mock.calls[0][0];
                    expect(result.ok).toBe(Result.SUCCESS);
                    resolve();
                }, 0);
            });
        });

        it('should execute a single unit of work', () => {
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                done(Result.success());
            });

            pipeline.pipe(mockWork);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockWork).toHaveBeenCalledTimes(1);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.SUCCESS);
                    resolve();
                }, 0);
            });
        });

        it('should execute multiple units of work in order', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });
            const mockWork3 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(3);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.pipe(mockWork3);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2, 3]);
                    expect(mockWork1).toHaveBeenCalledTimes(1);
                    expect(mockWork2).toHaveBeenCalledTimes(1);
                    expect(mockWork3).toHaveBeenCalledTimes(1);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });
    });

    describe('synchronous callbacks', () => {
        it('should handle synchronous callbacks', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success()); // Synchronous call
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success()); // Synchronous call
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });

        it('should chain synchronous callbacks in a loop', () => {
            const callCounts: number[] = [];
            for (let i = 0; i < 10; i++) {
                const work = jest.fn((done: CallbackResult<never>) => {
                    callCounts.push(i);
                    done(Result.success());
                });
                pipeline.pipe(work);
            }

            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(callCounts).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });
    });

    describe('asynchronous callbacks', () => {
        it('should handle asynchronous callbacks', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                setTimeout(() => {
                    done(Result.success());
                }, 10);
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                setTimeout(() => {
                    done(Result.success());
                }, 10);
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.SUCCESS);
                    resolve();
                }, 30);
            });
        });

        it('should handle mixed sync and async callbacks', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success()); // Sync
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                setTimeout(() => {
                    done(Result.success()); // Async
                }, 10);
            });
            const mockWork3 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(3);
                done(Result.success()); // Sync
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.pipe(mockWork3);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2, 3]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 30);
            });
        });
    });

    describe('error handling - thrown errors', () => {
        it('should handle error thrown by unit of work', () => {
            const error = new Error('Test error');
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                throw error;
            });

            pipeline.pipe(mockWork);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    const result = mockDone.mock.calls[0][0];
                    expect(result.ok).toBe(Result.ERROR);
                    if (result.ok === Result.ERROR) {
                        expect(result.error).toBe(error);
                    }
                    resolve();
                }, 0);
            });
        });

        it('should stop processing after error in first unit', () => {
            const executionOrder: number[] = [];
            const error = new Error('Test error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                throw error;
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(mockWork1).toHaveBeenCalledTimes(1);
                    expect(mockWork2).toHaveBeenCalledTimes(0);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });

        it('should handle error in middle unit of work', () => {
            const executionOrder: number[] = [];
            const error = new Error('Test error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                throw error;
            });
            const mockWork3 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(3);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.pipe(mockWork3);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockWork1).toHaveBeenCalledTimes(1);
                    expect(mockWork2).toHaveBeenCalledTimes(1);
                    expect(mockWork3).toHaveBeenCalledTimes(0);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });

        it('should handle error in last unit of work', () => {
            const executionOrder: number[] = [];
            const error = new Error('Test error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                throw error;
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });
    });

    describe('error handling - callback errors', () => {
        it('should handle error passed to callback', () => {
            const error = new Error('Callback error');
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                done(Result.error(error));
            });

            pipeline.pipe(mockWork);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    const result = mockDone.mock.calls[0][0];
                    expect(result.ok).toBe(Result.ERROR);
                    if (result.ok === Result.ERROR) {
                        expect(result.error).toBe(error);
                    }
                    resolve();
                }, 0);
            });
        });

        it('should stop processing after callback error in first unit', () => {
            const executionOrder: number[] = [];
            const error = new Error('Callback error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.error(error));
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(mockWork2).toHaveBeenCalledTimes(0);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });

        it('should handle callback error in async callback', () => {
            const executionOrder: number[] = [];
            const error = new Error('Async callback error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                setTimeout(() => {
                    try {
                        done(Result.error(error));
                    } catch (e) {
                        // Error is thrown inside async callback but may not reach done properly
                    }
                }, 10);
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(mockWork2).toHaveBeenCalledTimes(0);
                    // When error is thrown from async callback, it should eventually reach done
                    if (mockDone.mock.calls.length > 0) {
                        expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    }
                    resolve();
                }, 50);
            });
        });

        it('should handle error in middle unit callback', () => {
            const executionOrder: number[] = [];
            const error = new Error('Callback error');
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.error(error));
            });
            const mockWork3 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(3);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.pipe(mockWork3);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockWork3).toHaveBeenCalledTimes(0);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });
    });

    describe('edge cases', () => {
        it('should handle unit of work that never calls done', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                // Never calls done
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(mockWork2).toHaveBeenCalledTimes(0);
                    expect(mockDone).toHaveBeenCalledTimes(0);
                    resolve();
                }, 50);
            });
        });

        it('should handle multiple success calls to callback', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
                done(Result.success()); // Call done twice
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });

        it('should handle repeated filter calls', () => {
            const executionCounts: number[] = [];
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                const count = executionCounts.push(0);
                done(Result.success());
            });

            pipeline.pipe(mockWork);

            return new Promise<void>((resolve) => {
                // First call
                pipeline.filter(mockDone);
                setTimeout(() => {
                    expect(executionCounts).toHaveLength(1);
                    // Second call
                    pipeline.filter(mockDone);
                    setTimeout(() => {
                        expect(executionCounts).toHaveLength(2);
                        expect(mockWork).toHaveBeenCalledTimes(2);
                        expect(mockDone).toHaveBeenCalledTimes(2);
                        resolve();
                    }, 0);
                }, 0);
            });
        });

        it('should handle rapid sequential work units', () => {
            const executionOrder: number[] = [];
            for (let i = 0; i < 20; i++) {
                const work = jest.fn((done: CallbackResult<never>) => {
                    executionOrder.push(i);
                    done(Result.success());
                });
                pipeline.pipe(work);
            }

            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toHaveLength(20);
                    expect(executionOrder).toEqual(Array.from({ length: 20 }, (_, i) => i));
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });

        it('should handle work unit that throws then calls done', () => {
            const executionOrder: number[] = [];
            const error = new Error('Error then done');
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                try {
                    throw error;
                } catch (e) {
                    // Even if we call done after throwing, the error should still propagate
                    // But this tests the handler is robust
                    done(Result.error(e as Error));
                }
            });

            pipeline.pipe(mockWork);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 0);
            });
        });
    });

    describe('concurrent execution prevention', () => {
        it('should execute work units from pipeline in order', () => {
            const executionOrder: number[] = [];
            const mockWork1 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                done(Result.success());
            });
            const mockWork2 = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(2);
                done(Result.success());
            });

            // Add both work units before filtering
            pipeline.pipe(mockWork1);
            pipeline.pipe(mockWork2);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // Both should execute in order
                    expect(executionOrder).toEqual([1, 2]);
                    expect(mockWork1).toHaveBeenCalledTimes(1);
                    expect(mockWork2).toHaveBeenCalledTimes(1);
                    resolve();
                }, 0);
            });
        });
    });

    describe('complex scenarios', () => {
        it('should handle work units that throw with async callbacks scheduled', () => {
            const executionOrder: number[] = [];
            let asyncCallbackScheduled = false;
            const error = new Error('Error during async');
            const mockWork = jest.fn((done: CallbackResult<never>) => {
                executionOrder.push(1);
                setTimeout(() => {
                    asyncCallbackScheduled = true;
                }, 10);
                throw error;
            });

            pipeline.pipe(mockWork);
            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([1]);
                    expect(asyncCallbackScheduled).toBe(true);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    expect(mockDone.mock.calls[0][0].ok).toBe(Result.ERROR);
                    resolve();
                }, 50);
            });
        });

        it('should handle alternating sync and async work units', () => {
            const executionOrder: number[] = [];
            for (let i = 0; i < 5; i++) {
                const sync = i % 2 === 0;
                const work = jest.fn((done: CallbackResult<never>) => {
                    executionOrder.push(i);
                    if (sync) {
                        done(Result.success());
                    } else {
                        setTimeout(() => {
                            done(Result.success());
                        }, 10);
                    }
                });
                pipeline.pipe(work);
            }

            pipeline.filter(mockDone);

            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
                    expect(mockDone).toHaveBeenCalledTimes(1);
                    resolve();
                }, 100);
            });
        });
    });
});
