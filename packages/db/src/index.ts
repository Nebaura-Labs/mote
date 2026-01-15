import { env } from "@mote/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

export * from "./schema/index.ts";
export * from "./encryption.ts";

import * as schema from "./schema/index.ts";

export const db = drizzle(env.DATABASE_URL, { schema });
