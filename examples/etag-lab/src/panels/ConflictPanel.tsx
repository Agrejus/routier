import { ConflictColumn } from '../components/ConflictColumn';

export function ConflictPanel() {
  return (
    <section className="panel" data-testid="panel-conflict">
      <header>
        <h2>Two clients, one note</h2>
        <p>Both clients wrap <code>HttpTransportDbPlugin</code> in <code>ConcurrencyDbPlugin</code>. Each save carries the version the client read; SQLite updates the row only if that version is still current.</p>
        <ol>
          <li>Load both clients.</li>
          <li>Edit the same note in Alice and save. Its version goes up.</li>
          <li>Edit it in Bob and save. Bob read the old version, so the server refuses.</li>
          <li>Start Bob over, load, and save again.</li>
        </ol>
      </header>
      <div className="columns">
        <ConflictColumn name="alice" />
        <ConflictColumn name="bob" />
      </div>
    </section>
  );
}
