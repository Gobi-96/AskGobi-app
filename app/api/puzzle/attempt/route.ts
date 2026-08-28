import { signalApi } from "@/lib/server/signalApi";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (req: Request) => signalApi(req, "attempt");
