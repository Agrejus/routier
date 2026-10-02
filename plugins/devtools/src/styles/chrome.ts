export const chromeStyles = `
.launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 1px solid var(--rd-border-strong);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, #1b2a44, var(--rd-bg) 70%);
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.45), 0 0 0 4px rgba(45, 212, 191, 0.12);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.5), 0 0 0 5px rgba(45, 212, 191, 0.22);
}

.launcher-badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid var(--rd-bg);
  border-radius: 50%;
  background: var(--rd-debug);
  color: #1c1204;
}

.drawer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  background: var(--rd-bg);
  border-top: 1px solid var(--rd-border-strong);
  box-shadow: 0 -12px 40px rgba(2, 6, 23, 0.5);
}

.drag-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  cursor: ns-resize;
}

.resize-handle {
  position: absolute;
  top: -5px;
  left: 0;
  right: 0;
  height: 10px;
  cursor: ns-resize;
}

.resize-handle::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 50%;
  width: 40px;
  height: 4px;
  margin-left: -20px;
  border-radius: 2px;
  background: var(--rd-border-strong);
  transition: background 120ms ease;
}

.resize-handle:hover::after,
.resize-handle:focus-visible::after {
  background: var(--rd-accent);
}

.resize-handle:focus-visible {
  outline: none;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 44px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--rd-border);
  background: var(--rd-panel);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.brand-tag {
  padding: 1px 8px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: #fcd34d;
  font-size: 11px;
  font-weight: 600;
}

.view-tabs {
  display: flex;
  gap: 2px;
  margin-right: auto;
  margin-left: 16px;
  padding: 3px;
  border: 1px solid var(--rd-border);
  border-radius: 8px;
  background: var(--rd-bg);
}

.view-tab {
  padding: 3px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--rd-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.view-tab:hover {
  color: var(--rd-text);
}

.view-tab[aria-selected="true"] {
  background: var(--rd-accent-soft);
  color: var(--rd-accent);
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--rd-muted);
  cursor: pointer;
}

.icon-button:hover {
  border-color: var(--rd-border);
  background: var(--rd-hover);
  color: var(--rd-text);
}

.store-summary {
  display: flex;
  align-items: center;
  max-width: 360px;
  height: 28px;
  overflow: hidden;
  border: 1px solid var(--rd-border-strong);
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.plugin-name {
  padding: 0 9px;
  line-height: 26px;
  background: var(--rd-accent-soft);
  color: var(--rd-accent);
  font-weight: 600;
}

.database-name {
  padding: 0 9px;
  overflow: hidden;
  color: var(--rd-muted);
  font-family: var(--rd-mono);
  font-size: 11.5px;
  text-overflow: ellipsis;
}

.store-picker {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--rd-border-strong);
  border-radius: 6px;
  background: var(--rd-raised);
  color: var(--rd-text);
  font: inherit;
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.drawer-body > .state-message {
  padding: 24px;
}
`;
