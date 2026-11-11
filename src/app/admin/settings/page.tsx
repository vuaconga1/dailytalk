import { ApiForm } from "@/components/admin/api-form";
import { aiConfig, API_KEY_SETTING, isDemo } from "@/server/ai/config";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/http/page-guards";

function mask(key: string) {
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export default async function SettingsPage() {
  await requireStaff("manageSettings");
  const saved = await prisma.appSetting.findUnique({ where: { key: API_KEY_SETTING } });
  const current = saved?.value || aiConfig.key;

  return (
    <section>
      <div className="eyebrow">ADMIN</div>
      <h1 className="page-title mb-6">Cấu hình AI.</h1>
      <article className="card max-w-[640px]">
        <h3 className="mb-1 text-lg font-bold">OpenAI API key</h3>
        <p className="mb-4 text-xs text-muted">
          Key mới được kiểm tra với OpenAI rồi áp dụng ngay, không cần khởi động lại.
          {isDemo && " Lưu ý: AI_MODE đang là demo nên app chưa gọi OpenAI."}
        </p>
        <div className="note mb-4 text-sm">
          Đang dùng:{" "}
          {current ? (
            <>
              <code>{mask(current)}</code> ({saved?.value ? `nhập ở trang này, ${saved.updatedAt.toLocaleString("vi-VN")}` : "từ .env"})
            </>
          ) : (
            "chưa có"
          )}
        </div>
        <ApiForm endpoint="/api/admin/settings" submitLabel="Lưu API key" successText="Đã cập nhật API key." resetOnSuccess>
          <div className="field">
            <label htmlFor="api_key">API key mới</label>
            <input id="api_key" name="api_key" type="password" required autoComplete="off" placeholder="sk-..." />
          </div>
        </ApiForm>
      </article>
    </section>
  );
}
