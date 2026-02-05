import { headers } from 'next/headers';
import { appRouter } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/trpc';

export async function getCaller() {
  const ctx = await createTRPCContext({ headers: await headers() });
  return appRouter.createCaller(ctx);
}
