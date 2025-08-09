import { TestDataStore } from '../context';
import { IDbPlugin } from 'routier-core';
import { TestingOptions } from '../types';

export type TestSuite = {
    name: string;
    testCases: Test[];
}

type Test = {
    name: string;
    execute: () => Promise<void>;
}

class TestCase implements Test {

    readonly name: string;
    private readonly run: () => Promise<void>;
    private readonly debugTestSet: Set<string>;

    constructor(name: string, run: () => Promise<void>, debugTestSet: Set<string>) {
        this.name = name;
        this.run = run;
        this.debugTestSet = debugTestSet;
    }

    async execute() {
        if (this.debugTestSet.has(this.name)) {
            console.log(`[ROUTIER] - Debugging Test.  Name: ${this.name}`)
            debugger;
        }

        await this.run();
    }
}

export abstract class TestSuiteBase {
    protected readonly plugin: IDbPlugin;
    protected readonly testingOptions: TestingOptions;
    protected readonly debugTestSet: Set<string>;

    constructor(plugin: IDbPlugin, testingOptions: TestingOptions) {
        this.plugin = plugin;
        this.testingOptions = testingOptions;
        this.debugTestSet = new Set<string>(testingOptions.debugTestNames)
    }

    createTestCase(name: string, testGenerator: (factory: () => TestDataStore) => () => Promise<void>): Test {
        const dataStores: TestDataStore[] = [];
        const factory = () => {

            const dataStore = new TestDataStore(this.plugin);
            dataStores.push(dataStore);
            return dataStore;

        }

        const test = testGenerator(factory);
        return new TestCase(name, async () => {

            await test();

            for (const dataStore of dataStores) {
                await dataStore.destroyAsync();
            }
        }, this.debugTestSet)
    }

    abstract getTestSuites(): TestSuite[];
}