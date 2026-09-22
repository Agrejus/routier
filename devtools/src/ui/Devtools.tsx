import { useState } from "preact/hooks";
import type { StoreEntry } from "../host/storeEntry";
import type { FrameScheduler } from "../live/frameScheduler";
import { Drawer } from "./Drawer";
import { DrawerContent } from "./DrawerContent";
import { StorePicker } from "./StorePicker";
import { StoreSummary } from "./StoreSummary";
import { ToggleButton } from "./ToggleButton";
import { ViewTabs, type DrawerView } from "./ViewTabs";

interface DevtoolsProps {
  stores: ReadonlyArray<StoreEntry>;
  scheduler: FrameScheduler;
}

export function Devtools({ stores, scheduler }: DevtoolsProps) {
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [view, setView] = useState<DrawerView>("data");
  const active: StoreEntry | undefined = stores.find((store) => store.label === selectedLabel) ?? stores[0];

  if (!open) return <ToggleButton onOpen={() => setOpen(true)} />;

  const toolbar = active !== undefined && (
    <>
      <StoreSummary plugin={active.inspection.plugin} />
      {stores.length > 1 && <StorePicker stores={stores} selectedLabel={active.label} onSelect={setSelectedLabel} />}
    </>
  );

  return (
    <Drawer tabs={<ViewTabs view={view} onChange={setView} />} toolbar={toolbar} onClose={() => setOpen(false)}>
      <DrawerContent view={view} stores={stores} active={active} scheduler={scheduler} />
    </Drawer>
  );
}
