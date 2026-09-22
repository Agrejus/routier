# 05: Production stripping

**Spec:** `specs/devtools.md`

**What to build:** devtools cost production users nothing unless the developer explicitly opts in, and devtools' own queries are identifiable so a later timing panel can hide them.

**Blocked by:** 01

**Status:** done

- [x] When `process.env.NODE_ENV === "production"`, the main entry's `mountRoutierDevtools` is a no-op and a production bundle does not contain the drawer
- [x] `@routier/devtools/production` always mounts the real drawer
- [x] `inspect()` remains available in production builds
- [x] Devtools queries carry a devtools label on the existing event `source`; if `source` cannot carry it without changing `IDbPlugin`, the label is deferred to the timing release and that decision is recorded in the spec
- [x] Tests cover the no-op in production mode, the production entry, and the label (or its recorded deferral)
