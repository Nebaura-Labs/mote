import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { gatewayRouter } from "./gateway";
import { clawdRouter } from "./clawd";
import { autoSetupClawdRouter } from "./auto-setup-clawd";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  gateway: gatewayRouter,
  clawd: clawdRouter,
  autoSetupClawd: autoSetupClawdRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
