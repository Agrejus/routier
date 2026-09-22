import type { SchemaId } from "@routier/core/schema";
import type { InspectedCollection } from "@routier/datastore";
import { loadingState } from "../live/liveState";
import type { LiveCounts } from "../live/watchCount";
import { CountBadge } from "./CountBadge";

interface CollectionListProps {
  collections: ReadonlyArray<InspectedCollection>;
  counts: LiveCounts;
  selectedId: SchemaId | null;
  onSelect: (schemaId: SchemaId) => void;
}

interface CollectionSectionProps extends CollectionListProps {
  title: string;
}

function CollectionSection({ title, collections, counts, selectedId, onSelect }: CollectionSectionProps) {
  if (collections.length === 0) return null;

  return (
    <section class="collection-section" aria-label={title}>
      <h2 class="section-title">{title}</h2>
      <ul class="collection-items">
        {collections.map((collection) => (
          <li key={collection.schemaId}>
            <button
              type="button"
              class="collection-item"
              aria-pressed={collection.schemaId === selectedId}
              onClick={() => onSelect(collection.schemaId)}
            >
              <span class="collection-name">{collection.name}</span>
              {collection.kind === "view" && <span class="kind-badge">view</span>}
              <CountBadge count={counts.get(collection.schemaId) ?? loadingState} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CollectionList(props: CollectionListProps) {
  const { collections } = props;
  return (
    <nav class="collection-list" aria-label="Collections and views">
      <CollectionSection {...props} title="Collections" collections={collections.filter((c) => c.kind === "collection")} />
      <CollectionSection {...props} title="Views" collections={collections.filter((c) => c.kind === "view")} />
    </nav>
  );
}
