/** User-facing failure with an HTTP status; the message is shown as-is. */
export class Problem extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Provider call failed or returned output that did not pass validation. */
export class AIError extends Error {}
