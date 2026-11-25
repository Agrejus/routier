import { describe, expect, it } from '@jest/globals';
import { fullReadQuery, indexedViewQuery, remoteScanQuery, temporaryViewQuery } from './explainQuery';

const none = { text: '', parameters: [], notes: [] };
const amountOver = { text: 'doc.amount > ?', parameters: [15], notes: [] };
const unparsed = { text: '(x => f(x))(doc)', parameters: [], notes: ['a filter could not be parsed (f), so it ran as JavaScript'] };

describe('fullReadQuery', () => {
    it('is allDocs', () => {
        expect(fullReadQuery()).toEqual({ text: 'db.allDocs({ include_docs: true })', language: 'pouchdb', note: 'a full database read, no index' });
    });
});

describe('indexedViewQuery', () => {
    it('keys the view by one value, and filters the rows it returns', () => {
        expect(indexedViewQuery('idx/status', { key: 'paid' }, amountOver)).toEqual({
            text: 'db.query("idx/status", { key: ?, include_docs: true })\n  .then(({ rows }) => rows.map(row => row.doc).filter(doc => doc.amount > ?))',
            parameters: ['paid', 15],
            language: 'pouchdb',
            note: 'an indexed view query',
        });
    });

    it('keys the view by several values', () => {
        expect(indexedViewQuery('idx/both', { keys: ['a', 'b'] }, none)).toEqual({
            text: 'db.query("idx/both", { keys: [?, ?], include_docs: true })',
            parameters: ['a', 'b'],
            language: 'pouchdb',
            note: 'an indexed view query',
        });
    });

    it('reads the whole view, with no parameters, when it has no key', () => {
        expect(indexedViewQuery('idx/status', {}, none)).toStrictEqual({
            text: 'db.query("idx/status", { include_docs: true })',
            language: 'pouchdb',
            note: 'an indexed view query',
        });
    });
});

describe('remoteScanQuery', () => {
    it('reads every document and filters them in JavaScript', () => {
        expect(remoteScanQuery(amountOver)).toEqual({
            text: 'db.allDocs({ include_docs: true })\n  .then(({ rows }) => rows.map(row => row.doc).filter(doc => doc.amount > ?))',
            parameters: [15],
            language: 'pouchdb',
            note: 'a full read of a remote database, filtered in JavaScript',
        });
    });

    it('adds why a filter is shown as a call', () => {
        expect(remoteScanQuery(unparsed).note).toBe('a full read of a remote database, filtered in JavaScript; a filter could not be parsed (f), so it ran as JavaScript');
    });
});

describe('temporaryViewQuery', () => {
    it('is a map function that emits the documents the filter keeps', () => {
        expect(temporaryViewQuery(amountOver)).toEqual({
            text: 'db.query((doc, emit) => {\n  if (doc.amount > ?) emit(doc._id, doc);\n})',
            parameters: [15],
            language: 'pouchdb',
            note: 'a temporary view: PouchDB runs the map function over every document',
        });
    });

    it('has no parameters when the filter has none', () => {
        expect(temporaryViewQuery(unparsed)).not.toHaveProperty('parameters');
    });
});
