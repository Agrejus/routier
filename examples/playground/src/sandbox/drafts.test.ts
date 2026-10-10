import { describe, expect, it } from '@jest/globals';
import { createDrafts, type DraftStorage } from './drafts';

const memoryStorage = (): DraftStorage => {
    const values = new Map<string, string>();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    };
};

const throwingStorage: DraftStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
};

describe('drafts', () => {
    it('keeps an edited draft per example', () => {
        const drafts = createDrafts(memoryStorage());

        drafts.save('crud', 'edited crud');
        drafts.save('grid', 'edited grid');

        expect([drafts.load('crud'), drafts.load('grid')]).toEqual(['edited crud', 'edited grid']);
    });

    it('has no draft for an example that was never edited', () => {
        expect(createDrafts(memoryStorage()).load('crud')).toBeNull();
    });

    it('forgets a draft on reset', () => {
        const drafts = createDrafts(memoryStorage());
        drafts.save('crud', 'edited');

        drafts.clear('crud');

        expect(drafts.load('crud')).toBeNull();
    });

    it('works without storage when the browser blocks it', () => {
        const drafts = createDrafts(throwingStorage);

        expect(() => drafts.save('crud', 'x')).not.toThrow();
        expect(() => drafts.clear('crud')).not.toThrow();
        expect(drafts.load('crud')).toBeNull();
    });
});
