import type { NotesClient } from '../hooks/useNotesClient';

type Props = { client: NotesClient; testId: string };

export function NoteTable({ client, testId }: Props) {
  if (client.rows.length === 0) {
    return <p className="empty" data-testid={`${testId}-empty`}>Nothing loaded yet.</p>;
  }

  return (
    <table className="notes" data-testid={`${testId}-notes`}>
      <tbody>
        {client.rows.map(row => (
          <tr key={row.id} data-testid={`${testId}-row-${row.id}`}>
            <td className="note-id">{row.id}</td>
            <td>
              <input aria-label={`${testId} ${row.id} title`} data-testid={`${testId}-title-${row.id}`} value={client.drafts[row.id] ?? row.title} onChange={event => client.setDraft(row.id, event.target.value)} />
            </td>
            <td><span className="version" data-testid={`${testId}-version-${row.id}`}>v{row.version}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
