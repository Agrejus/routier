import { describe, it } from '@jest/globals';
import { factories } from './testSchemas.test';

describe("Schema Generation", () => {

    describe("Product Schema", () => {

        it('should create schema', () => {

            for (let i = 0; i < factories.length; i++) {
                const factory = factories[i];
                expect(factory()).toBeDefined();
            }
        });

    });

});