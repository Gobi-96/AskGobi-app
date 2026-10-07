import { progressApi } from "@/lib/server/progressApi";
export const dynamic = "force-dynamic";
export const GET = (req: Request) => progressApi(req, "progress");
export const POST = (req: Request) => progressApi(req, "progress");
