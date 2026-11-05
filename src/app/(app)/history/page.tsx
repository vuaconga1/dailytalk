import { HistoryView } from "@/components/history/history-view";
import { getHistory, getWeekReviews } from "@/lib/learning";
import { requirePlan } from "@/lib/page-guards";
import { streak } from "@/lib/stats";

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
