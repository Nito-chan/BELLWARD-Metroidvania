/** Namespaced, loud errors. Nothing in this project fails silently. */

/** Base class for all Bellward runtime errors, so they are greppable in consoles/logs. */
export class BellwardError extends Error {
  constructor(message: string) {
    super(`[BELLWARD] ${message}`);
    this.name = 'BellwardError';
  }
}

/** Thrown when a code path that is planned but not yet built is reached. */
export class NotImplementedError extends BellwardError {
  constructor(what: string) {
    super(`[NOT IMPLEMENTED] ${what}`);
    this.name = 'NotImplementedError';
  }
}

/** One-line description of anything thrown, for banners and debug state. */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? `${error.name}: ${error.message}` : error.name;
  }
  return String(error);
}
