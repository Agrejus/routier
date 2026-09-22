<template>
  <a class="announcement" href="/integrations/devtools/">
    <span class="tag">New</span>
    <span class="text">Introducing Routier Devtools</span>
    <span class="arrow" aria-hidden="true">→</span>
  </a>
</template>

<style scoped>
.announcement {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  margin-bottom: 20px;
  padding: 4px 14px 4px 4px;
  border: 1px solid var(--vp-c-brand-soft);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.announcement:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.tag {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: var(--vp-c-brand-1);
}
</style>
