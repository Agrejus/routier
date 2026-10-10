import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Example } from '../catalog';
import { createDrafts } from '../sandbox/drafts';
import { encodeShared } from '../sandbox/share';
import { hashFor } from '../sandbox/hashState';
import type { Compiler } from './CodeEditor';
import { Output } from './Output';
import { Preview } from './Preview';
import { useRunner } from './useRunner';

const CodeEditor = lazy(() => import('./CodeEditor'));

const drafts = createDrafts(window.localStorage);

const SOURCE = 'https://github.com/Agrejus/routier/tree/main/examples/playground/src/examples';

type Props = { example: Example; shared: string | null };

export function Workbench({ example, shared }: Props) {
    const [code, setCode] = useState(() => shared ?? drafts.load(example.id) ?? example.source);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const compiler = useRef<Compiler | null>(null);
    const { entries, status, rendered, runId, run } = useRunner(compiler);
    const edited = code !== example.source;

    const onReady = useCallback((ready: Compiler) => {
        compiler.current = ready;
        setReady(true);
    }, []);

    useEffect(() => {
        if (ready && example.kind === 'component') {
            void run();
        }
    }, [ready, example.kind, run]);

    const onChange = (next: string) => {
        setCode(next);

        if (next === example.source) {
            drafts.clear(example.id);
        } else {
            drafts.save(example.id, next);
        }
    };

    const reset = () => {
        drafts.clear(example.id);
        setCode(example.source);
        history.replaceState(null, '', hashFor(example.id, null));
    };

    const share = async () => {
        const url = `${location.origin}${location.pathname}${hashFor(example.id, await encodeShared(code))}`;
        history.replaceState(null, '', url);
        await navigator.clipboard.writeText(url).then(() => setNotice('Link copied'), () => setNotice('Copy this link from the address bar'));
    };

    return (
        <section className={example.wide ? 'workspace is-wide' : 'workspace'}>
            <div className="panel">
                <div className="panel-header">
                    <span className="file-name">{example.file}{edited ? ' • edited' : ''}</span>
                    <span className="toolbar">
                        {notice !== null && <span className="muted">{notice}</span>}
                        <button className="tool-button" onClick={share}>Share</button>
                        <button className="tool-button" onClick={reset} disabled={!edited}>Reset</button>
                        <a href={`${SOURCE}/${example.file}`} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
                    </span>
                </div>
                <Suspense fallback={<div className="editor"><p className="muted">Loading the editor…</p></div>}>
                    <CodeEditor key={example.id} file={example.file} code={code} onChange={onChange} onReady={onReady} onRun={run} />
                </Suspense>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <span>{example.kind === 'component' ? 'Live preview' : 'Output'}</span>
                    <button className="run-button" onClick={run} disabled={!ready || status === 'running'}>
                        {!ready ? 'Loading…' : status === 'running' ? 'Running…' : status === 'idle' ? '▶ Run' : '↻ Run again'}
                    </button>
                </div>
                {rendered !== null && <Preview Component={rendered} runId={runId} />}
                {(rendered === null || entries.length > 0) && <Output entries={entries} status={status} />}
            </div>
        </section>
    );
}
