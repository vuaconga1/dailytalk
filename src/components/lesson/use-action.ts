"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/client-api";

/** Runs an async click handler, keeps the button disabled while pending and reports failures. */
export function useAction(onError: (message: string) => void) {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (task: () => Promise<unknown>) => {
      setPending(true);
      try {
        await task();
      } catch (e) {
        onError(errorMessage(e));
      } finally {
        setPending(false);
      }
    },
    [onError],
  );
  return { pending, run };
}
