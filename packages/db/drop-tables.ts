import { db } from './src/index.ts';
import { sql } from 'drizzle-orm';

await db.execute(sql`DROP TABLE IF EXISTS chat_message CASCADE;`);
await db.execute(sql`DROP TABLE IF EXISTS clawd_connection CASCADE;`);

console.log('Tables dropped successfully');
process.exit(0);
