import { TestSuiteBase } from './suites/base';
import { TestingOptions } from './types';

export * from './suites';
export * from './utils';

export const executeTests = <T extends TestSuiteBase>(options: TestingOptions, ...testSuites: T[]) => {

    for (const section of testSuites) {
        for (const suite of section.getTestSuites()) {
            if (!!options.debug?.suite && options.debug.suite != suite.name) {
                continue; // Skip
            }

            options.describe(suite.name, () => {

                for (const test of suite.testCases) {
                    if (!!options.debug?.name && options.debug.name != test.name) {
                        continue; // Skip
                    }

                    options.it(`${suite.name}:${test.name}`, async () => {

                        if (!!options.debug?.name) {
                            debugger;
                        }

                        await test.execute();
                    });
                }
            });
        }
    }

}