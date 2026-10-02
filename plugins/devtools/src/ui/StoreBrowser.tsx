import { Component } from "preact";
import type { SchemaId } from "@routier/core/schema";
import type { StopWatching, StoreInspection } from "@routier/datastore";
import type { FrameScheduler } from "../live/frameScheduler";
import { loadingState } from "../live/liveState";
import { watchCount, type LiveCounts } from "../live/watchCount";
import { CollectionList } from "./CollectionList";
import { CollectionPanel } from "./CollectionPanel";
import { StateMessage } from "./StateMessage";

interface StoreBrowserProps {
  inspection: StoreInspection;
  scheduler: FrameScheduler;
}

interface StoreBrowserState {
  selectedId: SchemaId | null;
  counts: LiveCounts;
}

export class StoreBrowser extends Component<StoreBrowserProps, StoreBrowserState> {
  state: StoreBrowserState = { selectedId: null, counts: new Map() };
  private stopWatching: StopWatching = () => undefined;

  componentDidMount() {
    const { inspection, scheduler } = this.props;
    const stops = inspection.collections.map((collection) =>
      watchCount(collection, (count) =>
        scheduler.schedule(() =>
          this.setState((current) => ({ counts: new Map(current.counts).set(collection.schemaId, count) })),
        ),
      ),
    );
    this.stopWatching = () => {
      for (const stop of stops) stop();
    };
  }

  componentWillUnmount() {
    this.stopWatching();
  }

  render() {
    const { inspection, scheduler } = this.props;
    const { selectedId, counts } = this.state;

    if (inspection.collections.length === 0) {
      return <StateMessage>This store has no collections or views.</StateMessage>;
    }

    const selected = inspection.collections.find((collection) => collection.schemaId === selectedId);

    return (
      <div class="browser">
        <CollectionList
          collections={inspection.collections}
          counts={counts}
          selectedId={selectedId}
          onSelect={(schemaId) => this.setState({ selectedId: schemaId })}
        />
        {selected === undefined ? (
          <StateMessage>Select a collection or view to see its rows.</StateMessage>
        ) : (
          <CollectionPanel
            key={selected.schemaId}
            collection={selected}
            count={counts.get(selected.schemaId) ?? loadingState}
            scheduler={scheduler}
          />
        )}
      </div>
    );
  }
}
