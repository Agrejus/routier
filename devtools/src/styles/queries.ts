export const queryStyles = `
.queries {
  display: grid;
  grid-template-columns: minmax(340px, 44%) 1fr;
  height: 100%;
  min-height: 0;
}

.queries > .state-message {
  padding: 20px 16px;
}

.query-list-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--rd-border);
  background: var(--rd-panel);
}

.query-list-pane > .state-message {
  padding: 20px 16px;
}

.query-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 8px 14px;
  border-bottom: 1px solid var(--rd-border);
}

.recording {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rd-muted);
  font-size: 12px;
}

.recording::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.18);
}

.query-list {
  flex: 1;
  margin: 0;
  padding: 6px;
  overflow: auto;
  list-style: none;
}

.query-item {
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

.query-item:hover {
  background: var(--rd-hover);
}

.query-item[aria-pressed="true"] {
  background: var(--rd-accent-soft);
  box-shadow: inset 2px 0 0 var(--rd-accent);
}

.query-item.failed {
  box-shadow: inset 2px 0 0 var(--rd-error);
}

.query-time {
  color: var(--rd-faint);
  font-family: var(--rd-mono);
  font-size: 11px;
}

.query-target {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.query-store {
  overflow: hidden;
  color: var(--rd-faint);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.query-collection {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--rd-mono);
  font-size: 12.5px;
}

.live-badge,
.error-badge,
.pushdown-database,
.pushdown-memory {
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.live-badge {
  background: rgba(96, 165, 250, 0.15);
  color: #93c5fd;
}

.error-badge {
  background: var(--rd-error-soft);
  color: var(--rd-error);
}

.pushdown {
  display: flex;
  gap: 4px;
}

.pushdown-database {
  background: rgba(45, 212, 191, 0.14);
  color: var(--rd-accent);
}

.pushdown-memory {
  background: rgba(245, 158, 11, 0.14);
  color: #fcd34d;
}

.query-duration {
  min-width: 64px;
  color: var(--rd-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.query-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.query-detail-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--rd-border);
}

.query-detail-title {
  margin: 0;
  font-family: var(--rd-mono);
  font-size: 13.5px;
}

.query-detail-meta {
  color: var(--rd-muted);
  font-size: 12px;
}

.query-detail-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  overflow: auto;
}

.query-summary {
  margin: 0;
  color: var(--rd-text);
}

.step {
  border: 1px solid var(--rd-border);
  border-left-width: 3px;
  border-radius: 8px;
  background: var(--rd-panel);
}

.step-database {
  border-left-color: var(--rd-accent);
}

.step-memory {
  border-left-color: var(--rd-debug);
}

.step-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rd-border);
}

.step-number {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rd-muted);
}

.step-where {
  font-size: 12px;
  font-weight: 600;
}

.step-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 10px 12px 0;
  list-style: none;
}

.step-option {
  padding: 1px 8px;
  border: 1px solid var(--rd-border-strong);
  border-radius: 4px;
  font-family: var(--rd-mono);
  font-size: 11.5px;
}

.step-note {
  margin: 0;
  padding: 10px 12px;
  color: var(--rd-muted);
}

.statement {
  margin: 10px 12px;
}

.statement-text,
.statement-parameters {
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 6px;
  background: var(--rd-bg);
  font-family: var(--rd-mono);
  font-size: 12px;
  white-space: pre-wrap;
}

.statement-text {
  color: #7dd3fc;
}

.statement-parameters {
  margin-top: 6px;
  color: var(--rd-muted);
}
`;
