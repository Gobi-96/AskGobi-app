import { GenerationQueue } from "./limits";
// Next can bundle routes separately. A process-global scheduler keeps every local
// inference endpoint within the same single-generation budget.
const runtime = globalThis as typeof globalThis & {
  __askgobiGeneration?: GenerationQueue;
};
export const generationQueue = (runtime.__askgobiGeneration ??=
  new GenerationQueue(1, 3));
