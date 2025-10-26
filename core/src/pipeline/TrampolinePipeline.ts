import { CallbackResult, Result, ResultType } from "../results";

/**
 * Type definition for an asynchronous function that takes data and a callback.
 * TIn: The input data type.
 * TOut: The output data type (passed to the callback).
 */
export type Processor<TIn, TOut> = (data: TIn, callback: (result: TOut, error?: any) => void) => void;

// Return type for a step execution: Either the next step function or null if waiting/done.
type StepResult<TData> = TrampolineStep<TData> | null;
type TrampolineStep<TData> = () => StepResult<TData>;

export class TrampolinePipeline<TInitial, TCurrent = TInitial> {
    private _list: Processor<any, any>[] = [];
    private _hasErrored: boolean = false; // Flag to prevent calling done on error

    filter<TFinal>(initialData: TInitial, done: (data: TFinal, error?: any) => void) {

        this._hasErrored = false; // Reset error flag on new execution

        if (this._list.length === 0) {
            queueMicrotask(() => done(initialData as any as TFinal));
            return;
        }

        let index = 0;
        let currentData: any = initialData;
        let isRunning = false; // Guard against overlapping trampoline calls

        try {
            // --- Revised Completion Logic --- (Moved up for clarity)
            const finalStepSentinel = (): StepResult<any> => { // A special step function for the very end
                // Only call done if no error has occurred
                if (!this._hasErrored) {
                    queueMicrotask(() => done(currentData as TFinal));
                }
                return null; // Stop the trampoline
            };

            const createStepRevised = (idx: number): TrampolineStep<any> => {
                return () => {
                    if (this._hasErrored) return null; // Stop if an error occurred elsewhere

                    if (idx >= this._list.length) {
                        return finalStepSentinel(); // Execute the dedicated final step
                    }

                    const processor = this._list[idx];
                    // Initialize syncCallbackResult to null to satisfy StepResult type
                    let syncCallbackResult: StepResult<any> = null;
                    let calledSync = false;

                    try {
                        processor(currentData, (result, error) => {
                            // --- Error Handling ---
                            if (error) {
                                console.error(`Error reported by processor at index ${idx}:`, error);
                                this._hasErrored = true; // Set flag
                                // Throw the error to be caught by outer try...catch blocks
                                throw error;
                            }
                            // --- /Error Handling ---

                            // If no error, proceed as before
                            currentData = result;
                            index = idx + 1; // Update index for the next step
                            const nextStep = createStepRevised(index); // Use updated index

                            if (isRunning) {
                                // Callback was synchronous
                                syncCallbackResult = nextStep; // Store next step function
                                calledSync = true;
                            } else {
                                // Callback was asynchronous, restart trampoline
                                trampoline(nextStep);
                            }
                        });
                    } catch (error) {
                        if (!this._hasErrored) { // Check flag to avoid double logging if error was from callback
                            console.error(`Error thrown by processor at index ${idx} or its callback:`, error);
                            this._hasErrored = true;
                        }
                        // Rethrow to be caught by the trampoline's catch block
                        throw error;
                    }

                    if (calledSync) {
                        // Return the next step function for the sync loop
                        return syncCallbackResult;
                    } else {
                        // Pause trampoline for async, loop will stop as step returns null
                        return null;
                    }
                };
            };

            // The trampoline loop
            const trampoline = (step: TrampolineStep<any> | null) => {

                if (isRunning) {
                    return;
                }

                isRunning = true;
                let currentStep = step;

                while (typeof currentStep === 'function') {
                    try {
                        // Stop immediately if an error was flagged elsewhere
                        if (this._hasErrored) {
                            currentStep = null;
                            break;
                        }
                        currentStep = currentStep(); // Execute step, get next step or null
                    } catch (trampolineError) {
                        // Catch errors propagated from step execution (processor or callback errors)
                        if (!this._hasErrored) { // Avoid double logging
                            console.error("Error during trampoline step execution:", trampolineError);
                            this._hasErrored = true;
                        }
                        currentStep = null; // Stop the loop
                        // Call done with the error to properly notify the caller
                        queueMicrotask(() => done(currentData as TFinal, trampolineError));
                        break; // Explicitly break loop on error
                    }
                }
                // Loop ends when currentStep is null or loop is broken by error
                isRunning = false;

                // Completion check is now handled by finalStepSentinel ensuring `done` isn't called on error.
            };

            // --- Start the process ---
            index = 0; // Reset index
            currentData = initialData; // Reset data
            trampoline(createStepRevised(0)); // Start with the revised step creator
        } catch (error: any) {
            done(currentData, error);
        }
    }

    pipe<TNext>(processor: Processor<TCurrent, TNext>) {
        this._list.push(processor);
        return this as unknown as TrampolinePipeline<TInitial, TNext>;
    }

    pipeEach(items: TCurrent[], fn: (payload: ResultType<TCurrent>, done: CallbackResult<TCurrent>) => void, map: (previous: ResultType<TCurrent>, current: ResultType<TCurrent>) => ResultType<TCurrent>) {
        for (let i = 0, length = items.length; i < length; i++) {

            this.pipe<ResultType<TCurrent>>((previous, done) => {

                fn(map(previous as ResultType<TCurrent>, Result.success(items[i])), done);
            });
        }
    }
}

export type AsyncUnitOfWork<TData, TResult> = (payload: TData, done: CallbackResult<TResult>) => void;
export class AsyncPipeline<TData, TResult> {
    private _list: [TData, AsyncUnitOfWork<TData, TResult>][] = [];
    private _hasErrored: boolean = false; // Flag to prevent calling done on error

    filter(done: CallbackResult<TResult[]>) {

        this._hasErrored = false; // Reset error flag on new execution
        let currentData: TResult[] = [];

        if (this._list.length === 0) {
            queueMicrotask(() => done(Result.success()));
            return;
        }

        let index = 0;
        let isRunning = false; // Guard against overlapping trampoline calls

        try {
            // --- Revised Completion Logic --- (Moved up for clarity)
            const finalStepSentinel = (): StepResult<any> => { // A special step function for the very end
                // Only call done if no error has occurred
                if (!this._hasErrored) {
                    queueMicrotask(() => done(Result.success(currentData)));
                }
                return null; // Stop the trampoline
            };

            const createStepRevised = (idx: number): TrampolineStep<any> => {
                return () => {
                    if (this._hasErrored) return null; // Stop if an error occurred elsewhere

                    if (idx >= this._list.length) {
                        return finalStepSentinel(); // Execute the dedicated final step
                    }

                    const [payload, processor] = this._list[idx];
                    // Initialize syncCallbackResult to null to satisfy StepResult type
                    let syncCallbackResult: StepResult<any> = null;
                    let calledSync = false;

                    try {
                        processor(payload, (result) => {
                            // --- Error Handling ---
                            if (result.ok === Result.ERROR) {
                                console.error(`Error reported by AsyncPipeline at index ${idx}:`, result.error);
                                this._hasErrored = true; // Set flag
                                // Throw the error to be caught by outer try...catch blocks
                                throw result.error;
                            }
                            // --- /Error Handling ---

                            // If no error, proceed as before
                            currentData.push(result.data);
                            index = idx + 1; // Update index for the next step
                            const nextStep = createStepRevised(index); // Use updated index

                            if (isRunning) {
                                // Callback was synchronous
                                syncCallbackResult = nextStep; // Store next step function
                                calledSync = true;
                            } else {
                                // Callback was asynchronous, restart trampoline
                                trampoline(nextStep);
                            }
                        });
                    } catch (error) {
                        if (!this._hasErrored) { // Check flag to avoid double logging if error was from callback
                            console.error(`Error thrown by processor at index ${idx} or its callback:`, error);
                            this._hasErrored = true;
                        }
                        // Rethrow to be caught by the trampoline's catch block
                        throw error;
                    }

                    if (calledSync) {
                        // Return the next step function for the sync loop
                        return syncCallbackResult;
                    } else {
                        // Pause trampoline for async, loop will stop as step returns null
                        return null;
                    }
                };
            };

            // The trampoline loop
            const trampoline = (step: TrampolineStep<any> | null) => {

                if (isRunning) {
                    return;
                }

                isRunning = true;
                let currentStep = step;

                while (typeof currentStep === 'function') {
                    try {
                        // Stop immediately if an error was flagged elsewhere
                        if (this._hasErrored) {
                            currentStep = null;
                            break;
                        }
                        currentStep = currentStep(); // Execute step, get next step or null
                    } catch (trampolineError) {
                        // Catch errors propagated from step execution (processor or callback errors)
                        if (!this._hasErrored) { // Avoid double logging
                            console.error("Error during trampoline step execution:", trampolineError);
                            this._hasErrored = true;
                        }
                        currentStep = null; // Stop the loop
                        // Call done with the error to properly notify the caller
                        queueMicrotask(() => done(Result.error(trampolineError)));
                        break; // Explicitly break loop on error
                    }
                }
                // Loop ends when currentStep is null or loop is broken by error
                isRunning = false;

                // Completion check is now handled by finalStepSentinel ensuring `done` isn't called on error.
            };

            // --- Start the process ---
            index = 0; // Reset index
            trampoline(createStepRevised(0)); // Start with the revised step creator
        } catch (error: any) {
            done(Result.error(error));
        }
    }

    pipe(data: TData, processor: AsyncUnitOfWork<TData, TResult>) {
        this._list.push([data, processor]);
    }

    pipeEach(items: TData[], processor: AsyncUnitOfWork<TData, TResult>) {
        for (let i = 0, length = items.length; i < length; i++) {
            this.pipe(items[i], processor);
        }
    }
}

export type UnitOfWork = (done: CallbackResult<never>) => void;

/**
 * Processes functions with callbacks asynchronously.
 * 
 * This pipeline handles work items that contain callback functions,
 * executing them in an asynchronous manner while maintaining proper
 * flow control and error handling.
 */
export class WorkPipeline {
    private unitsOfWork: UnitOfWork[] = [];

    filter(done: CallbackResult<never>) {
        const units = this.unitsOfWork;
        const unitsLength = units.length;

        // Fast path for empty pipeline
        if (unitsLength === 0) {
            queueMicrotask(() => done(Result.success()));
            return;
        }

        // Fast path for single work unit
        if (unitsLength === 1) {
            try {
                units[0]((result) => {
                    queueMicrotask(() => done(result));
                });
            } catch (error: any) {
                done(Result.error(error));
            }
            return;
        }

        let isRunning = false;
        let hasErrored = false;

        try {
            const createStep = (idx: number): TrampolineStep<any> => {
                return () => {
                    if (hasErrored) return null;
                    if (idx >= unitsLength) {
                        if (!hasErrored) {
                            queueMicrotask(() => done(Result.success()));
                        }
                        return null;
                    }

                    const processor = units[idx];
                    let syncResult: StepResult<any> = null;
                    let calledSync = false;

                    try {
                        processor((result) => {
                            if (result.ok === Result.ERROR) {
                                hasErrored = true;
                                throw result.error;
                            }

                            const nextStep = createStep(idx + 1);

                            if (isRunning) {
                                syncResult = nextStep;
                                calledSync = true;
                            } else {
                                trampoline(nextStep);
                            }
                        });
                    } catch (error) {
                        hasErrored = true;
                        throw error;
                    }

                    return calledSync ? syncResult : null;
                };
            };

            const trampoline = (step: TrampolineStep<any> | null) => {
                if (isRunning) return;
                isRunning = true;

                let currentStep = step;
                while (currentStep) {
                    try {
                        if (hasErrored) {
                            currentStep = null;
                            break;
                        }
                        currentStep = currentStep();
                    } catch (error) {
                        hasErrored = true;
                        currentStep = null;
                        queueMicrotask(() => done(Result.error(error)));
                        break;
                    }
                }

                isRunning = false;
            };

            trampoline(createStep(0));
        } catch (error: any) {
            done(Result.error(error));
        }
    }

    pipe(work: UnitOfWork) {
        this.unitsOfWork.push(work);
    }
}
