import type { ComponentChildren } from "preact";
import { MAX_DRAWER_HEIGHT_RATIO, MIN_DRAWER_HEIGHT } from "./drawerHeight";
import { CloseIcon } from "./icons";
import { RoutierLogo } from "./RoutierLogo";
import { useDrawerResize } from "./useDrawerResize";

interface DrawerProps {
  tabs: ComponentChildren;
  toolbar: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
}

export function Drawer({ tabs, toolbar, onClose, children }: DrawerProps) {
  const { height, drag, startDrag, dragTo, endDrag, resizeByKey } = useDrawerResize();

  return (
    <aside class="drawer" aria-label="Routier devtools" style={{ height: `${height}px` }}>
      {drag !== null && <div class="drag-overlay" onMouseMove={(event) => dragTo(drag, event)} onMouseUp={endDrag} />}
      <div
        class="resize-handle"
        role="separator"
        tabIndex={0}
        aria-label="Resize Routier devtools"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={MIN_DRAWER_HEIGHT}
        aria-valuemax={Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO)}
        onMouseDown={startDrag}
        onKeyDown={resizeByKey}
      />
      <header class="drawer-header">
        <div class="brand">
          <RoutierLogo size={22} />
          <span class="brand-name">Routier</span>
          <span class="brand-tag">Devtools</span>
        </div>
        {tabs}
        <div class="drawer-actions">
          {toolbar}
          <button
            type="button"
            class="icon-button"
            aria-expanded={true}
            aria-label="Close Routier devtools"
            title="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>
      <div class="drawer-body">{children}</div>
    </aside>
  );
}
