export type LogEntry = { id: number; message: string; value?: string };

export type RunStatus = 'idle' | 'running' | 'done' | 'failed';

export function Output({ entries, status }: { entries: readonly LogEntry[]; status: RunStatus }) {
    return (
        <div className="output" aria-live="polite">
            {status === 'idle' && <p className="muted">Press Run (or Ctrl/⌘ + Enter) to execute this file in your browser.</p>}
            {entries.map(entry => (
                <div key={entry.id} className="log-entry">
                    <div className="log-message">{entry.message}</div>
                    {entry.value !== undefined && <pre>{entry.value}</pre>}
                </div>
            ))}
            {status === 'failed' && <p className="error">The code threw an error.</p>}
        </div>
    );
}
