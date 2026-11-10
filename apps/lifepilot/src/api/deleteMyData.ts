import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { createTableClient } from 'zitejs/runtime';

const tableNames = ['Tasks', 'Bills', 'Documents', 'Appointments', 'Preferences'] as const;
type Row = Record<string, unknown> & { id: string };
const clients = Object.fromEntries(tableNames.map(name => [name, createTableClient<Row>(name)])) as Record<string, ReturnType<typeof createTableClient<Row>>>;

export default createEndpoint({
  description: 'Permanently deletes the signed-in user’s LifePilot records',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ success: z.boolean(), deletedCount: z.number() }),
  execute: async ({ context }) => {
    const owner = context.user.id;
    let deletedCount = 0;
    for (const name of tableNames) {
      const client = clients[name];
      while (true) {
        const { records } = await client.findAll({ filters: { owner }, limit: 2000 });
        if (records.length === 0) break;
        await Promise.all(records.map(record => client.delete({ id: record.id })));
        deletedCount += records.length;
        if (records.length < 2000) break;
      }
    }
    return { success: true, deletedCount };
  },
});
