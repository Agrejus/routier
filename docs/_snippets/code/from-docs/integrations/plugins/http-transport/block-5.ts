app.post("/routier", requireUser, async (req, res) => {
  const scoped = new TenantStore(plugin, req.user.tenantId);
  const handle = createRequestHandler({ plugin, schemas: scoped.schemas });

  res.json(await handle(req.body));
});