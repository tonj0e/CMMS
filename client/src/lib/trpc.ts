import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/** Result types of every procedure, e.g. `RouterOutputs["staff"]["list"][number]`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
