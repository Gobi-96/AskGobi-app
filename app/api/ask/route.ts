import { createAskHandler } from "@/lib/server/ask";
import { generationQueue } from "@/lib/server/generation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = createAskHandler({ queue: generationQueue });
