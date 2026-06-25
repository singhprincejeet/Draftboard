import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "~/server/db";
import { auth } from "~/server/auth";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { env } = await getCloudflareContext<Env>();
  const db = getDb(env.DB);
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

// Middleware that checks if user is active (not deactivated)
// Used for mutations that create/modify content
const activeUserMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const user = await ctx.db.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { deactivated: true },
  });

  if (user?.deactivated) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has been deactivated",
    });
  }

  return next();
});

// Use this for mutations that create/modify content
export const activeUserProcedure = protectedProcedure.use(activeUserMiddleware);

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "ADMIN" && ctx.session.user.role !== "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});
