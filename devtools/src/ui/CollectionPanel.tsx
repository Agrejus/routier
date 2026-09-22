import { useState } from "preact/hooks";
import type { InspectedCollection } from "@routier/datastore";
import type { FrameScheduler } from "../live/frameScheduler";
import type { LiveState } from "../live/liveState";
import { PAGE_SIZE, useLivePage, type LivePage } from "../live/useLivePage";
import { PageContent } from "./PageContent";
import { Pager } from "./Pager";
import { lastPageStart } from "./paging";
import { RowDetail } from "./RowDetail";

interface CollectionPanelProps {
  collection: InspectedCollection;
  count: LiveState<number>;
  scheduler: FrameScheduler;
}

function selectedRow(page: LivePage, collection: InspectedCollection, key: string) {
  if (page.status !== "success") return undefined;
  return page.value.find((row) => collection.keyOf(row) === key) ?? null;
}

export function CollectionPanel({ collection, count, scheduler }: CollectionPanelProps) {
  const [skip, setSkip] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pageStart = count.status === "success" ? Math.min(skip, lastPageStart(count.value)) : skip;
  const page = useLivePage(collection, pageStart, scheduler);
  const pageIsFull = page.status === "success" && page.value.length === PAGE_SIZE;
  const detail = selectedKey === null ? undefined : selectedRow(page, collection, selectedKey);
  const changePage = (next: number) => {
    setSkip(next);
    setSelectedKey(null);
  };

  return (
    <section class="panel" aria-label={`${collection.name} rows`}>
      <header class="panel-header">
        <div class="panel-heading">
          <h2 class="panel-title">{collection.name}</h2>
          {collection.kind === "view" && <span class="kind-badge">view</span>}
        </div>
        <Pager skip={pageStart} count={count} pageIsFull={pageIsFull} onPage={changePage} />
      </header>
      <div class="panel-body">
        <PageContent page={page} skip={pageStart} keyOf={collection.keyOf} selectedKey={selectedKey} onSelect={setSelectedKey} />
        {detail !== undefined && <RowDetail row={detail} onClose={() => setSelectedKey(null)} />}
      </div>
    </section>
  );
}
