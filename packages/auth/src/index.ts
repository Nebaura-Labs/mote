import { expo } from "@better-auth/expo";
import { db } from "@mote/db";
import * as schema from "@mote/db/schema/auth";
import { env } from "@mote/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",

    schema: schema,
  }),
  trustedOrigins: [env.CORS_ORIGIN, "mybettertapp://", "exp://"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies(), expo()],
});
