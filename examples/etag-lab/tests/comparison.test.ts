import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareServed, describeOutcome } from '../src/comparison';

const local = [{ id: 'a', title: 'A', version: 2 }, { id: 'b', title: 'B', version: 2 }, { id: 'c', title: 'C', version: 2 }];

describe('compareServed', () => {
  it('judges each served row against the local copy', () => {
    const outcomes = compareServed([{ id: 'a', version: 1 }, { id: 'b', version: 2 }, { id: 'c', version: 3 }], local);

    assert.deepEqual(outcomes.map(outcome => outcome.verdict), ['kept-local', 'same', 'took-server']);
  });

  it('skips a served row the client did not hold', () => {
    assert.deepEqual(compareServed([{ id: 'z', version: 1 }], local), []);
  });

  it('finds nothing to compare when the server served nothing', () => {
    assert.deepEqual(compareServed([], local), []);
  });
});

describe('describeOutcome', () => {
  for (const [verdict, text] of [
    ['kept-local', 'a: server sent v1, kept the newer local v2'],
    ['took-server', 'a: server sent v1, replaced local v2'],
    ['same', 'a: both at v2'],
  ] as const) {
    it(`describes ${verdict}`, () => {
      assert.equal(describeOutcome({ id: 'a', served: 1, local: 2, verdict }), text);
    });
  }
});
