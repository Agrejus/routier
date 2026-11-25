import type { DescribedFilters, ExecutedQuery } from '@routier/core/plugins';

type Parameters = NonNullable<ExecutedQuery['parameters']>;

export type ViewKeyOptions = Pick<PouchDB.Query.Options<{}, {}>, 'key' | 'keys'>;

const withParameters = (described: DescribedFilters, before: Parameters = []) => {
    const parameters = [...before, ...described.parameters];

    return parameters.length > 0 ? { parameters } : {};
};

const viewKey = (options: ViewKeyOptions): { text: string; parameters: Parameters } => {
    if (options.keys != null) {
        return { text: `keys: [${options.keys.map(() => '?').join(', ')}], `, parameters: options.keys };
    }

    return 'key' in options ? { text: 'key: ?, ', parameters: [options.key] } : { text: '', parameters: [] };
};

const filteredRows = (described: DescribedFilters) =>
    described.text === '' ? '' : `\n  .then(({ rows }) => rows.map(row => row.doc).filter(doc => ${described.text}))`;

const noteWith = (note: string, described: DescribedFilters) => [note, ...described.notes].join('; ');

export const fullReadQuery = (): ExecutedQuery => ({
    text: 'db.allDocs({ include_docs: true })',
    language: 'pouchdb',
    note: 'a full database read, no index',
});

export const indexedViewQuery = (view: string, options: ViewKeyOptions, described: DescribedFilters): ExecutedQuery => {
    const key = viewKey(options);

    return {
        text: `db.query(${JSON.stringify(view)}, { ${key.text}include_docs: true })${filteredRows(described)}`,
        ...withParameters(described, key.parameters),
        language: 'pouchdb',
        note: noteWith('an indexed view query', described),
    };
};

export const remoteScanQuery = (described: DescribedFilters): ExecutedQuery => ({
    text: `db.allDocs({ include_docs: true })${filteredRows(described)}`,
    ...withParameters(described),
    language: 'pouchdb',
    note: noteWith('a full read of a remote database, filtered in JavaScript', described),
});

export const temporaryViewQuery = (described: DescribedFilters): ExecutedQuery => ({
    text: `db.query((doc, emit) => {\n  if (${described.text}) emit(doc._id, doc);\n})`,
    ...withParameters(described),
    language: 'pouchdb',
    note: noteWith('a temporary view: PouchDB runs the map function over every document', described),
});
