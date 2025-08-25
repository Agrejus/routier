import { TestDataStore } from '../context';
import { IDbPlugin } from 'routier-core';
import { Expect, Fn } from '../types';

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

    constructor(name: string, run: () => Promise<void>) {
        this.name = name;
        this.run = run;
    }

    async execute() {
        await this.run();
    }
}

export abstract class TestSuiteBase {
    protected readonly plugin: IDbPlugin;
    protected readonly testingOptions: { expect: Expect, fn: Fn };

    constructor(plugin: IDbPlugin, testingOptions: { expect: Expect, fn: Fn }) {
        this.plugin = plugin;
        this.testingOptions = testingOptions;
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
        })
    }

    abstract getTestSuites(): TestSuite[];
}