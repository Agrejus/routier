import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { run as runCrud } from './examples/crud';
import crudSource from './examples/crud.ts?raw';
import { run as runLiveQueries } from './examples/liveQueries';
import liveQueriesSource from './examples/liveQueries.ts?raw';
import { LiveGrid } from './examples/LiveGrid';
import liveGridSource from './examples/LiveGrid.tsx?raw';
import { TodoApp } from './examples/ReactTodos';
import reactTodosSource from './examples/ReactTodos.tsx?raw';
import { NotesApp } from './examples/PersistentNotes';
import persistentNotesSource from './examples/PersistentNotes.tsx?raw';

type Log = (message: string, value?: unknown) => void;
type LogEntry = { id: number; message: string; value?: string };

type Example = {
    id: string;
    title: string;
    summary: string;
    file: string;
    source: string;
    /** Show the preview full width above the code instead of beside it. */
    wide?: boolean;
} & ({ kind: 'script'; run: (log: Log) => Promise<void> } | { kind: 'component'; Component: ComponentType });

const EXAMPLES: Example[] = [
    {
        id: 'crud',
        title: 'Schemas & CRUD',
        summary: 'Define a schema, then add, query, update, and remove entities.',
        file: 'crud.ts',
        source: crudSource,
        kind: 'script',
        run: runCrud,
    },
    {
        id: 'live-queries',
        title: 'Live queries',
        summary: 'Subscribe to a query and watch the result update as data changes.',
        file: 'liveQueries.ts',
        source: liveQueriesSource,
        kind: 'script',
        run: runLiveQueries,
    },
    {
        id: 'grid',
        title: 'Live data grid',
        summary:
            'Search, sort, and page through products. The page is one live query, so turn on Simulate traffic and watch it refresh as rows change underneath it.',
        file: 'LiveGrid.tsx',
        source: liveGridSource,
        kind: 'component',
        Component: LiveGrid,
        wide: true,
    },
    {
        id: 'react',
        title: 'React + useQuery',
        summary: 'A todo list whose components re-render from live queries.',
        file: 'ReactTodos.tsx',
        source: reactTodosSource,
        kind: 'component',
        Component: TodoApp,
    },
    {
        id: 'persistence',
        title: 'IndexedDB persistence',
        summary: 'The same store API on the Dexie plugin. Reload the page and your notes are still there.',
        file: 'PersistentNotes.tsx',
        source: persistentNotesSource,
        kind: 'component',
        Component: NotesApp,
    },
];

// Local dev serves the playground at its own root, so docs links go to the published site.
const DOCS = import.meta.env.DEV ? 'https://routier.dev' : '';
const SOURCE = 'https://github.com/Agrejus/routier/tree/main/examples/playground/src/examples';

const exampleFromHash = () => EXAMPLES.find(example => `#${example.id}` === window.location.hash) ?? EXAMPLES[0];

function format(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function ScriptRunner({ example }: { example: Extract<Example, { kind: 'script' }> }) {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
    const nextId = useRef(0);

    const start = useCallback(async () => {
        setEntries([]);
        setStatus('running');

        const log: Log = (message, value) =>
            setEntries(current => [...current, { id: nextId.current++, message, value: format(value) }]);

        try {
            await example.run(log);
            setStatus('done');
        } catch (error) {
            log('Error', error);
            setStatus('failed');
        }
    }, [example]);

    return (
        <>
            <div className="panel-header">
                <span>Output</span>
                <button className="run-button" onClick={start} disabled={status === 'running'}>
                    {status === 'running' ? 'Running…' : status === 'idle' ? '▶ Run' : '↻ Run again'}
                </button>
            </div>
            <div className="output" aria-live="polite">
                {status === 'idle' && <p className="muted">Press Run to execute this file in your browser.</p>}
                {entries.map(entry => (
                    <div key={entry.id} className="log-entry">
                        <div className="log-message">{entry.message}</div>
                        {entry.value !== undefined && <pre>{entry.value}</pre>}
                    </div>
                ))}
                {status === 'failed' && <p className="error">The example threw an error.</p>}
            </div>
        </>
    );
}

function CodeView({ source }: { source: string }) {
    const lines = source.replace(/\n$/, '').split('\n');

    return (
        <pre className="code">
            <code>
                {lines.map((line, index) => (
                    <span key={index} className="code-line">
                        <span className="line-number">{index + 1}</span>
                        {line || ' '}
                        {'\n'}
                    </span>
                ))}
            </code>
        </pre>
    );
}

export function App() {
    const [selected, setSelected] = useState(exampleFromHash);

    useEffect(() => {
        const onHashChange = () => setSelected(exampleFromHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const select = (example: Example) => {
        history.replaceState(null, '', `#${example.id}`);
        setSelected(example);
    };

    return (
        <div className="app-shell">
            <header className="topbar">
                <a className="brand" href={`${DOCS}/`}>
                    <img src={`${import.meta.env.BASE_URL}routier.svg`} alt="" width={28} height={28} />
                    <span>Routier <strong>Playground</strong></span>
                </a>
                <nav className="topbar-links">
                    <a href={`${DOCS}/getting-started/playground`}>About</a>
                    <a href={`${DOCS}/getting-started/playground#run-it-locally`}>Run locally</a>
                    <a href={`${DOCS}/`}>Docs</a>
                </nav>
            </header>

            <main className="content">
                <section className="intro">
                    <h1>Try Routier in your browser</h1>
                    <p>
                        Every example runs right here on this page. There's nothing to install and no account to create. The code
                        shown with each example is the exact file being executed.
                    </p>
                </section>

                <div className="tabs" role="tablist">
                    {EXAMPLES.map(example => (
                        <button
                            key={example.id}
                            role="tab"
                            aria-selected={example.id === selected.id}
                            className={example.id === selected.id ? 'tab is-active' : 'tab'}
                            onClick={() => select(example)}
                        >
                            {example.title}
                        </button>
                    ))}
                </div>

                <p className="summary">{selected.summary}</p>

                <section className={selected.wide ? 'workspace is-wide' : 'workspace'}>
                    <div className="panel">
                        <div className="panel-header">
                            <span className="file-name">{selected.file}</span>
                            <a href={`${SOURCE}/${selected.file}`} target="_blank" rel="noopener noreferrer">
                                View on GitHub ↗
                            </a>
                        </div>
                        <CodeView source={selected.source} />
                    </div>

                    <div className="panel">
                        {selected.kind === 'script' ? (
                            <ScriptRunner key={selected.id} example={selected} />
                        ) : (
                            <>
                                <div className="panel-header">
                                    <span>Live preview</span>
                                </div>
                                <div className="preview">
                                    <selected.Component key={selected.id} />
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <section className="local" id="run-locally">
                    <h2>Run it on your machine</h2>
                    <p>Clone the repository and start the playground with Vite:</p>
                    <pre className="code">
                        <code>{`git clone https://github.com/Agrejus/routier.git
cd routier
npm ci
npm run build
cd docs
npm run playground:dev   # http://localhost:5220`}</code>
                    </pre>
                    <p>
                        Or copy any example file into your own project after{' '}
                        <code>npm install @routier/core @routier/datastore @routier/memory-plugin @routier/react</code>.
                    </p>
                </section>
            </main>
        </div>
    );
}
