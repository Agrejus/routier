import { describe, it } from '@jest/globals';
import { productsSchema } from './testSchemas.test';

describe("Schema Generation", () => {

    describe("Product Schema", () => {

        it('should create schema', () => {
            debugger;
            expect(productsSchema).toBeDefined();
        });

    });

});