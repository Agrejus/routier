import { InferType, s } from '@routier/core/schema';

export const customerSchema = s.define('relay_customers', {
  id: s.string().key().identity(),
  name: s.string().searchable(),
  industry: s.string('Healthcare', 'Retail', 'Manufacturing', 'Technology', 'Hospitality'),
  health: s.number(),
  contactName: s.string(),
  contactEmail: s.string(),
  annualValue: s.number(),
  createdAt: s.date(),
}).compile();

export const agentSchema = s.define('relay_agents', {
  id: s.string().key().identity(),
  name: s.string(),
  role: s.string('Dispatcher', 'Technician', 'Manager'),
  initials: s.string(),
  available: s.boolean(),
}).compile();

export const workOrderSchema = s.define('relay_work_orders', {
  id: s.string().key().identity(),
  customerId: s.string().foreignKey(customerSchema, 'id'),
  // Nullable assignee; foreign-key metadata is exercised by the required relations below.
  assigneeId: s.string().nullable(),
  title: s.string().searchable(),
  description: s.string().searchable(),
  status: s.string('backlog', 'scheduled', 'in_progress', 'blocked', 'done'),
  priority: s.string('low', 'medium', 'high', 'urgent'),
  category: s.string('Network', 'Hardware', 'Software', 'Security', 'Facilities'),
  scheduledFor: s.date().nullable(),
  createdAt: s.date(),
  updatedAt: s.date(),
  estimateHours: s.number(),
  tags: s.array(s.string()),
  deletedAt: s.date().nullable(),
}).compile();

export const noteSchema = s.define('relay_notes', {
  id: s.string().key().identity(),
  workOrderId: s.string().foreignKey(workOrderSchema, 'id'),
  authorId: s.string().foreignKey(agentSchema, 'id'),
  body: s.string(),
  createdAt: s.date(),
  kind: s.string('comment', 'status', 'system'),
}).compile();

export const timeEntrySchema = s.define('relay_time_entries', {
  id: s.string().key().identity(),
  workOrderId: s.string().foreignKey(workOrderSchema, 'id'),
  agentId: s.string().foreignKey(agentSchema, 'id'),
  minutes: s.number(),
  billable: s.boolean(),
  note: s.string(),
  loggedAt: s.date(),
}).compile();

export const articleSchema = s.define('relay_articles', {
  id: s.string().key().identity(),
  title: s.string().searchable(),
  body: s.string().searchable(),
  category: s.string('Runbook', 'Troubleshooting', 'Policy', 'How-to'),
  published: s.boolean(),
  helpful: s.number(),
  embedding: s.vector(4),
  updatedAt: s.date(),
}).compile();

export const auditSchema = s.define('relay_audit', {
  id: s.string().key().identity(),
  entityId: s.string(),
  operation: s.string('add', 'update', 'remove'),
  summary: s.string(),
  delta: s.string(),
  at: s.date(),
}).compile();

export type Customer = InferType<typeof customerSchema>;
export type Agent = InferType<typeof agentSchema>;
export type WorkOrder = InferType<typeof workOrderSchema>;
export type Note = InferType<typeof noteSchema>;
export type TimeEntry = InferType<typeof timeEntrySchema>;
export type Article = InferType<typeof articleSchema>;
export type AuditRow = InferType<typeof auditSchema>;

export const allSchemas = [customerSchema, agentSchema, workOrderSchema, noteSchema, timeEntrySchema, articleSchema, auditSchema];
