import type { InspectedCollection, InspectedPageRequest, StoreInspection } from "@routier/datastore";
import type { InspectableStore } from "@routier/devtools";

export interface PageSubscription {
  readonly name: string;
  readonly skip: number;
  readonly take: number;
}

export interface InspectionSpy {
  readonly store: InspectableStore;
  activePages(): ReadonlyArray<PageSubscription>;
  activeCounts(): ReadonlyArray<string>;
  pageRequests(): ReadonlyArray<PageSubscription>;
  pageDeliveries(): number;
}

export function spyOnInspection(target: InspectableStore): InspectionSpy {
  const activePages = new Set<PageSubscription>();
  const activeCounts = new Set<{ readonly name: string }>();
  const pageRequests: PageSubscription[] = [];
  let pageDeliveries = 0;

  const wrap = (collection: InspectedCollection): InspectedCollection => ({
    ...collection,
    watchCount(onCount) {
      const entry = { name: collection.name };
      activeCounts.add(entry);
      const stop = collection.watchCount(onCount);
      return () => {
        activeCounts.delete(entry);
        stop();
      };
    },
    watchPage(page: InspectedPageRequest, onRows) {
      const entry = { name: collection.name, skip: page.skip, take: page.take };
      pageRequests.push(entry);
      activePages.add(entry);
      const stop = collection.watchPage(page, (result) => {
        pageDeliveries++;
        onRows(result);
      });
      return () => {
        activePages.delete(entry);
        stop();
      };
    },
  });

  const inspect = (): StoreInspection => {
    const inspection = target.inspect();
    return { ...inspection, collections: inspection.collections.map(wrap) };
  };

  return {
    store: { inspect },
    activePages: () => [...activePages],
    activeCounts: () => [...activeCounts].map((entry) => entry.name),
    pageRequests: () => pageRequests,
    pageDeliveries: () => pageDeliveries,
  };
}
