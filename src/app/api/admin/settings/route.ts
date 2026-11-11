import OpenAI from "openai";
import { json, readJson, staffRoute } from "@/server/http/api";
import { API_KEY_SETTING, resetOpenaiKey } from "@/server/ai/config";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";

/** Saves the OpenAI API key after checking it with OpenAI; takes effect without a restart. */
export const POST = staffRoute("manageSettings", async (req) => {
  const body = await readJson(req);
  const key = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!/^sk-\S{20,}$/.test(key)) throw new Problem("API key không hợp lệ (phải bắt đầu bằng sk-).");
  try {
    await new OpenAI({ apiKey: key, timeout: 15_000, maxRetries: 0 }).models.list();
  } catch (error) {
    const status = (error as { status?: number }).status;
    throw new Problem(status === 401 ? "OpenAI từ chối API key này." : "Không kiểm tra được API key với OpenAI. Hãy thử lại.");
  }
  await prisma.appSetting.upsert({
    where: { key: API_KEY_SETTING },
    create: { key: API_KEY_SETTING, value: key },
    update: { value: key },
  });
  resetOpenaiKey();
  return json({ ok: true });
});
