/**
 * Seed a completed 30-day learner account: finish@gmail.com / 123
 */
import bcrypt from "bcryptjs";
import { classify } from "../src/domain/classify";
import { LESSONS } from "../src/domain/content";
import { buildPlan, renderLesson } from "../src/domain/curriculum";
import { framesUsed } from "../src/domain/frames";
import type { ProfileInput } from "../src/domain/profile";
import { prisma } from "../src/server/db";
import { shiftDays, vnDate } from "../src/lib/time";
import type { LearnerProfile, LevelSignal, StudyPlan, Summary, Turn, Lesson } from "../src/domain/types";

const EMAIL = "finish@gmail.com";
const PASSWORD = "123";
const NAME = "Nguyễn Hoàn Thành";

const INPUT: ProfileInput = {
  industry: "sales",
  industry_other: "",
  position: "nhan_vien_kinh_doanh",
  position_other: "",
  audiences: ["customers", "partners", "managers"],
  goals: ["meetings", "phone", "presentation"],
  self_level: "elementary",
  frequency: "weekly",
  study_time: "20:30",
  timezone: "Asia/Ho_Chi_Minh",
  reminders: true,
};

const classification = classify(INPUT);
const PROFILE: LearnerProfile = {
  ...INPUT,
  classification,
  working_level: "intermediate", // Advanced to intermediate after 30 days of progress
};

const PLAN: StudyPlan = buildPlan(PROFILE);

function eveningOf(date: string, minute: number): Date {
  return new Date(`${date}T20:${String(30 + minute).padStart(2, "0")}:00+07:00`);
}

async function run() {
  console.log(`Starting seed for ${EMAIL}...`);
  const today = vnDate(); // e.g. 2026-11-13
  const totalDays = 30;

  // Day 30 is today, Day 1 was 29 days ago
  const dates = Array.from({ length: totalDays }, (_, i) => shiftDays(today, -(totalDays - 1 - i)));

  // Clean up any existing user with this email
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const activatedAt = new Date(`${dates[0]}T08:00:00+07:00`);
  // lockAt set to 3 days in the future so user can log in and see the completion banner
  const lockAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const accessEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: NAME,
      passwordHash,
      profile: PROFILE,
      plan: PLAN,
      planSource: "curriculum",
      role: "LEARNER",
      status: "ACTIVE",
      packageName: "Khóa học 30 ngày Phản xạ Tiếng Anh WeWIN",
      activatedAt,
      accessEndsAt,
      lockAt,
    },
  });

  console.log(`Created user ${user.id} (${EMAIL})`);

  for (let i = 0; i < totalDays; i++) {
    const day = i + 1;
    const planDay = PLAN.days[i];
    const date = dates[i];
    const started = eveningOf(date, (i % 5) * 2);

    let lesson: Lesson | null = planDay?.ref
      ? renderLesson(planDay.ref, PROFILE, PROFILE.working_level ?? "elementary")
      : null;
    if (!lesson) {
      lesson = LESSONS.L11;
    }

    // Build dialogue turns from lesson dialogue
    const turns: Turn[] = lesson.dialogue.map((line, idx) => {
      if (idx % 2 === 0) {
        return { role: "assistant", text: line };
      } else {
        return { role: "user", text: line, input_mode: "voice" };
      }
    });

    const userTurns = turns.filter((t) => t.role === "user");
    const used = framesUsed(
      lesson.frames,
      userTurns.map((t) => t.text)
    );

    const isDay30 = day === 30;
    const isNeedsReview = day === 3 || day === 17; // 2 days with minor notes to make progress realistic (93% rate)

    let summary: Summary;
    if (isDay30) {
      summary = {
        overview:
          "Chúc mừng bạn đã xuất sắc hoàn thành trọn vẹn 30 ngày lộ trình Phản xạ Tiếng Anh Công sở! Trong buổi tổng kết này, bạn đã thể hiện phong thái tự tin, phản xạ tiếng Anh tự nhiên không cần dịch, và vận dụng trôi chảy các cấu trúc thuyết trình chuyên nghiệp.",
        strengths: [
          "Phát âm rõ ràng, ngữ điệu tự nhiên và kết nối ý mạch lạc trong toàn bộ bài nói.",
          "Vận dụng chính xác 100% mẫu câu trọng tâm và từ vựng chuyên ngành kinh doanh.",
          "Phản xạ giọng nói 100% không ngập ngừng, thời gian phản hồi dưới 2 giây.",
        ],
        improvements: [
          "Duy trì thói quen luyện Shadowing 15 phút mỗi ngày với các video trên ứng dụng.",
          "Thử thách bản thân với các chủ đề đàm phán hợp đồng phức tạp và thuyết trình trước đám đông.",
        ],
        next_step:
          "Hoàn thành xuất sắc lộ trình 30 ngày! Hãy truy cập mục Nhật ký để xem báo cáo tiến độ toàn khóa và nhận chứng nhận hoàn thành.",
        goal_status: "achieved",
        evidence: userTurns.slice(0, 3).map((t) => t.text),
        errors: [],
        review_items: ["Tự tin thuyết trình 1 phút về dự án", "Báo cáo kết quả công việc với ban lãnh đạo"],
        mode: "openai",
        frames_used: lesson.frames,
        turn_count: userTurns.length,
        voice_turns: userTurns.length,
        pronunciation_note: "Ngữ điệu và trọng âm câu rất chuẩn xác.",
        level_signal: "above",
      };
    } else {
      summary = {
        overview: `Buổi ${day}: Hoàn thành tốt mục tiêu "${planDay.focus}". Phản xạ nhanh, phát âm rõ và sử dụng đúng cấu trúc trong tình huống công việc.`,
        strengths: [
          `Áp dụng tự nhiên mẫu câu "${lesson.frames[0] ?? "cấu trúc trọng tâm"}"`,
          "Trả lời đúng trọng tâm câu hỏi của Coach",
          "Tốc độ nói ổn định, phát âm các từ khóa rõ ràng",
        ],
        improvements: isNeedsReview
          ? ["Chú ý phát âm âm đuôi (ending sounds) ở các động từ quá khứ", "Nối âm tự nhiên hơn ở các cụm từ thông dụng"]
          : ["Thử kéo dài câu trả lời bằng cách thêm lý do (because) hoặc ví dụ thực tế"],
        next_step: `Xem lại các từ vựng của buổi ${day} trước khi chuyển sang bài tiếp theo.`,
        goal_status: isNeedsReview ? "needs_review" : "achieved",
        evidence: userTurns.slice(0, 2).map((t) => t.text),
        errors: isNeedsReview
          ? [
              {
                issue: "Thiếu âm đuôi /s/ và /ed/",
                example: userTurns[0]?.text ?? "I work on the project",
                correction: "Chú ý phát âm rõ âm kết thúc của từ",
              },
            ]
          : [],
        review_items: [lesson.vocabulary[0]?.word ?? "key term", lesson.frames[0] ?? "key phrase"],
        mode: "openai",
        frames_used: lesson.frames.filter((_, k) => used[k] ?? true),
        turn_count: userTurns.length,
        voice_turns: userTurns.length,
        pronunciation_note: "",
        level_signal: day > 15 ? "above" : "match",
      };
    }

    await prisma.attempt.create({
      data: {
        userId: user.id,
        day,
        localDate: date,
        lesson: lesson as any,
        plannedTitle: planDay.title,
        selectedBy: "plan",
        focus: planDay.focus,
        wordsDone: true,
        shadowDone: true,
        completed: true,
        summary: summary as any,
        practice: {
          create: {
            userId: user.id,
            startedAt: started,
            deadline: new Date(started.getTime() + 300_000),
            ended: true,
            turns: turns as any,
          },
        },
      },
    });

    // Add 15 minutes (900 seconds) study time for each day
    await prisma.studyTime.create({
      data: {
        userId: user.id,
        localDate: date,
        seconds: 900,
      },
    });
  }

  console.log(`Successfully seeded 30 completed days for ${EMAIL}!`);
  console.log(`Credentials:`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
}

run()
  .catch((err) => {
    console.error("Error seeding account:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

