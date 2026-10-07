import { progressApi } from "@/lib/server/progressApi";
export const POST = (req: Request) => progressApi(req, "claim");
