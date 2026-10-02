export type DrawerView = "data" | "queries";

const VIEWS: ReadonlyArray<{ readonly view: DrawerView; readonly label: string }> = [
  { view: "data", label: "Data" },
  { view: "queries", label: "Queries" },
];

interface ViewTabsProps {
  view: DrawerView;
  onChange: (view: DrawerView) => void;
}

export function ViewTabs({ view, onChange }: ViewTabsProps) {
  return (
    <div class="view-tabs" role="tablist" aria-label="Devtools views">
      {VIEWS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          role="tab"
          class="view-tab"
          aria-selected={tab.view === view}
          onClick={() => onChange(tab.view)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
