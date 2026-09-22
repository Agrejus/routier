import type { JSX } from "preact";
import type { StoreEntry } from "../host/storeEntry";

interface StorePickerProps {
  stores: ReadonlyArray<StoreEntry>;
  selectedLabel: string;
  onSelect: (label: string) => void;
}

export function StorePicker({ stores, selectedLabel, onSelect }: StorePickerProps) {
  const change = (event: JSX.TargetedEvent<HTMLSelectElement>) => onSelect(event.currentTarget.value);

  return (
    <select class="store-picker" aria-label="Store" value={selectedLabel} onChange={change}>
      {stores.map((store) => (
        <option key={store.label} value={store.label}>
          {store.label}
        </option>
      ))}
    </select>
  );
}
