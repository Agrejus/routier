import type { IDbPlugin } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import {
  agentSchema, articleSchema, auditSchema, customerSchema, noteSchema,
  timeEntrySchema, workOrderSchema,
} from './schemas';

export class RelayStore extends DataStore {
  audit = this.collection(auditSchema).readonly().create();
  customers = this.collection(customerSchema).diff().create();
  agents = this.collection(agentSchema).proxy().create();
  workOrders = this.collection(workOrderSchema)
    .fullTextSearch({ minTokenLength: 2 })
    .softDelete(x => x.deletedAt)
    .audit(auditSchema)
    .derive((changes, emit) => emit(changes.map(change => ({
      entityId: String(change.id ?? (change.entity as { id?: string }).id ?? 'pending'),
      operation: change.operation,
      summary: `${change.operation} ${(change.entity as { title?: string }).title ?? 'work order'}`,
      delta: JSON.stringify({ before: change.previous ?? null, after: change.delta ?? null }),
      at: change.at,
    }))))
    .proxy()
    .create();
  notes = this.collection(noteSchema).immutable().create();
  timeEntries = this.collection(timeEntrySchema).proxy().create();
  articles = this.collection(articleSchema).fullTextSearch().immutable().create();

  constructor(plugin: IDbPlugin) { super(plugin); }
}

export async function seedStore(store: RelayStore) {
  if (await store.customers.countAsync() > 0) return false;

  const customers = await store.customers.addAsync(
    { name: 'Northstar Medical', industry: 'Healthcare', health: 92, contactName: 'Maya Chen', contactEmail: 'maya@northstar.test', annualValue: 184000, createdAt: new Date('2025-02-02') },
    { name: 'Juniper & Finch', industry: 'Retail', health: 74, contactName: 'Owen Brooks', contactEmail: 'owen@juniper.test', annualValue: 96000, createdAt: new Date('2025-03-18') },
    { name: 'Atlas Foundry', industry: 'Manufacturing', health: 61, contactName: 'Priya Rao', contactEmail: 'priya@atlas.test', annualValue: 242000, createdAt: new Date('2024-11-09') },
    { name: 'Luma Cloud', industry: 'Technology', health: 88, contactName: 'Felix Hart', contactEmail: 'felix@luma.test', annualValue: 136000, createdAt: new Date('2025-05-24') },
    { name: 'Harbor House', industry: 'Hospitality', health: 47, contactName: 'Sara Kim', contactEmail: 'sara@harbor.test', annualValue: 78000, createdAt: new Date('2025-01-12') },
  );
  const agents = await store.agents.addAsync(
    { name: 'Alex Morgan', role: 'Dispatcher', initials: 'AM', available: true },
    { name: 'Nico Santos', role: 'Technician', initials: 'NS', available: true },
    { name: 'Iris Okafor', role: 'Technician', initials: 'IO', available: false },
    { name: 'Sam Rivera', role: 'Manager', initials: 'SR', available: true },
  );
  await store.saveChangesAsync();

  const now = new Date();
  const rows = [
    ['Replace pharmacy switch', 'Intermittent packet loss on the east wing pharmacy VLAN.', 'in_progress', 'urgent', 'Network', 0, 1, 5, ['network', 'onsite']],
    ['POS terminals dropping sessions', 'Registers disconnect after the latest payment software update.', 'scheduled', 'high', 'Software', 1, 2, 3, ['pos', 'release']],
    ['CNC controller backup', 'Create a verified backup and disaster recovery runbook.', 'backlog', 'medium', 'Hardware', 2, 1, 6, ['backup']],
    ['Investigate SSO latency', 'Login takes more than eight seconds for European employees.', 'blocked', 'high', 'Security', 3, 2, 4, ['sso', 'identity']],
    ['Guest Wi-Fi captive portal', 'Portal certificate expires this week and needs rotation.', 'scheduled', 'urgent', 'Network', 4, 1, 2, ['wifi', 'certificate']],
    ['Patch radiology workstations', 'Deploy approved security patch to twelve workstations.', 'done', 'high', 'Security', 0, 2, 8, ['patch', 'security']],
    ['Warehouse label printer', 'Printer is producing faded labels on line three.', 'in_progress', 'medium', 'Hardware', 2, 1, 2, ['printer']],
    ['Quarterly access review', 'Review privileged roles and remove stale contractor access.', 'backlog', 'low', 'Security', 3, 3, 7, ['audit']],
    ['Conference room display', 'HDMI matrix loses signal after waking from standby.', 'done', 'low', 'Facilities', 4, 2, 2, ['av']],
    ['Inventory export timeout', 'Large CSV exports time out after thirty seconds.', 'scheduled', 'medium', 'Software', 1, 2, 5, ['reporting']],
    ['Replace edge firewall', 'Stage and cut over the new HA firewall pair.', 'backlog', 'urgent', 'Network', 0, 1, 12, ['firewall', 'change']],
    ['Kitchen sensor calibration', 'Walk-in refrigerator sensor reports four degrees high.', 'blocked', 'high', 'Facilities', 4, 2, 3, ['iot', 'onsite']],
  ] as const;

  const workOrders = await store.workOrders.addAsync(...rows.map((r, i) => ({
    customerId: customers[r[5]].id,
    assigneeId: r[2] === 'backlog' ? null : agents[r[6]].id,
    title: r[0], description: r[1], status: r[2], priority: r[3], category: r[4],
    scheduledFor: r[2] === 'scheduled' ? new Date(now.getTime() + (i + 1) * 86400000) : null,
    createdAt: new Date(now.getTime() - (i + 2) * 86400000), updatedAt: now,
    estimateHours: r[7], tags: [...r[8]], deletedAt: null,
  })));
  await store.articles.addAsync(
    { title: 'Rotate a TLS certificate without downtime', body: 'Validate the chain, stage the certificate, reload the proxy, and verify every endpoint before removing the old certificate.', category: 'Runbook', published: true, helpful: 48, embedding: [0.9, 0.1, 0.2, 0.4], updatedAt: now },
    { title: 'Diagnosing intermittent packet loss', body: 'Start with interface counters. Compare errors, duplex, MTU, spanning tree changes, and packet captures on both sides of the link.', category: 'Troubleshooting', published: true, helpful: 83, embedding: [0.8, 0.2, 0.3, 0.1], updatedAt: now },
    { title: 'Emergency change policy', body: 'Urgent production changes require an incident link, peer review, a rollback plan, and review on the next business day.', category: 'Policy', published: true, helpful: 31, embedding: [0.1, 0.9, 0.2, 0.6], updatedAt: now },
    { title: 'Restore a managed switch backup', body: 'Confirm model and firmware, export the current state, load the approved backup, then validate management and production VLANs.', category: 'How-to', published: true, helpful: 57, embedding: [0.7, 0.1, 0.4, 0.2], updatedAt: now },
  );
  await store.notes.addAsync(
    { workOrderId: workOrders[0].id, authorId: agents[1].id, body: 'Packet capture shows bursts of CRC errors on uplink 3.', createdAt: now, kind: 'comment' },
    { workOrderId: workOrders[0].id, authorId: agents[0].id, body: 'Replacement optics are at the loading dock.', createdAt: now, kind: 'status' },
    { workOrderId: workOrders[3].id, authorId: agents[2].id, body: 'Waiting for identity provider logs from the customer.', createdAt: now, kind: 'comment' },
  );
  await store.timeEntries.addAsync(
    { workOrderId: workOrders[0].id, agentId: agents[1].id, minutes: 95, billable: true, note: 'Packet capture and switch diagnostics', loggedAt: now },
    { workOrderId: workOrders[5].id, agentId: agents[2].id, minutes: 310, billable: true, note: 'Patch deployment', loggedAt: now },
    { workOrderId: workOrders[8].id, agentId: agents[2].id, minutes: 70, billable: false, note: 'Display firmware reset', loggedAt: now },
  );
  await store.saveChangesAsync();
  return true;
}
