import type { WireEntry } from '../wire';

type Props = { entries: WireEntry[]; clients: string[] };

const statusClass = (status: number) => (status === 304 ? 'status-not-modified' : status >= 400 ? 'status-error' : 'status-ok');

export function WireLog({ entries, clients }: Props) {
  const shown = entries.filter(entry => clients.includes(entry.client)).slice(-12).reverse();

  return (
    <section className="wire" data-testid="wire-log">
      <h3>On the wire</h3>
      {shown.length === 0 ? <p className="empty">No requests yet.</p> : (
        <table>
          <thead><tr><th>#</th><th>Client</th><th>Request</th><th>If-None-Match</th><th>Status</th><th>ETag</th><th>Rows</th><th>Detail</th></tr></thead>
          <tbody>
            {shown.map(entry => (
              <tr key={entry.id} data-testid="wire-entry">
                <td>{entry.id}</td>
                <td>{entry.client}</td>
                <td>{entry.method} {entry.path}</td>
                <td className="mono">{entry.ifNoneMatch ?? '—'}</td>
                <td className={statusClass(entry.status)} data-testid="wire-status">{entry.status}</td>
                <td className="mono">{entry.etag ?? '—'}</td>
                <td className="mono">{entry.versions.map(version => `${version.id}@v${version.version}`).join(' ') || '—'}</td>
                <td>{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
