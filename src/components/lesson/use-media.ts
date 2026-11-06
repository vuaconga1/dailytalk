"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MAX_RECORD_MS = 45_000;
const MAX_RECORD_BYTES = 3_800_000;
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

export type RecordingKind = "shadow" | "voice";

/** Playback, microphone recording and browser speech recognition, all stopped on unmount. */
export function useMedia() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioFinishRef = useRef<(() => void) | null>(null);
  const speechFinishRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const cancelStartRef = useRef(false);
  const [recording, setRecording] = useState<RecordingKind | null>(null);

  const stopSound = useCallback(() => {
    const finishAudio = audioFinishRef.current;
    audioFinishRef.current = null;
    finishAudio?.();

    audioRef.current?.pause();
    audioRef.current = null;

    const finishSpeech = speechFinishRef.current;
    speechFinishRef.current = null;
    finishSpeech?.();

    utteranceRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }, []);

  const stopAll = useCallback(() => {
    stopSound();
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(null);
  }, [stopSound]);

  useEffect(() => stopAll, [stopAll]);

  const speak = useCallback(
    (text: string, rate: number) => {
      stopSound();
      if (!("speechSynthesis" in window)) throw new Error("Thiết bị chưa hỗ trợ phát âm thanh.");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = rate;
      const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
      if (voice) utterance.voice = voice;
      speechSynthesis.speak(utterance);
    },
    [stopSound],
  );

  const playBlob = useCallback(
    async (blob: Blob, rate: number) => {
      stopSound();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      audioRef.current = audio;
      await audio.play();
    },
    [stopSound],
  );

  /** Plays a URL directly, so redirects to the R2 CDN need no CORS setup. */
  const playUrl = useCallback(
    async (url: string, rate: number) => {
      stopSound();
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audioRef.current = audio;
      await audio.play();
    },
    [stopSound],
  );

  /**
   * Plays audio with requestAnimationFrame tracking of currentTime and duration.
   * Resolves on ended, pause, or error.
   */
  const playTracked = useCallback(
    (
      url: string,
      rate: number,
      onTime: (currentTime: number, duration: number) => void,
    ): Promise<void> => {
      stopSound();
      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audio.defaultPlaybackRate = rate;
        audioRef.current = audio;

        let rafId: number | null = null;
        let settled = false;

        const cleanup = () => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          audio.removeEventListener("ended", onFinish);
          audio.removeEventListener("pause", onFinish);
          audio.removeEventListener("error", onFinish);
        };

        const finish = () => {
          if (settled) return;
          settled = true;
          if (audioFinishRef.current === finish) audioFinishRef.current = null;
          cleanup();
          resolve();
        };

        audioFinishRef.current = finish;

        const onFinish = () => finish();
        audio.addEventListener("ended", onFinish);
        audio.addEventListener("pause", onFinish);
        audio.addEventListener("error", onFinish);

        const loop = () => {
          if (settled) return;
          const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
          onTime(audio.currentTime, duration);
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        audio.play().catch(() => {
          finish();
        });
      });
    },
    [stopSound],
  );

  /**
   * Browser speech synthesis with boundary tracking.
   * Prefers localService voice for reliable onboundary events in Chromium.
   */
  const speakTracked = useCallback(
    (
      text: string,
      rate: number,
      callbacks?: {
        onStart?: () => void;
        onBoundary?: (charIndex: number) => void;
      },
    ): Promise<void> => {
      stopSound();
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return Promise.reject(new Error("Thiết bị chưa hỗ trợ phát âm thanh."));
      }
      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;
        utterance.lang = "en-US";
        utterance.rate = rate;

        const voices = speechSynthesis.getVoices();
        const enVoices = voices.filter((v) => v.lang.startsWith("en"));
        const localVoice = enVoices.find((v) => v.localService);
        const voice = localVoice ?? enVoices[0];
        if (voice) utterance.voice = voice;

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          utteranceRef.current = null;
          if (speechFinishRef.current === finish) speechFinishRef.current = null;
          resolve();
        };
        speechFinishRef.current = finish;

        utterance.onstart = () => {
          callbacks?.onStart?.();
        };

        utterance.onboundary = (e) => {
          if (e.name === "word" || !e.name) {
            callbacks?.onBoundary?.(e.charIndex);
          }
        };

        utterance.onend = finish;
        utterance.onerror = finish;

        speechSynthesis.speak(utterance);
      });
    },
    [stopSound],
  );

  /** Stops the current capture, including one still waiting for microphone permission. */
  const stopRecording = useCallback(() => {
    cancelStartRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  /** Starts a MediaRecorder capture; resolves the blob through `onDone` when stopped. */
  const startRecording = useCallback(
    async (kind: RecordingKind, onDone: (blob: Blob) => void, maxMs = MAX_RECORD_MS) => {
      if (recorderRef.current?.state === "recording") return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Ghi âm cần HTTPS hoặc localhost và trình duyệt hỗ trợ micro. Thử mở bằng Safari/Chrome ngoài Zalo.");
      }
      stopSound();
      cancelStartRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelStartRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = PREFERRED_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      let bytes = 0;
      const limit = setTimeout(() => recorder.state === "recording" && recorder.stop(), maxMs);
      const finish = () => {
        clearTimeout(limit);
        stream.getTracks().forEach((t) => t.stop());
        if (recorderRef.current === recorder) recorderRef.current = null;
        setRecording(null);
      };
      recorder.ondataavailable = (e) => {
        if (!e.data.size) return;
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > MAX_RECORD_BYTES && recorder.state === "recording") recorder.stop();
      };
      recorder.onerror = finish;
      recorder.onstop = () => {
        finish();
        onDone(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      setRecording(kind);
      recorder.start(1000);
    },
    [stopSound],
  );

  /** Toggles a MediaRecorder capture; resolves the blob through `onDone` when stopped. */
  const toggleRecording = useCallback(
    async (kind: RecordingKind, onDone: (blob: Blob) => void) => {
      if (recorderRef.current?.state === "recording") return stopRecording();
      await startRecording(kind, onDone);
    },
    [startRecording, stopRecording],
  );

  /** Browser speech-to-text (demo mode); streams interim text through `onText`. */
  const toggleRecognition = useCallback(
    (onText: (text: string) => void, onStatus: (status: string) => void, onEnd?: (text: string) => void) => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        return;
      }
      const SR = speechRecognition();
      if (!SR) throw new Error("Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome hoặc Edge.");
      stopSound();
      const recognizer = new SR();
      recognizer.lang = "en-US";
      recognizer.interimResults = true;
      let heard = "";
      recognizer.onresult = (e) => {
        const text = Array.from(e.results, (r) => r[0].transcript)
          .join(" ")
          .trim();
        if (text) {
          heard = text;
          onText(text);
        }
      };
      recognizer.onerror = (e) =>
        onStatus(e.error === "not-allowed" ? "Hãy cho phép truy cập micro rồi thử lại." : "Chưa nghe rõ. Hãy thử lại.");
      recognizer.onend = () => {
        recognizerRef.current = null;
        setRecording(null);
        if (onEnd) onEnd(heard);
        else if (heard) onStatus("Đã nhận dạng. Kiểm tra hoặc sửa, rồi bấm Gửi câu trả lời.");
      };
      recognizerRef.current = recognizer;
      setRecording("voice");
      onStatus("Đang nghe… hãy nói câu trả lời bằng tiếng Anh.");
      recognizer.start();
    },
    [stopSound],
  );

  return useMemo(
    () => ({
      recording,
      speak,
      playBlob,
      playUrl,
      playTracked,
      speakTracked,
      audioRef,
      stopSound,
      stopAll,
      startRecording,
      stopRecording,
      toggleRecording,
      toggleRecognition,
    }),
    [recording, speak, playBlob, playUrl, playTracked, speakTracked, stopSound, stopAll, startRecording, stopRecording, toggleRecording, toggleRecognition],
  );
}
