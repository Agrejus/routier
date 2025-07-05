import { describe, it, expect } from 'vitest';
import { TrampolinePipeline } from './TrampolinePipeline';

describe('TrampolinePipeline', () => {
    describe('empty pipeline', () => {
        it('should immediately call done with initial data when no processors are added', async () => {
            const pipeline = new TrampolinePipeline<number>();
            const testData = 42;

            const result = await new Promise<number>((resolve, reject) => {
                pipeline.filter(testData, (result: any, error?: any) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            expect(result).toBe(testData);
        });
    });

    describe('single processor', () => {
        it('should process data through a single synchronous processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline.pipe(processor).filter(5, (result: any, error?: any) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            expect(result).toBe(10);
        });

        it('should process data through a single asynchronous processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data * 2), 10);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline.pipe(processor).filter(5, (result: any, error?: any) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            expect(result).toBe(10);
        });

        it('should handle errors from a single processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const error = new Error('Test error');
            const processor = (data: number, callback: (result: number, error?: any) => void) => {
                callback(data, error);
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline.pipe(processor).filter(5, (result: any, error?: any) => {
                    resolve({ result, error });
                });
            });

            expect(result.error).toBe(error);
            expect(result.result).toBe(5);
        });

        it('should handle thrown errors from a single processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const error = new Error('Test error');
            const processor = (data: number, callback: (result: number) => void) => {
                throw error;
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline.pipe(processor).filter(5, (result: any, error?: any) => {
                    resolve({ result, error });
                });
            });

            expect(result.error).toBe(error);
            expect(result.result).toBe(5);
        });
    });

    describe('multiple processors', () => {
        it('should process data through multiple synchronous processors', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                callback(data + 3);
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                callback(data * 4);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(5, (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toBe(52); // (5 * 2 + 3) * 4 = 52
        });

        it('should process data through multiple asynchronous processors', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data * 2), 10);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data + 3), 10);
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data * 4), 10);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(5, (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toBe(52);
        });

        it('should process data through mixed synchronous and asynchronous processors', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data + 3), 10);
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                callback(data * 4);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(5, (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toBe(52);
        });

        it('should handle errors from middle processor and stop processing', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number, error?: any) => void) => {
                callback(data, new Error('Middle processor error'));
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                callback(data * 4);
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(5, (result: any, error?: any) => {
                        resolve({ result, error });
                    });
            });

            expect(result.error.message).toBe('Middle processor error');
            expect(result.result).toBe(10); // Should be result from processor1
        });

        it('should handle thrown errors from middle processor and stop processing', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                throw new Error('Middle processor thrown error');
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                callback(data * 4);
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(5, (result: any, error?: any) => {
                        resolve({ result, error });
                    });
            });

            expect(result.error.message).toBe('Middle processor thrown error');
            expect(result.result).toBe(10);
        });
    });

    describe('type transformations', () => {
        it('should transform data types through the pipeline', async () => {
            const pipeline = new TrampolinePipeline<string, number>();
            const processor1 = (data: string, callback: (result: number) => void) => {
                callback(parseInt(data));
            };
            const processor2 = (data: number, callback: (result: string) => void) => {
                callback(data.toString());
            };
            const processor3 = (data: string, callback: (result: number) => void) => {
                callback(data.length);
            };

            const result = await new Promise<number>((resolve, reject) => {
                (pipeline as any)
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter('42', (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toBe(2); // "42" -> 42 -> "42" -> 2
        });

        it('should handle complex object transformations', async () => {
            const pipeline = new TrampolinePipeline<{ name: string }, { count: number }>();
            const processor1 = (data: { name: string }, callback: (result: string) => void) => {
                callback(data.name.toUpperCase());
            };
            const processor2 = (data: string, callback: (result: { count: number }) => void) => {
                callback({ count: data.length });
            };

            const result = await new Promise<{ count: number }>((resolve, reject) => {
                (pipeline as any)
                    .pipe(processor1)
                    .pipe(processor2)
                    .filter({ name: 'test' }, (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toEqual({ count: 4 });
        });
    });

    describe('error handling edge cases', () => {
        it('should not call done multiple times when multiple errors occur', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number, error?: any) => void) => {
                callback(data, new Error('First error'));
            };
            const processor2 = (data: number, callback: (result: number, error?: any) => void) => {
                callback(data, new Error('Second error'));
            };

            let doneCallCount = 0;
            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .filter(5, (result: any, error?: any) => {
                        doneCallCount++;
                        resolve({ result, error });
                    });
            });

            expect(doneCallCount).toBe(1);
            expect(result.error.message).toBe('First error');
            expect(result.result).toBe(5);
        });

        it('should handle errors in the final processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number, error?: any) => void) => {
                callback(data, new Error('Final processor error'));
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .filter(5, (result: any, error?: any) => {
                        resolve({ result, error });
                    });
            });

            expect(result.error.message).toBe('Final processor error');
            expect(result.result).toBe(10);
        });

        it('should handle thrown errors in the final processor', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data * 2);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                throw new Error('Final processor thrown error');
            };

            const result = await new Promise<{ result: number; error: any }>((resolve) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .filter(5, (result: any, error?: any) => {
                        resolve({ result, error });
                    });
            });

            expect(result.error.message).toBe('Final processor thrown error');
            expect(result.result).toBe(10);
        });
    });

    describe('concurrent execution protection', () => {
        it('should prevent overlapping trampoline calls', async () => {
            const pipeline = new TrampolinePipeline<number, number>();
            const processor = (data: number, callback: (result: number) => void) => {
                setTimeout(() => callback(data * 2), 10);
            };

            let executionCount = 0;
            const result = await new Promise<number>((resolve, reject) => {
                const doneCallback = (result: any, error?: any) => {
                    executionCount++;
                    if (error) reject(error);
                    else resolve(result);
                };

                pipeline.pipe(processor).filter(5, doneCallback);
            });

            expect(executionCount).toBe(1);
            expect(result).toBe(10);
        });
    });

    describe('complex scenarios', () => {
        it('should handle a long chain of processors with mixed sync/async', async () => {
            const pipeline = new TrampolinePipeline<number, string>();

            const processors = [
                (data: number, callback: (result: number) => void) => callback(data * 2),
                (data: number, callback: (result: number) => void) => setTimeout(() => callback(data + 1), 5),
                (data: number, callback: (result: number) => void) => callback(data * 3),
                (data: number, callback: (result: number) => void) => setTimeout(() => callback(data - 5), 5),
                (data: number, callback: (result: string) => void) => callback(`Result: ${data}`),
            ];

            let currentPipeline = pipeline as any;
            processors.forEach(processor => {
                currentPipeline = currentPipeline.pipe(processor);
            });

            const result = await new Promise<string>((resolve, reject) => {
                currentPipeline.filter(10, (result: any, error?: any) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            expect(result).toBe('Result: 61'); // ((10 * 2 + 1) * 3 - 5) = 61
        });

        it('should handle processors that return the same data type', async () => {
            const pipeline = new TrampolinePipeline<number, number>();

            const processor1 = (data: number, callback: (result: number) => void) => {
                callback(data + 1);
            };
            const processor2 = (data: number, callback: (result: number) => void) => {
                callback(data + 1);
            };
            const processor3 = (data: number, callback: (result: number) => void) => {
                callback(data + 1);
            };

            const result = await new Promise<number>((resolve, reject) => {
                pipeline
                    .pipe(processor1)
                    .pipe(processor2)
                    .pipe(processor3)
                    .filter(0, (result: any, error?: any) => {
                        if (error) reject(error);
                        else resolve(result);
                    });
            });

            expect(result).toBe(3);
        });
    });
});
