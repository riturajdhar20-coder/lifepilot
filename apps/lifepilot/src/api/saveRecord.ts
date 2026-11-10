import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { createTableClient } from 'zitejs/runtime';

const tableNames = ['Tasks', 'Bills', 'Documents', 'Appointments'] as const;
type TableName = typeof tableNames[number];
type Row = Record<string, unknown> & { id: string; owner?: string[] | string };
const clients = Object.fromEntries(tableNames.map(name => [name, createTableClient<Row>(name)])) as Record<TableName, ReturnType<typeof createTableClient<Row>>>;

const allowed: Record<TableName, string[]> = {
  Tasks: ['title', 'status', 'priority', 'dueDate', 'notes'],
  Bills: ['bill', 'amount', 'status', 'dueDate', 'category', 'notes'],
  Documents: ['document', 'category', 'expiryDate', 'reminderDate', 'notes'],
  Appointments: ['appointment', 'startsAt', 'location', 'notes'],
};
const schema = z.object({
  table: z.enum(tableNames),
  id: z.string().optional(),
  fields: z.record(z.unknown()),
});
export default createEndpoint({
  description: 'Creates, updates, or deletes only the signed-in user’s LifePilot records',
  authenticated: true,
  inputSchema: schema.extend({ action: z.enum(['save', 'delete']) }),
  outputSchema: z.object({ success: z.boolean(), id: z.string().optional() }),
  execute: async ({ input, context }) => {
    const owner = context.user.id;
    const client = clients[input.table];
    if (input.action === 'delete') {
      if (!input.id) throw new Error('Choose a record to delete.');
      const row = await client.findOne({ id: input.id, filters: { owner } });
      if (!row) throw new Error('Record not found.');
      await client.delete({ id: input.id });
      return { success: true, id: input.id };
    }
    const picked = Object.fromEntries(Object.entries(input.fields).filter(([k]) => allowed[input.table].includes(k)));
    const fields = { ...picked, owner: [owner] };
    if (input.id) {
      const row = await client.findOne({ id: input.id, filters: { owner } });
      if (!row) throw new Error('Record not found.');
      await client.update({ id: input.id, record: fields });
      return { success: true, id: input.id };
    }
    const created = await client.create({ record: fields });
    return { success: true, id: created.id };
  },
});
