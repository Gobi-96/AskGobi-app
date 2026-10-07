type ActivityEvent = "activity_start" | "activity_complete";

// Creating a displayed visit is deliberately silent. Explicit selection starts
// it; answering an opening/shared card starts and completes it in that order.
export function activityVisit(emit: (event: ActivityEvent) => void) {
  let started = false;
  let completed = false;
  function start() {
    if (started) return;
    started = true;
    emit("activity_start");
  }
  return {
    start,
    complete() {
      if (completed) return false;
      start();
      completed = true;
      emit("activity_complete");
      return true;
    },
  };
}
