import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isDemo } from "@/lib/ai";
import { getTodayAttempt, getWeekReview } from "@/lib/learning";
import { requirePlan } from "@/lib/page-guards";
import { levelInfo } from "@/lib/profile-options";

export default async function LessonPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requirePlan();
  const { day } = await searchParams;
  const attempt = await getTodayAttempt(user, day ? Number(day) : undefined);
  const week = await getWeekReview(user.id, attempt.day);
  return (
    <LessonPlayer
      key={attempt.id}
      initial={attempt}
      week={week}
      serverTime={Date.now()}
      demo={isDemo}
      contextLabel={levelInfo(attempt.lesson.level).label.toUpperCase()}
    />
  );
}
