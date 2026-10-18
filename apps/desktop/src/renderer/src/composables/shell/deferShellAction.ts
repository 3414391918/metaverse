/** Resolve forward assembly actions only when the action executes. */
export function deferShellAction<T extends (...args: never[]) => unknown>(
  resolve: () => T
): T {
  return ((...args: Parameters<T>) => resolve()(...args)) as T;
}
