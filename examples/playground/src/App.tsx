import { useEffect, useState } from 'react';
import { EXAMPLES, type Example } from './catalog';
import { decodeShared } from './sandbox/share';
import { hashFor, parseHash } from './sandbox/hashState';
import { Workbench } from './workbench/Workbench';

const DOCS = import.meta.env.DEV ? 'https://routier.dev' : '';

type Opened = { example: Example; shared: string | null };

const exampleById = (id: string | null): Example => EXAMPLES.find(example => example.id === id) ?? EXAMPLES[0];

const openFromHash = async (): Promise<Opened> => {
    const { id, shared } = parseHash(window.location.hash);
    return { example: exampleById(id), shared: shared === null ? null : await decodeShared(shared) };
};

export function App() {
    const [opened, setOpened] = useState<Opened>({ example: exampleById(parseHash(window.location.hash).id), shared: null });
    const selected = opened.example;

    useEffect(() => {
        const open = () => void openFromHash().then(setOpened);
        open();
        window.addEventListener('hashchange', open);
        return () => window.removeEventListener('hashchange', open);
    }, []);

    const select = (example: Example) => {
        history.replaceState(null, '', hashFor(example.id, null));
        setOpened({ example, shared: null });
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
                        Every example runs right here on this page, and every one is editable: change the code, press Run, and
                        it compiles and runs in your browser against the real Routier plugins, including SQLite and PostgreSQL
                        compiled to WebAssembly. Edits are kept per example; Reset brings back the original, and Share puts your
                        code in a link.
                    </p>
                    <p>
                        Open the <strong>Routier</strong> button in the bottom-right corner to watch the example's data change and see how
                        each query ran, in <a href={`${DOCS}/integrations/devtools/`}>Routier devtools</a>.
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

                <Workbench key={`${selected.id}:${opened.shared ?? ''}`} example={selected} shared={opened.shared} />

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
