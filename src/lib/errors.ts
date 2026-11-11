/** User-facing failure with an HTTP status; the message is shown as-is. */
export class Problem extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Shown when an AI call fails and the session falls back to the scripted conversation. */
export const AI_UNAVAILABLE = "Tài khoản thử nghiệm không thể sử dụng tính năng này.";

/** Provider call failed or returned output that did not pass validation. */
export class AIError extends Error {}
