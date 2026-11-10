import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { createTableClient } from 'zitejs/runtime';

const tableNames = ['Tasks', 'Bills', 'Documents', 'Appointments'] as const;
type Row = Record<string, unknown> & { id: string; owner?: string[] | string };
const clients = Object.fromEntries(tableNames.map(name => [name, createTableClient<Row>(name)])) as Record<string, ReturnType<typeof createTableClient<Row>>>;

export default createEndpoint({
  description: 'Lists LifePilot records belonging to the signed-in user',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    tasks: z.array(z.record(z.unknown())),
    bills: z.array(z.record(z.unknown())),
    documents: z.array(z.record(z.unknown())),
    appointments: z.array(z.record(z.unknown())),
  }),
  execute: async ({ context }) => {
    const owner = context.user.id;
    const [tasks, bills, documents, appointments] = await Promise.all(
      tableNames.map(name => clients[name].findAll({ filters: { owner }, limit: 2000 })),
    );
    return {
      tasks: tasks.records,
      bills: bills.records,
      documents: documents.records,
      appointments: appointments.records,
    };
  },
});
