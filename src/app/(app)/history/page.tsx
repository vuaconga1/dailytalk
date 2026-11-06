import { HistoryView } from "@/components/history/history-view";
import { getHistory, getWeekReviews } from "@/server/learning/history";
import { requirePlan } from "@/server/http/page-guards";
import { streak } from "@/domain/stats";

export default async function HistoryPage() {
  const user = await requirePlan();
  const [history, weekReviews] = await Promise.all([
    getHistory(user.id),
    getWeekReviews(user.id),
  ]);
  const currentStreak = streak(history);

  return (
    <HistoryView
      history={history}
      weekReviews={weekReviews}
      streak={currentStreak}
      userName={user.name}
    />
  );
}
