import { describe, it, expect, vi } from 'vitest';
import { CommentsTestSuite, EventsTestSuite, ProductTestSuite } from 'routier-plugin-testing';
import { BrowserStoragePlugin } from './BrowserStoragePlugin';
import { uuidv4 } from 'routier-core';

const testSections = [
    new ProductTestSuite(new BrowserStoragePlugin(uuidv4(), window.localStorage), { expect: expect as any, fn: vi.fn, debugTestNames: ["DistinctAsync dates"] }),
    new EventsTestSuite(new BrowserStoragePlugin(uuidv4(), window.localStorage), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new BrowserStoragePlugin(uuidv4(), window.localStorage), { expect: expect as any, fn: vi.fn }),

    new ProductTestSuite(new BrowserStoragePlugin(uuidv4(), window.sessionStorage), { expect: expect as any, fn: vi.fn }),
    new EventsTestSuite(new BrowserStoragePlugin(uuidv4(), window.sessionStorage), { expect: expect as any, fn: vi.fn }),
    new CommentsTestSuite(new BrowserStoragePlugin(uuidv4(), window.sessionStorage), { expect: expect as any, fn: vi.fn }),
];

describe('Browser Storage Plugin Tests', () => {
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