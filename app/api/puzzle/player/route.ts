import { signalApi } from "@/lib/server/signalApi";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (req: Request) => signalApi(req, "player");
export const DELETE = (req: Request) => signalApi(req, "player");
