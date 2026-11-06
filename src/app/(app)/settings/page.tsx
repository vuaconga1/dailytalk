import { SettingsForm } from "@/components/settings/settings-form";
import { ZaloLinkCard } from "@/components/settings/zalo-link-card";
import { requirePlan } from "@/server/http/page-guards";
import { prisma } from "@/server/db";
import { oaFollowUrl, zaloConfigured } from "@/server/integrations/zalo";

export default async function SettingsPage() {
  const user = await requirePlan();
  const link = user.isDemo ? null : await prisma.zaloLink.findUnique({ where: { userId: user.id } });

  return (
    <section className="animate-fade-in mx-auto w-full max-w-[850px] pb-12">
      <div className="mb-8 border-b border-[#e2e8f4] pb-6">
        <div className="eyebrow flex items-center gap-2">
          <span className="size-2 rounded-full bg-gold" />
          DUY TRÌ MỘT NHỊP HỌC PHÙ HỢP
        </div>
        <h1 className="page-title mt-1">Giờ học & tài khoản.</h1>
        <p className="mt-2 text-base text-slate-600">
          Cài đặt khung giờ học cố định và bật thông báo nhắc nhở để giữ thói quen mỗi ngày.
        </p>
      </div>

      <div className="space-y-6">
        <SettingsForm
          name={user.name}
          email={user.isDemo ? "Tài khoản demo" : user.email}
          studyTime={user.profile.study_time}
          reminders={user.profile.reminders}
        />

        {!user.isDemo && (
          <ZaloLinkCard
            initial={{ configured: zaloConfigured(), oaUrl: oaFollowUrl(), linked: Boolean(link), followed: link?.followed ?? false }}
          />
        )}
      </div>
    </section>
  );
}
