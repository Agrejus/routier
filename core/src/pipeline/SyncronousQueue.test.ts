import { describe, it, expect, jest } from '@jest/globals';
import { SyncronousQueue } from './SyncronousQueue';

describe('SyncronousQueue', () => {
    describe('enqueue', () => {
        it('should add unit of work to queue and start processing', () => {
            const queue = new SyncronousQueue();
            const mockUnitOfWork = jest.fn((done: () => void) => {
                done();
            });

            queue.enqueue(mockUnitOfWork);

            expect(mockUnitOfWork).toHaveBeenCalledTimes(1);
        });

        it('should process multiple units of work in order', () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const unitOfWork1 = jest.fn((done: () => void) => {
                executionOrder.push(1);
                done();
            });

            const unitOfWork2 = jest.fn((done: () => void) => {
                executionOrder.push(2);
                done();
            });

            queue.enqueue(unitOfWork1);
            queue.enqueue(unitOfWork2);

            expect(executionOrder).toEqual([1, 2]);
            expect(unitOfWork1).toHaveBeenCalledTimes(1);
            expect(unitOfWork2).toHaveBeenCalledTimes(1);
        });

        it('should not start processing if already processing', () => {
            const queue = new SyncronousQueue();
            let doneCalled = false;

            const slowUnitOfWork = jest.fn((done: () => void) => {
                setTimeout(() => {
                    doneCalled = true;
                    done();
                }, 10);
            });

            const fastUnitOfWork = jest.fn((done: () => void) => {
                done();
            });

            queue.enqueue(slowUnitOfWork);
            queue.enqueue(fastUnitOfWork);

            expect(slowUnitOfWork).toHaveBeenCalledTimes(1);
            expect(fastUnitOfWork).toHaveBeenCalledTimes(0);
        });

        it('should process next unit of work after current one completes', async () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const slowUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(1);
                setTimeout(() => {
                    done();
                }, 10);
            });

            const fastUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(2);
                done();
            });

            queue.enqueue(slowUnitOfWork);
            queue.enqueue(fastUnitOfWork);

            await new Promise(resolve => setTimeout(resolve, 20));

            expect(executionOrder).toEqual([1, 2]);
            expect(slowUnitOfWork).toHaveBeenCalledTimes(1);
            expect(fastUnitOfWork).toHaveBeenCalledTimes(1);
        });
    });

    describe('queue behavior', () => {
        it('should handle empty queue', () => {
            const queue = new SyncronousQueue();

            expect(() => {
                queue.enqueue(jest.fn((done: () => void) => done()));
            }).not.toThrow();
        });

        it('should handle unit of work that never calls done', () => {
            const queue = new SyncronousQueue();
            const stuckUnitOfWork = jest.fn((done: () => void) => {
                // Never calls done
            });

            const secondUnitOfWork = jest.fn((done: () => void) => {
                done();
            });

            queue.enqueue(stuckUnitOfWork);
            queue.enqueue(secondUnitOfWork);

            expect(stuckUnitOfWork).toHaveBeenCalledTimes(1);
            expect(secondUnitOfWork).toHaveBeenCalledTimes(0);
        });

        it('should handle unit of work that calls done multiple times', () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const multiDoneUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(1);
                done();
                done(); // Call done multiple times
            });

            const secondUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(2);
                done();
            });

            queue.enqueue(multiDoneUnitOfWork);
            queue.enqueue(secondUnitOfWork);

            expect(executionOrder).toEqual([1, 2]);
            expect(multiDoneUnitOfWork).toHaveBeenCalledTimes(1);
            expect(secondUnitOfWork).toHaveBeenCalledTimes(1);
        });

        it('should handle rapid enqueueing of multiple units', () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const createUnitOfWork = (id: number) => jest.fn((done: () => void) => {
                executionOrder.push(id);
                done();
            });

            for (let i = 1; i <= 5; i++) {
                queue.enqueue(createUnitOfWork(i));
            }

            expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
        });

        it('should handle unit of work that throws error', () => {
            const queue = new SyncronousQueue();
            const errorUnitOfWork = jest.fn((done: () => void) => {
                throw new Error('Test error');
            });

            const secondUnitOfWork = jest.fn((done: () => void) => {
                done();
            });

            expect(() => {
                queue.enqueue(errorUnitOfWork);
            }).toThrow('Test error');

            expect(errorUnitOfWork).toHaveBeenCalledTimes(1);
        });

        it('should not process next unit after error', () => {
            const queue = new SyncronousQueue();
            const errorUnitOfWork = jest.fn((done: () => void) => {
                throw new Error('Test error');
            });

            const secondUnitOfWork = jest.fn((done: () => void) => {
                done();
            });

            try {
                queue.enqueue(errorUnitOfWork);
            } catch (error) {
                // Error is thrown, queue stops processing
            }

            queue.enqueue(secondUnitOfWork);

            expect(errorUnitOfWork).toHaveBeenCalledTimes(1);
            expect(secondUnitOfWork).toHaveBeenCalledTimes(0);
        });

        it('should handle unit of work that calls done asynchronously', async () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const asyncUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(1);
                Promise.resolve().then(() => {
                    done();
                });
            });

            const syncUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(2);
                done();
            });

            queue.enqueue(asyncUnitOfWork);
            queue.enqueue(syncUnitOfWork);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(executionOrder).toEqual([1, 2]);
            expect(asyncUnitOfWork).toHaveBeenCalledTimes(1);
            expect(syncUnitOfWork).toHaveBeenCalledTimes(1);
        });
    });

    describe('edge cases', () => {
        it('should handle null done callback', () => {
            const queue = new SyncronousQueue();
            const unitOfWork = jest.fn((done: () => void) => {
                done();
            });

            expect(() => {
                queue.enqueue(unitOfWork);
            }).not.toThrow();

            expect(unitOfWork).toHaveBeenCalledTimes(1);
        });

        it('should handle unit of work that enqueues another unit of work', () => {
            const queue = new SyncronousQueue();
            const executionOrder: number[] = [];

            const recursiveUnitOfWork = jest.fn((done: () => void) => {
                executionOrder.push(1);
                queue.enqueue(jest.fn((innerDone: () => void) => {
                    executionOrder.push(2);
                    innerDone();
                }));
                done();
            });

            queue.enqueue(recursiveUnitOfWork);

            expect(executionOrder).toEqual([1, 2]);
            expect(recursiveUnitOfWork).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple rapid enqueue operations', () => {
            const queue = new SyncronousQueue();
            const executionCount = { count: 0 };

            const unitOfWork = jest.fn((done: () => void) => {
                executionCount.count++;
                done();
            });

            for (let i = 0; i < 100; i++) {
                queue.enqueue(unitOfWork);
            }

            expect(executionCount.count).toBe(100);
            expect(unitOfWork).toHaveBeenCalledTimes(100);
        });
    });
}); 