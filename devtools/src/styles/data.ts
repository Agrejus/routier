export const dataStyles = `
.browser {
  display: grid;
  grid-template-columns: minmax(200px, 250px) 1fr;
  height: 100%;
  min-height: 0;
}

.browser > .state-message {
  align-self: center;
}

.collection-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 10px;
  overflow: auto;
  border-right: 1px solid var(--rd-border);
  background: var(--rd-panel);
}

.section-title {
  margin: 0 0 6px;
  padding: 0 8px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rd-faint);
}

.collection-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.collection-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.collection-item:hover {
  background: var(--rd-hover);
}

.collection-item[aria-pressed="true"] {
  background: var(--rd-accent-soft);
  box-shadow: inset 2px 0 0 var(--rd-accent);
}

.collection-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--rd-mono);
  font-size: 12.5px;
}

.kind-badge {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--rd-view-soft);
  color: var(--rd-view);
  font-size: 10.5px;
  font-weight: 600;
  line-height: 18px;
}

.count {
  min-width: 26px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--rd-raised);
  color: var(--rd-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-align: center;
}

.collection-item[aria-pressed="true"] .count {
  background: rgba(45, 212, 191, 0.2);
  color: var(--rd-accent);
}

.count.error {
  background: var(--rd-error-soft);
  color: var(--rd-error);
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--rd-border);
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.panel-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--rd-mono);
  font-size: 13.5px;
  font-weight: 600;
}

.pager {
  display: flex;
  align-items: center;
  gap: 6px;
}

.range {
  margin-right: 4px;
  color: var(--rd-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.pager-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--rd-border-strong);
  border-radius: 6px;
  background: var(--rd-raised);
  font-size: 12px;
  cursor: pointer;
}

.pager-button:hover:not(:disabled) {
  border-color: var(--rd-accent);
  color: var(--rd-accent);
}

.pager-button:disabled {
  opacity: 0.35;
  cursor: default;
}

.panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.panel-body > .state-message {
  padding: 20px 16px;
}

.table-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.rows {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: var(--rd-mono);
  font-size: 12px;
}

.rows th,
.rows td {
  max-width: 320px;
  padding: 6px 14px;
  overflow: hidden;
  border-bottom: 1px solid var(--rd-border);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rows th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--rd-panel);
  color: var(--rd-muted);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.row {
  cursor: pointer;
}

.row:nth-child(even) td {
  background: rgba(148, 163, 184, 0.03);
}

.row:hover td {
  background: var(--rd-hover);
}

.row:focus-visible {
  outline: none;
}

.row:focus-visible td {
  background: var(--rd-hover);
}

.row[aria-selected="true"] td {
  background: var(--rd-accent-soft);
}

.row[aria-selected="true"] td:first-child {
  box-shadow: inset 2px 0 0 var(--rd-accent);
}

.tone-string {
  color: var(--rd-string);
}

.tone-number {
  color: var(--rd-number);
}

.tone-boolean {
  color: var(--rd-boolean);
}

.tone-date {
  color: var(--rd-date);
}

.tone-empty {
  color: var(--rd-faint);
  font-style: italic;
}

.tone-key {
  color: #7dd3fc;
}

.tone-circular {
  color: var(--rd-error);
  font-style: italic;
}

.tone-complex {
  color: var(--rd-muted);
}

.row-detail {
  display: flex;
  flex: 0 0 min(440px, 42%);
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--rd-border);
  background: var(--rd-panel);
}

.row-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 14px;
  border-bottom: 1px solid var(--rd-border);
}

.row-detail-title {
  margin: 0;
  color: var(--rd-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.row-detail > .state-message {
  padding: 14px;
}

.row-value {
  flex: 1;
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  color: var(--rd-text);
  font-family: var(--rd-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

.state-message {
  margin: 0;
  color: var(--rd-muted);
}

.state-message.error {
  color: var(--rd-error);
}
`;
