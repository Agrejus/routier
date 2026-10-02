export type ScenarioId = 'conflict' | 'swr' | 'newest' | 'optimistic';

export type Scenario = { id: ScenarioId; label: string; clients: string[] };

export const scenarios: Scenario[] = [
  { id: 'conflict', label: 'Conflict', clients: ['alice', 'bob'] },
  { id: 'swr', label: 'SWR + 304', clients: ['swr', 'server'] },
  { id: 'newest', label: 'Newest wins', clients: ['replica', 'server'] },
  { id: 'optimistic', label: 'Optimistic', clients: ['optimistic'] },
];

export const scenarioFromHash = (hash: string): Scenario => scenarios.find(scenario => `#${scenario.id}` === hash) ?? scenarios[0] ?? { id: 'conflict', label: 'Conflict', clients: [] };
