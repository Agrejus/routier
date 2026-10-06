import { type ComponentType, useEffect, useState } from 'react';
import { WireLog } from './components/WireLog';
import { useWireLog } from './hooks/useWireLog';
import { labApi } from './labApi';
import { ConflictPanel } from './panels/ConflictPanel';
import { NewestWinsPanel } from './panels/NewestWinsPanel';
import { OptimisticPanel } from './panels/OptimisticPanel';
import { SwrPanel } from './panels/SwrPanel';
import { type ScenarioId, scenarioFromHash, scenarios } from './scenarios';

const panels: Record<ScenarioId, ComponentType> = {
  conflict: ConflictPanel,
  swr: SwrPanel,
  newest: NewestWinsPanel,
  optimistic: OptimisticPanel,
};

export function App() {
  const [scenario, setScenario] = useState(() => scenarioFromHash(window.location.hash));
  const [generation, setGeneration] = useState(0);
  const [resetting, setResetting] = useState(false);
  const entries = useWireLog();
  const Panel = panels[scenario.id];

  useEffect(() => {
    const onHash = () => setScenario(scenarioFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const reset = async () => {
    setResetting(true);

    try {
      await labApi.reset();
      setGeneration(current => current + 1);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="shell">
      <header className="top">
        <h1>ETag lab</h1>
        <p>A note schema with <code>version: s.number().etag(etags.numeric)</code>, stored in SQLite. The server generates every version.</p>
        <button type="button" data-testid="reset" disabled={resetting} onClick={() => void reset()}>Reset data</button>
      </header>
      <nav className="tabs">
        {scenarios.map(item => (
          <a key={item.id} href={`#${item.id}`} data-testid={`tab-${item.id}`} className={item.id === scenario.id ? 'active' : ''}>{item.label}</a>
        ))}
      </nav>
      <main>
        <Panel key={`${scenario.id}-${generation}`} />
        <WireLog entries={entries} clients={scenario.clients} />
      </main>
    </div>
  );
}
