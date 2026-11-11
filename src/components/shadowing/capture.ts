"use client";

/** Browser speech-to-text behind a provider interface, so the engine can be swapped without touching UI or API. */

export type SpeechErrorCode = "not-allowed" | "audio-capture" | "network" | "unsupported" | "other";

export type SpeechSession = {
  stop(): Promise<{ text: string; segments: string[][] }>;
  abort(): void;
};

export interface SpeechRecognizerProvider {
  id: "web-speech";
  isSupported(): boolean;
  start(opts: { lang: string; onText?(text: string): void; onError?(code: SpeechErrorCode): void }): SpeechSession;
}

type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal: boolean };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FATAL: Record<string, SpeechErrorCode> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "audio-capture": "audio-capture",
  network: "network",
};
const STOP_TIMEOUT_MS = 3000;

export const webSpeechProvider: SpeechRecognizerProvider = {
  id: "web-speech",
  isSupported: () => recognitionCtor() !== null,
  start({ lang, onText, onError }) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      onError?.("unsupported");
      return { stop: async () => ({ text: "", segments: [] }), abort: () => undefined };
    }
    const committed: string[][] = [];
    let session: { finals: string[][]; interim: string } = { finals: [], interim: "" };
    let stopped = false;
    let fatal = false;
    let rec: Recognition;
    let resolveEnd: (() => void) | null = null;

    const all = () => [...committed, ...session.finals];
    const text = (segments: string[][]) =>
      segments
        .map((s) => s[0])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    const commit = () => {
      committed.push(...session.finals);
      if (session.interim.trim()) committed.push([session.interim.trim()]);
      session = { finals: [], interim: "" };
    };

    const open = () => {
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      rec.onresult = (e) => {
        const finals: string[][] = [];
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finals.push(Array.from(r, (a) => a.transcript.trim()).filter(Boolean));
          else interim += ` ${r[0]?.transcript ?? ""}`;
        }
        session = { finals: finals.filter((f) => f.length), interim: interim.trim() };
        onText?.(text([...all(), ...(session.interim ? [[session.interim]] : [])]));
      };
      rec.onerror = (e) => {
        const code = FATAL[e.error];
        if (!code) return;
        fatal = true;
        onError?.(code);
      };
      rec.onend = () => {
        commit();
        if (!stopped && !fatal) {
          // Chrome ends a session after a silence; keep listening until the learner stops.
          try {
            open();
            return;
          } catch {
            fatal = true;
          }
        }
        resolveEnd?.();
      };
      rec.start();
    };
    open();

    return {
      stop: () =>
        new Promise((resolve) => {
          stopped = true;
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            commit();
            resolve({ text: text(committed), segments: committed });
          };
          resolveEnd = finish;
          setTimeout(finish, STOP_TIMEOUT_MS);
          try {
            rec.stop();
          } catch {
            finish();
          }
        }),
      abort: () => {
        stopped = true;
        try {
          rec.abort();
        } catch {
          // already ended
        }
      },
    };
  },
};

export const speechProvider = webSpeechProvider;

export function captureSupported(): boolean {
  return (
    speechProvider.isSupported() &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

export type CaptureResult = { blob: Blob | null; mime: string; durationMs: number; text: string; segments: string[][] };
export type Capture = { stop(): Promise<CaptureResult>; abort(): void };

/** Records the microphone and runs speech recognition on it at the same time. */
export async function startCapture(opts: {
  maxSec: number;
  onText(text: string): void;
  onTick(ms: number): void;
  onLimit(): void;
  onError(code: SpeechErrorCode): void;
}): Promise<Capture> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    const name = (error as { name?: string }).name;
    throw new CaptureError(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "other");
  }
  const mime = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const recorderStopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start(250);
  const speech = speechProvider.start({ lang: "en-US", onText: opts.onText, onError: opts.onError });

  const startedAt = performance.now();
  let limited = false;
  const timer = setInterval(() => {
    const ms = performance.now() - startedAt;
    opts.onTick(ms);
    if (!limited && ms >= opts.maxSec * 1000) {
      limited = true;
      opts.onLimit();
    }
  }, 200);
  const release = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    async stop() {
      clearInterval(timer);
      const durationMs = Math.round(performance.now() - startedAt);
      if (recorder.state !== "inactive") recorder.stop();
      const [, heard] = await Promise.all([recorderStopped, speech.stop()]);
      release();
      const type = recorder.mimeType || mime || "audio/webm";
      return { blob: chunks.length ? new Blob(chunks, { type }) : null, mime: type, durationMs, ...heard };
    },
    abort() {
      speech.abort();
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

export class CaptureError extends Error {
  constructor(public code: SpeechErrorCode) {
    super(code);
  }
}

export const CAPTURE_MESSAGES: Record<SpeechErrorCode, string> = {
  "not-allowed": "Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi thử lại.",
  "audio-capture": "Không tìm thấy micro. Kiểm tra thiết bị ghi âm rồi thử lại.",
  network: "Nhận dạng giọng nói cần kết nối Internet. Kiểm tra mạng rồi thử lại.",
  unsupported: "Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Khuyên dùng Chrome, Edge hoặc Safari trên máy tính.",
  other: "Không ghi âm được. Hãy thử lại.",
};
