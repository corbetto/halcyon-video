/** Per-frame admission budget for initial instance matrices, excluding animation. */
export function placementBudget(now = () => performance.now(), limit = 96, milliseconds = 2): () => boolean {
  let deadline = 0;
  let count = 0;
  return () => {
    if (count >= limit) return false;
    const t = now();
    if (count === 0) deadline = t + milliseconds;
    else if (t >= deadline) return false;
    count++;
    return true;
  };
}
