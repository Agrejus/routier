import type { InspectedRow } from "@routier/datastore";
import { formatValue } from "../format/formatValue";
import { highlight } from "../format/highlight";
import { CloseIcon } from "./icons";
import { StateMessage } from "./StateMessage";

interface RowDetailProps {
  row: InspectedRow | null;
  onClose: () => void;
}

export function RowDetail({ row, onClose }: RowDetailProps) {
  return (
    <section class="row-detail" aria-label="Row detail">
      <header class="row-detail-header">
        <h3 class="row-detail-title">{row === null ? "Row removed" : "Row"}</h3>
        <button type="button" class="icon-button" aria-label="Close row detail" title="Close" onClick={onClose}>
          <CloseIcon size={14} />
        </button>
      </header>
      {row === null ? (
        <StateMessage>This row is no longer on this page. It was removed, or a change moved it to another page.</StateMessage>
      ) : (
        <pre class="row-value">
          {highlight(formatValue(row)).map((token, index) =>
            token.tone === "plain" ? token.text : <span key={index} class={`tone-${token.tone}`}>{token.text}</span>,
          )}
        </pre>
      )}
    </section>
  );
}
