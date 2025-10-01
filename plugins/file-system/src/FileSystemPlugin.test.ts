import { describe, it, expect, vi } from '@jest/globals';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite } from 'routier-plugin-testing';
import { FileSystemPlugin } from './FileSystemPlugin';
import { uuidv4 } from '@routier/core';

const testSections = [
    new ProductTestSuite(new FileSystemPlugin(__dirname, uuidv4()), { expect: expect as any, fn: vi.fn }),
    new EventsTestSuite(new FileSystemPlugin(__dirname, uuidv4()), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new FileSystemPlugin(__dirname, uuidv4()), { expect: expect as any, fn: vi.fn }),
];

describe('Filesystem Plugin Tests', () => {
    for (const section of testSections) {
        for (const suite of section.getTestSuites()) {
            describe(suite.name, () => {
                for (const test of suite.testCases) {
                    it(test.name, async () => {
                        await test.execute();
                    });
                }
            });
        }
    }
});