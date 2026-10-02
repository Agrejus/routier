import { useCallback } from 'react';
import { createConflictClient } from '../clients';
import { useNotesClient } from '../hooks/useNotesClient';
import { ActionButton } from './ActionButton';
import { NoteTable } from './NoteTable';

type Props = { name: 'alice' | 'bob' };

export function ConflictColumn({ name }: Props) {
  const create = useCallback(() => createConflictClient(name), [name]);
  const client = useNotesClient(create);
  const report = (message: string) => client.setMessage(message);

  const save = async () => {
    try {
      await client.save();
      report('Saved. The server checked each version and generated the next one.');
    } catch (error) {
      report(`Refused: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="client" data-testid={`client-${name}`}>
      <h3>{name === 'alice' ? 'Alice' : 'Bob'}</h3>
      <div className="actions">
        <ActionButton label="Load" testId={`${name}-load`} onRun={client.load} onError={report} />
        <ActionButton label="Save" testId={`${name}-save`} onRun={save} onError={report} />
        <ActionButton label="Start over" testId={`${name}-reload`} onRun={async () => client.replace()} onError={report} />
      </div>
      <NoteTable client={client} testId={name} />
      <p className="message" data-testid={`${name}-message`}>{client.message}</p>
    </div>
  );
}
