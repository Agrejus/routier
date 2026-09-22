import type { StoreEntry } from "../host/storeEntry";
import type { FrameScheduler } from "../live/frameScheduler";
import { ErrorBoundary } from "./ErrorBoundary";
import { QueriesPanel } from "./queries/QueriesPanel";
import { StateMessage } from "./StateMessage";
import { StorePane } from "./StorePane";
import type { DrawerView } from "./ViewTabs";

interface DrawerContentProps {
  view: DrawerView;
  stores: ReadonlyArray<StoreEntry>;
  active: StoreEntry | undefined;
  scheduler: FrameScheduler;
}

export function DrawerContent({ view, stores, active, scheduler }: DrawerContentProps) {
  if (view === "queries") {
    return (
      <ErrorBoundary key="queries">
        <QueriesPanel stores={stores} scheduler={scheduler} />
      </ErrorBoundary>
    );
  }
  if (active === undefined) {
    return <StateMessage>No stores yet. Each store appears here once your app mounts it with mountRoutierDevtools(store).</StateMessage>;
  }
  return (
    <ErrorBoundary key={active.label}>
      <StorePane entry={active} scheduler={scheduler} />
    </ErrorBoundary>
  );
}
