import { useState } from 'react';
import { ActionButton } from '../components/ActionButton';
import { NoteTable } from '../components/NoteTable';
import { createOptimisticClient } from '../clients';
import { waitUntil } from '../hooks/revalidate';
import { readNotes, useNotesClient } from '../hooks/useNotesClient';

export function OptimisticPanel() {
  const client = useNotesClient(createOptimisticClient);
  const [timeline, setTimeline] = useState<string[]>([]);
  const note = (line: string) => setTimeline(current => [...current, line]);

  const save = async () => {
    const before = new Map(client.rows.map(row => [row.id, row.version]));
    const edited = Object.keys(client.drafts);
    setTimeline([]);
    await client.save();
    edited.forEach(id => note(`${id}: acknowledged at once, still v${before.get(id) ?? '?'}`));

    const adopted = await waitUntil(async () => {
      const stored = await readNotes(client.store);
      return edited.every(id => (stored.find(row => row.id === id)?.version ?? 0) > (before.get(id) ?? 0));
    });

    await client.load();
    note(adopted ? 'The server wrote the change and generated a new version; the memory copy adopted it.' : 'The server has not answered yet.');
  };

  return (
    <section className="panel" data-testid="panel-optimistic">
      <header>
        <h2>Optimistic save, server etag</h2>
        <p><code>OptimisticUpdatesDbPlugin</code> answers from memory at once, then writes to the server. The server owns the version, so the memory copy takes the server's value when the write lands.</p>
        <ol>
          <li>Load, edit a title, and save.</li>
          <li>The save returns before the server answers, at the old version.</li>
          <li>A moment later the memory copy holds the version the server generated.</li>
        </ol>
      </header>
      <div className="actions">
        <ActionButton label="Load" testId="optimistic-load" onRun={client.load} onError={client.setMessage} />
        <ActionButton label="Save" testId="optimistic-save" onRun={save} onError={client.setMessage} />
      </div>
      <NoteTable client={client} testId="optimistic" />
      <ul className="timeline" data-testid="optimistic-timeline">{timeline.map(line => <li key={line}>{line}</li>)}</ul>
      <p className="message">{client.message}</p>
    </section>
  );
}
