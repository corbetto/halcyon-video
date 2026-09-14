/** Give the entrance model a short grace period before exposing its loading solids.
 * No minimum delay on warm loads; a missing model must never trap the visitor. */
export function waitForStartupModel(model: Promise<unknown> | undefined, timeoutMs = 4000): Promise<void> {
  if (!model) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(finish, timeoutMs);
    model.then(finish, finish);
  });
}
