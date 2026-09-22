import type { InspectedRow } from "@routier/datastore";
import type { LivePage } from "../live/useLivePage";
import { RowsTable } from "./RowsTable";
import { StateMessage } from "./StateMessage";

interface PageContentProps {
  page: LivePage;
  skip: number;
  keyOf: (row: InspectedRow) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function PageContent({ page, skip, keyOf, selectedKey, onSelect }: PageContentProps) {
  if (page.status === "loading") return <StateMessage>Loading rows…</StateMessage>;
  if (page.status === "error") return <StateMessage tone="error">Could not load rows: {page.message}</StateMessage>;
  if (page.value.length === 0) {
    return <StateMessage>{skip === 0 ? "This collection is empty." : "No rows on this page."}</StateMessage>;
  }
  return <RowsTable rows={page.value} keyOf={keyOf} selectedKey={selectedKey} onSelect={onSelect} />;
}
