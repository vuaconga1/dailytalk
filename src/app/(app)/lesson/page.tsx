import { LessonPlayer } from "@/components/lesson/lesson-player";
import { isDemo } from "@/server/ai/config";
import { lessonAudioStatus } from "@/server/learning/audio";
import { getWeekReview } from "@/server/learning/history";
import { getTodayAttempt } from "@/server/learning/lessons";
import { requirePlan } from "@/server/http/page-guards";
import { levelInfo } from "@/domain/profile-options";

export default async function LessonPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requirePlan();
  const { day } = await searchParams;
  const attempt = await getTodayAttempt(user, day ? Number(day) : undefined);
  const [week, audio] = await Promise.all([getWeekReview(user.id, attempt.day), lessonAudioStatus(attempt.lesson)]);
  return (
    <LessonPlayer
      key={attempt.id}
      initial={attempt}
      week={week}
      serverTime={Date.now()}
      demo={isDemo}
      audio={audio}
      contextLabel={levelInfo(attempt.lesson.level).label.toUpperCase()}
    />
  );
}
