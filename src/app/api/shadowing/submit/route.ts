import { hasActiveAccess } from "@/domain/access";
import { MAX_ALTERNATIVES_CHARS, MAX_RECORDING_BYTES, STT_PROVIDERS, type SttProvider } from "@/domain/shadowing/types";
import { Problem } from "@/lib/errors";
import { authedRoute, json } from "@/server/http/api";
import { getPublishedExercise, sniffRecording, submitAttempt } from "@/server/shadowing/store";

export const maxDuration = 30;

const MAX_FORM_BYTES = MAX_RECORDING_BYTES + 200_000;

/** "Đọc cả bài": multipart form with the recognized text, recognizer alternatives and the recording. */
export const POST = authedRoute(async (req, user) => {
  if (!hasActiveAccess(user)) throw new Problem("Shadowing dành cho học viên đã kích hoạt tài khoản.", 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) throw new Problem("Bản ghi quá lớn (tối đa 4 MB).", 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new Problem("Dữ liệu gửi lên không hợp lệ.");
  }
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };

  const exercise = await getPublishedExercise(text("slug"));
  if (!exercise) throw new Problem("Không tìm thấy bài luyện.", 404);
  const sttProvider = text("sttProvider");
  if (!STT_PROVIDERS.includes(sttProvider as SttProvider)) throw new Problem("Bộ nhận dạng giọng nói không được hỗ trợ.");

  let alternatives: unknown = null;
  const rawAlternatives = text("alternatives");
  if (rawAlternatives && rawAlternatives.length <= MAX_ALTERNATIVES_CHARS) {
    try {
      alternatives = JSON.parse(rawAlternatives);
    } catch {
      alternatives = null;
    }
  }

  let recording: { bytes: Buffer; mime: string; ext: string } | null = null;
  const file = form.get("recording");
  if (file instanceof Blob && file.size > 0) {
    if (file.size > MAX_RECORDING_BYTES) throw new Problem("Bản ghi quá lớn (tối đa 4 MB).", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffRecording(bytes);
    if (!kind) throw new Problem("Định dạng bản ghi không được hỗ trợ.");
    recording = { bytes, ...kind };
  }

  const duration = Number(text("durationMs"));
  const result = await submitAttempt({
    user,
    exercise,
    recognizedText: text("recognizedText"),
    sttProvider,
    alternatives,
    recording,
    durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
  });
  return json(result);
});
