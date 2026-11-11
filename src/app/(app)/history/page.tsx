import { HistoryView } from "@/components/history/history-view";
import { getHistory, getWeekReviews } from "@/server/learning/history";
import { getMonthlyStudySeconds } from "@/server/learning/study-time";
import { requirePlan } from "@/server/http/page-guards";
import { streak } from "@/domain/stats";
import { vnDate } from "@/lib/time";

export default async function HistoryPage() {
  const user = await requirePlan();
  const [history, weekReviews, studySeconds] = await Promise.all([
    getHistory(user.id),
    getWeekReviews(user.id),
    getMonthlyStudySeconds(user.id),
  ]);
  const currentStreak = streak(history);

  return (
    <HistoryView
      history={history}
      weekReviews={weekReviews}
      streak={currentStreak}
      studySeconds={studySeconds}
      currentMonth={vnDate().slice(0, 7)}
      userName={user.name}
    />
  );
}
