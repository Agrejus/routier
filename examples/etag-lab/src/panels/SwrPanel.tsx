import { useState } from 'react';
import { ActionButton } from '../components/ActionButton';
import { NoteTable } from '../components/NoteTable';
import { compareServed, describeOutcome } from '../comparison';
import { useSwrClient, type SwrRead } from '../hooks/useSwrClient';
import { labApi } from '../labApi';

const summarize = ({ entry, before }: SwrRead): string[] => {
  if (entry == null) {
    return ['No revalidation reached the server.'];
  }

  if (entry.status === 304) {
    return [`Sent If-None-Match ${entry.ifNoneMatch ?? ''}. The server answered 304 Not Modified, so the cached rows stand.`];
  }

  const changed = compareServed(entry.versions, before).filter(outcome => outcome.verdict !== 'same');
  return [`The server answered 200 with ETag ${entry.etag ?? ''}.`, ...changed.map(describeOutcome)];
};

export function SwrPanel() {
  const swr = useSwrClient('swr', true);
  const [summary, setSummary] = useState<string[]>([]);
  const report = (message: string) => setSummary([message]);

  const read = async () => setSummary(summarize(await swr.read()));

  const editOnServer = (id: string) => async () => {
    const note = await labApi.editOnServer(id);
    setSummary([`Another user changed ${note.id} to v${note.version}. Read again to revalidate.`]);
  };

  return (
    <section className="panel" data-testid="panel-swr">
      <header>
        <h2>Stale-while-revalidate with ETags</h2>
        <p><code>HttpSwrDbPlugin</code> answers from its local cache, then revalidates. It sends the last query <code>ETag</code> as <code>If-None-Match</code>; a <code>304</code> keeps the cache. Each row's version decides which copy is newer.</p>
        <ol>
          <li>Read twice. The second revalidation is a 304.</li>
          <li>Let another user edit a note, then read. The server answers 200 and the row moves to the new version.</li>
          <li>Edit a note here, have another user edit it too, then save. The server refuses the stale edit with 409, and the next read takes the server copy.</li>
        </ol>
      </header>
      <div className="actions">
        <ActionButton label="Read" testId="swr-read" onRun={read} onError={report} />
        <ActionButton label="Save & sync" testId="swr-save" onRun={swr.saveAndSync} onError={report} />
      </div>
      <NoteTable client={swr.client} testId="swr" />
      <div className="actions server-actions">
        {swr.client.rows.map(row => <ActionButton key={row.id} label={`Another user edits ${row.id}`} testId={`swr-server-edit-${row.id}`} onRun={editOnServer(row.id)} onError={report} />)}
      </div>
      <ul className="timeline" data-testid="swr-summary">{[...summary, ...swr.events].map(line => <li key={line}>{line}</li>)}</ul>
    </section>
  );
}
