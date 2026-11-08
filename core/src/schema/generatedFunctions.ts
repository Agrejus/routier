import { hash } from "../utilities";

export type GeneratedFunctions = Readonly<Record<string, Function>>;

export type EmittedFunction = {
    readonly key: string;
    readonly parameters: readonly string[];
    readonly body: string;
};

export type FunctionRecorder = {
    readonly functions: Map<string, EmittedFunction>;
    readonly collections: Set<string>;
};

export type FunctionSource = {
    readonly eager: boolean;
    compile(parameters: readonly string[], body: string): Function;
};

declare global {
    var __routierFunctionRecorder: FunctionRecorder | undefined;
    var __routierGeneratedFunctions: Map<string, Function> | undefined;
}

const registry = (): Map<string, Function> => {
    globalThis.__routierGeneratedFunctions ??= new Map();

    return globalThis.__routierGeneratedFunctions;
};

const functionKey = (parameters: readonly string[], body: string): string =>
    String(hash(`${parameters.join(",")}\0${body}`));

const evaluate = (parameters: readonly string[], body: string): Function =>
    Function(...parameters, `"use strict";\n${body}`);

export const registerGeneratedFunctions = (functions: GeneratedFunctions): void => {
    const functionsByKey = registry();

    for (const [key, generated] of Object.entries(functions)) {
        functionsByKey.set(key, generated);
    }
};

const evaluateMissing = (collectionName: string, parameters: readonly string[], body: string): Function => {
    try {
        return evaluate(parameters, body);
    } catch (error) {
        if (error instanceof EvalError) {
            throw new Error(
                `The schema '${collectionName}' has no generated function. ` +
                'Run "npx @routier/cli generate", and import the generated file before your schemas.'
            );
        }

        throw error;
    }
};

const registeredFunctionSource = (collectionName: string): FunctionSource => ({
    eager: false,
    compile: (parameters, body) =>
        registry().get(functionKey(parameters, body)) ?? evaluateMissing(collectionName, parameters, body),
});

const recordingFunctionSource = (collectionName: string, recorder: FunctionRecorder): FunctionSource => ({
    eager: true,
    compile(parameters, body) {
        const key = functionKey(parameters, body);

        recorder.collections.add(collectionName);
        recorder.functions.set(key, { key, parameters, body });

        return evaluate(parameters, body);
    },
});

export const isRecordingFunctions = (): boolean => globalThis.__routierFunctionRecorder != null;

export const createFunctionSource = (collectionName: string): FunctionSource => {
    const recorder = globalThis.__routierFunctionRecorder;

    return recorder == null
        ? registeredFunctionSource(collectionName)
        : recordingFunctionSource(collectionName, recorder);
};
