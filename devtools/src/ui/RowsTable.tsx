import type { JSX } from "preact";
import type { InspectedRow } from "@routier/datastore";
import { previewValue } from "../format/previewValue";
import { toneOf } from "../format/valueTone";
import { columnsOf } from "./columns";

interface RowsTableProps {
  rows: ReadonlyArray<InspectedRow>;
  keyOf: (row: InspectedRow) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

const ACTIVATION_KEYS = new Set(["Enter", " "]);

function selectOnKey(select: () => void) {
  return (event: JSX.TargetedKeyboardEvent<HTMLTableRowElement>) => {
    if (!ACTIVATION_KEYS.has(event.key)) return;
    event.preventDefault();
    select();
  };
}

export function RowsTable({ rows, keyOf, selectedKey, onSelect }: RowsTableProps) {
  const columns = columnsOf(rows);

  return (
    <div class="table-scroll">
      <table class="rows" role="grid" aria-label="Rows">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = keyOf(row);
            const select = () => onSelect(key);
            return (
              <tr key={key} class="row" aria-selected={key === selectedKey} tabIndex={0} onClick={select} onKeyDown={selectOnKey(select)}>
                {columns.map((column) => (
                  <td key={column} class={`tone-${toneOf(row[column])}`}>
                    {previewValue(row[column])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
