import { useEffect, useState } from 'react';
import { ActionButton } from '../components/ActionButton';
import { NoteTable } from '../components/NoteTable';
import { compareServed, describeOutcome } from '../comparison';
import { useSwrClient } from '../hooks/useSwrClient';
import { labApi } from '../labApi';

export function NewestWinsPanel() {
  const swr = useSwrClient('replica', false);
  const [lagging, setLagging] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const report = (message: string) => setSummary([message]);

  useEffect(() => {
    void labApi.state().then(state => setLagging(state.lagging)).catch(() => undefined);
  }, []);

  const read = async () => {
    const { entry, before } = await swr.read();
    const outcomes = entry == null ? [] : compareServed(entry.versions, before);
    setSummary(entry == null ? ['No revalidation reached the server.'] : [`Read from the ${entry.detail}.`, ...outcomes.map(describeOutcome)]);
  };

  const toggleReplica = async () => {
    const state = lagging ? await labApi.releaseReplica() : await labApi.freezeReplica();
    setLagging(state.lagging);
    setSummary([state.lagging ? 'The replica is frozen. Reads now see the rows as they are at this moment.' : 'The replica caught up. Reads see the primary again.']);
  };

  return (
    <section className="panel" data-testid="panel-newest">
      <header>
        <h2>The newest etag wins</h2>
        <p>Reads can come from a replica that lags behind. This client turns conditional revalidation off, so every read returns full rows and each row is compared by its etag. A row older than the local copy is ignored.</p>
        <ol>
          <li>Read, then freeze the replica.</li>
          <li>Edit a note and save. The primary saves it and the client takes the new version.</li>
          <li>Read. The replica still serves the old version, and the client keeps its newer copy.</li>
          <li>Release the replica and read again. Both agree.</li>
        </ol>
      </header>
      <div className="actions">
        <ActionButton label="Read" testId="replica-read" onRun={read} onError={report} />
        <ActionButton label={lagging ? 'Release replica' : 'Freeze replica'} testId="replica-toggle" onRun={toggleReplica} onError={report} />
        <ActionButton label="Save & sync" testId="replica-save" onRun={swr.saveAndSync} onError={report} />
      </div>
      <p className={lagging ? 'badge lagging' : 'badge'} data-testid="replica-state">{lagging ? 'Replica lagging' : 'Replica current'}</p>
      <NoteTable client={swr.client} testId="replica" />
      <ul className="timeline" data-testid="replica-summary">{[...summary, ...swr.events].map(line => <li key={line}>{line}</li>)}</ul>
    </section>
  );
}
