import { Component } from "preact";
import type { InspectedQuery, StopWatching } from "@routier/datastore";
import { attempt } from "../../errors/attempt";
import type { StoreEntry } from "../../host/storeEntry";
import type { FrameScheduler } from "../../live/frameScheduler";
import { StateMessage } from "../StateMessage";
import { QueryDetail } from "./QueryDetail";
import { QueryListItem } from "./QueryListItem";

export const MAX_RECORDED_QUERIES = 200;

export interface RecordedQuery {
  readonly store: string;
  readonly query: InspectedQuery;
}

interface QueriesPanelProps {
  stores: ReadonlyArray<StoreEntry>;
  scheduler: FrameScheduler;
}

interface QueriesPanelState {
  recorded: ReadonlyArray<RecordedQuery>;
  selected: RecordedQuery | null;
}

export class QueriesPanel extends Component<QueriesPanelProps, QueriesPanelState> {
  state: QueriesPanelState = { recorded: [], selected: null };
  private readonly watching = new Map<StoreEntry, StopWatching>();

  componentDidMount() {
    this.watchStores();
  }

  componentDidUpdate() {
    this.watchStores();
  }

  componentWillUnmount() {
    for (const stop of this.watching.values()) attempt(stop, "queries", () => undefined);
  }

  private watchStores() {
    const { stores } = this.props;
    for (const [entry, stop] of this.watching) {
      if (stores.includes(entry)) continue;
      attempt(stop, "queries", () => undefined);
      this.watching.delete(entry);
    }
    for (const entry of stores) {
      if (!this.watching.has(entry)) this.watching.set(entry, this.watch(entry));
    }
  }

  private watch(entry: StoreEntry): StopWatching {
    const record = (query: InspectedQuery) =>
      this.props.scheduler.schedule(() => {
        const next: RecordedQuery = { store: entry.label, query };
        this.setState((current) => ({ recorded: [next, ...current.recorded].slice(0, MAX_RECORDED_QUERIES) }));
      });
    return attempt(() => entry.inspection.watchQueries(record), "queries", () => () => undefined);
  }

  render() {
    const { recorded, selected } = this.state;

    return (
      <div class="queries">
        <div class="query-list-pane">
          <div class="query-list-header">
            <span class="recording">
              Recording · {recorded.length} {recorded.length === 1 ? "query" : "queries"}
            </span>
            <button
              type="button"
              class="pager-button"
              disabled={recorded.length === 0}
              onClick={() => this.setState({ recorded: [], selected: null })}
            >
              Clear
            </button>
          </div>
          {recorded.length === 0 ? (
            <StateMessage>Queries your app runs appear here while this tab is open. Change some data to see one.</StateMessage>
          ) : (
            <ul class="query-list" aria-label="Recorded queries">
              {recorded.map((item, index) => (
                <QueryListItem
                  key={index}
                  store={item.store}
                  query={item.query}
                  selected={item === selected}
                  onSelect={() => this.setState({ selected: item })}
                />
              ))}
            </ul>
          )}
        </div>
        {selected === null ? (
          <StateMessage>Select a query to see how it ran: what the database did, and what ran in memory.</StateMessage>
        ) : (
          <QueryDetail query={selected.query} />
        )}
      </div>
    );
  }
}
