import { describe, it, expect } from '@jest/globals';
import { s } from '@routier/core/schema';
import { compiledSchemaToMysqlTable } from '../utils';

/**
 * MySQL is the only backend that reads `s.string({ maxLength })`.
 *
 * It matters here and nowhere else because a `VARCHAR` truncates past its width. Every string
 * column was `VARCHAR(255)`, so a body of text lost everything after 255 characters — MySQL
 * reports that as a warning, not an error, so the save succeeded and the data was gone.
 */

describe('mysql column lengths', () => {

    it('gives a declared string its declared width', () => {
        const schema = s.define('articles', {
            id: s.string().key(),
            body: s.string({ maxLength: 4000 }),
        }).compile();

        expect(compiledSchemaToMysqlTable(schema)).toContain('`body` VARCHAR(4000)');
    });

    it('falls back to 255 when nothing is declared', () => {
        const schema = s.define('articles', {
            id: s.string().key(),
            title: s.string(),
        }).compile();

        expect(compiledSchemaToMysqlTable(schema)).toContain('`title` VARCHAR(255)');
    });

    it('keeps the width through a modifier', () => {
        // The length lives on SchemaBase precisely so a modifier cannot drop it. A regression
        // here silently returns the column to 255 and truncates again.
        const schema = s.define('articles', {
            id: s.string().key(),
            body: s.string({ maxLength: 4000 }).optional(),
        }).compile();

        expect(compiledSchemaToMysqlTable(schema)).toContain('`body` VARCHAR(4000)');
    });

    it('leaves a string identity key at VARCHAR(36)', () => {
        // The identity branch emits its own column definition with a UUID default, and a UUID
        // is 36 characters. A declared length on the key does not widen it.
        const schema = s.define('articles', {
            id: s.string({ maxLength: 4000 }).key().identity(),
            title: s.string(),
        }).compile();

        expect(compiledSchemaToMysqlTable(schema)).toContain('`id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID())');
    });

    it('gives a declared composite key column its declared width', () => {
        // Not the identity branch, so this one does go through the type mapping. The search
        // index's key is exactly this shape — a caller-supplied string key with a declared
        // length — which is why it is pinned.
        const schema = s.define('search_index', {
            key: s.string({ maxLength: 255 }).key(),
            term: s.string({ maxLength: 64 }),
        }).compile();

        const table = compiledSchemaToMysqlTable(schema);

        expect(table).toContain('`key` VARCHAR(255)');
        expect(table).toContain('`term` VARCHAR(64)');
    });
});
