import { useCallback, useRef, useState, type ComponentType, type RefObject } from 'react';
import { entryOf, type Log } from '../sandbox/entry';
import { evaluate, loadModules, requiredModules } from '../sandbox/execute';
import { MODULES } from '../sandbox/modules';
import { format } from './format';
import type { LogEntry, RunStatus } from './Output';
import type { Compiler } from './CodeEditor';

export const useRunner = (compiler: RefObject<Compiler | null>) => {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<RunStatus>('idle');
    const [rendered, setRendered] = useState<ComponentType | null>(null);
    const runId = useRef(0);
    const nextEntry = useRef(0);

    const run = useCallback(async () => {
        const current = compiler.current;

        if (current === null) {
            return;
        }

        const id = ++runId.current;
        const log: Log = (message, value) => {
            if (runId.current === id) {
                setEntries(existing => [...existing, { id: nextEntry.current++, message, value: format(value) }]);
            }
        };

        setEntries([]);
        setRendered(null);
        setStatus('running');

        try {
            const js = await current.compile();
            const entry = entryOf(evaluate(js, await loadModules(requiredModules(js), MODULES)));

            if (entry.kind === 'script') {
                await entry.run(log);
            } else if (entry.kind === 'component') {
                setRendered(() => entry.Component);
            } else {
                throw new Error('Nothing to run. Export a run(log) function, or a React component.');
            }

            if (runId.current === id) {
                setStatus('done');
            }
        } catch (error) {
            log('Error', error instanceof Error ? error : String(error));

            if (runId.current === id) {
                setStatus('failed');
            }
        }
    }, [compiler]);

    return { entries, status, rendered, runId: runId.current, run };
};
