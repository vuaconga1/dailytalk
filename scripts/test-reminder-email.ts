/**
 * One-off: inspect learner + optionally send a study reminder now.
 * Usage: npx tsx --env-file=.env scripts/test-reminder-email.ts [--send]
 */
import { prisma } from "../src/server/db";
import { runStudyReminderForUser } from "../src/server/jobs";
import { sendEmail, reminderEmailHtml, emailConfigured } from "../src/server/integrations/email";
import { minutesOf, vnDate, vnMinuteOfDay } from "../src/lib/time";
import { isCurrentProfile } from "../src/domain/profile";
import type { LearnerProfile } from "../src/domain/types";

const email = process.argv.find((a) => a.includes("@")) ?? "letrongtinnnn@gmail.com";
const doSend = process.argv.includes("--send");
const pingOnly = process.argv.includes("--ping");
const doFix = process.argv.includes("--fix");

async function main() {
  console.log("emailConfigured:", emailConfigured());
  console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
  console.log("target:", email);

  if (pingOnly) {
    const result = await sendEmail({
      to: email,
      subject: "WeWIN test · nhắc học",
      text: "Đây là email thử từ WeWIN Daily Speaking. Nếu nhận được là Resend đã OK.",
      html: reminderEmailHtml(
        "Đây là email thử từ WeWIN Daily Speaking. Nếu nhận được là Resend đã OK.",
        process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, "")}/today` : undefined,
      ),
    });
    console.log("ping:", result);
    return;
  }

  const u = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: true,
      isDemo: true,
      reminderChannels: true,
      packageName: true,
      plan: true,
      profile: true,
    },
  });
  if (!u) {
    console.log("NOT_FOUND: chưa có user với email này trong DB.");
    return;
  }

  if (doFix) {
    const m = vnMinuteOfDay();
    const study_time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const nextProfile = {
      ...((u.profile as object) ?? {}),
      study_time,
      reminders: true,
    };
    const updated = await prisma.user.update({
      where: { id: u.id },
      data: {
        reminderChannels: ["email"],
        packageName: u.packageName?.includes("email") ? u.packageName : "Gói email 30 ngày",
        profile: nextProfile,
      },
      select: { id: true, reminderChannels: true, packageName: true, profile: true },
    });
    console.log("fixed:", {
      reminderChannels: updated.reminderChannels,
      packageName: updated.packageName,
      study_time,
    });
    Object.assign(u, updated);
  }

  const profile = u.profile as LearnerProfile | null;
  const nowMin = vnMinuteOfDay();
  const studyMin = profile && isCurrentProfile(profile) ? minutesOf(profile.study_time) : null;
  console.log({
    id: u.id,
    name: u.name,
    status: u.status,
    role: u.role,
    isDemo: u.isDemo,
    packageName: u.packageName,
    reminderChannels: u.reminderChannels,
    hasPlan: Boolean(u.plan),
    study_time: profile && isCurrentProfile(profile) ? profile.study_time : null,
    reminders: profile && isCurrentProfile(profile) ? profile.reminders : null,
    vnNow: `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`,
    diffMin: studyMin == null ? null : nowMin - studyMin,
    today: vnDate(),
  });

  if (!doSend) {
    console.log("Chưa gửi. Thêm --send để chạy runStudyReminderForUser, hoặc --ping để gửi mail thử thuần Resend.");
    return;
  }

  const result = await runStudyReminderForUser(u.id);
  console.log("reminder:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
