import Link from "next/link";
import { StartLessonButton } from "@/components/lesson/start-lesson-button";
import { CourseReportPanel } from "@/components/today/course-report";
import { isTrial, PAYMENT_ENABLED } from "@/domain/access";
import { courseLength, isCourseFinished } from "@/domain/course-report";
import { getCourseReport } from "@/server/learning/course-report";
import { getHistory } from "@/server/learning/history";
import { getTodayAttempt } from "@/server/learning/lessons";
import { requirePlan } from "@/server/http/page-guards";
import { profileLabels } from "@/domain/profile";
import { levelInfo } from "@/domain/profile-options";
import { completedCount, lastWeek, streak, totalTurns } from "@/domain/stats";

const FLOW = [
  ["01", "Từ vựng & cấu trúc", "Hiểu từ, học mẫu câu để dùng ngay trong công việc.", "3 phút"],
  ["02", "Nghe & shadowing", "Nghe từng câu mẫu, nói theo, đối chiếu giọng của mình.", "5 phút"],
  ["03", "Hội thoại theo tình huống", "Thực hành phản xạ 1-1 cùng AI Coach theo đúng vai trò.", "5 phút"],
  ["04", "Tổng kết & đánh giá", "Nhìn lại điểm làm tốt, nhận câu sửa và từ cần ôn.", "2 phút"],
];

const CARD = "rounded-2xl border-2 border-black bg-white shadow-(--ww-frame-shadow)";
const LABEL = "flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold";

function callName(name: string) {
  const words = name.trim().split(/\s+/);
  return words.slice(words.length > 2 ? -2 : -1).join(" ");
}

export default async function TodayPage() {
  const user = await requirePlan();
  const [attempt, history] = await Promise.all([getTodayAttempt(user), getHistory(user.id)]);
  const done = completedCount(history);
  const week = lastWeek(history);
  const report = isCourseFinished(history, courseLength(user.plan)) ? await getCourseReport(user) : null;
  const { lesson } = attempt;
  const labels = profileLabels(user.profile);
  const trial = isTrial(user);
  const cta = attempt.completed
    ? "Xem lại kết quả"
    : attempt.wordsDone || attempt.practice
      ? "Tiếp tục buổi học"
      : "Bắt đầu học ngay";

  return (
    <section className="animate-fade-in pb-12">
      {report && <CourseReportPanel report={report} name={callName(user.name)} />}

      {trial && !attempt.locked && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-gold-soft px-5 py-3.5 text-sm font-medium text-navy">
          <span className="min-w-0">Bạn đang học thử miễn phí buổi 1. Thanh toán để mở toàn bộ lộ trình 30 ngày và phòng luyện shadowing.</span>
          <Link href="/payment" className="btn !py-2 text-sm">
            Chọn gói học →
          </Link>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title min-w-0">Chào {callName(user.name)}, sẵn sàng cho 15 phút hôm nay?</h1>
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-bold text-navy">
          <span className="text-gold" aria-hidden>
            ◷
          </span>
          Giờ học quen thuộc: {user.profile.study_time}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <div className="min-w-0">
          <article className="relative overflow-hidden rounded-2xl border-2 border-black bg-slate-100 p-5 text-navy shadow-(--ww-frame-shadow) sm:p-7 md:p-9">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-gold px-3.5 py-1 text-xs font-bold tracking-wider text-white">
                BUỔI {String(attempt.day).padStart(2, "0")} / 30
              </span>
              <span className="text-xs font-semibold text-muted">15 phút tập trung</span>
            </div>

            <h2 className="mt-5 text-2xl font-extrabold leading-snug tracking-tight md:text-3xl">{lesson.title}</h2>
            <div className="mt-1 text-xl font-extrabold text-amber-600 md:text-2xl">Tiến bộ không ngừng!</div>
            <p className="mt-4 max-w-[620px] text-base leading-relaxed text-ink-secondary">{lesson.goal}</p>

            {attempt.focus && !attempt.completed && (
              <div className="mt-4 inline-flex items-start gap-2 rounded-xl border border-gold/50 bg-gold-soft px-3.5 py-2 text-xs font-semibold text-amber-800 md:text-sm">
                <span aria-hidden>✦</span>
                <span className="min-w-0">Trọng tâm buổi học: {attempt.focus}</span>
              </div>
            )}

            {attempt.locked && trial && (
              <div className="mt-6 rounded-xl bg-white p-4 text-sm text-ink">
                Bạn đã hoàn thành buổi học thử miễn phí.{" "}
                <Link href="/payment" className="font-bold text-navy underline">
                  Thanh toán gói học
                </Link>{" "}
                để mở các buổi tiếp theo, tài khoản được kích hoạt ngay sau khi chuyển khoản.
              </div>
            )}
            {attempt.locked && !trial && (
              <div className="mt-6 rounded-xl bg-white p-4 text-sm text-ink">
                Tài khoản đang tạm dừng hoặc đã hết hạn. Vui lòng liên hệ chuyên viên WeWIN
                {PAYMENT_ENABLED && (
                  <>
                    {" "}hoặc{" "}
                    <Link href="/payment" className="font-bold text-navy underline">
                      gia hạn gói học
                    </Link>
                  </>
                )}{" "}
                để tiếp tục.
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <StartLessonButton
                attemptId={attempt.id}
                track={!attempt.completed && !attempt.locked}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#b88c1f] hover:shadow-md active:scale-95 disabled:opacity-70 sm:w-auto"
              >
                {cta}
                <span className="text-base">→</span>
              </StartLessonButton>
              <Link
                href="/plan"
                className="inline-flex w-full items-center justify-center rounded-xl border-2 border-navy bg-white px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:w-auto"
              >
                Xem lộ trình
              </Link>
            </div>
          </article>

          <div className="my-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 md:gap-4">
            {[
              [done, " / 30", "Buổi hoàn thành"],
              [streak(history), " ngày", "Chuỗi học liên tiếp"],
              [totalTurns(history), " lượt", "Lượt nói cùng AI"],
            ].map(([value, unit, label], i) => (
              <div key={label} className={`${CARD} min-w-0 p-4 sm:p-5`}>
                <div className={`text-3xl font-black leading-tight ${i === 1 ? "text-gold" : "text-navy"}`}>
                  {value}
                  <small className="ml-1 text-sm font-semibold text-ink-secondary">{unit}</small>
                </div>
                <div className="mt-1 text-xs font-semibold text-ink-secondary sm:text-sm">{label}</div>
              </div>
            ))}
          </div>

          <article className={`${CARD} p-5 sm:p-7`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold text-navy md:text-xl">Quy trình 15 phút hôm nay</h3>
              <span className="badge badge-gold">4 BƯỚC THỰC CHIẾN</span>
            </div>
            <div className="grid gap-2">
              {FLOW.map(([n, title, desc, min]) => (
                <div key={n} className="flex items-center gap-3 rounded-xl bg-navy-soft/40 p-3 sm:gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-sm font-bold text-gold-light">{n}</div>
                  <div className="min-w-0 flex-1">
                    <b className="text-sm font-bold text-navy sm:text-base">{title}</b>
                    <p className="mt-0.5 text-xs text-ink-secondary">{desc}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-gold-soft px-2.5 py-1 text-xs font-bold text-navy">{min}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <article className={`${CARD} p-5 sm:p-6`}>
            <div className={LABEL}>
              <span className="size-1.5 rounded-full bg-gold" />
              Mục tiêu công việc của bạn
            </div>
            <p className="mt-3 text-base font-bold leading-snug text-navy">{labels.goals.join(" · ")}</p>
            <div className="my-3 flex flex-wrap gap-2">
              <span className="rounded-lg bg-navy px-2.5 py-1 text-xs font-semibold text-white">{labels.position}</span>
              <span className="rounded-lg bg-gold-soft px-2.5 py-1 text-xs font-semibold text-navy">
                {levelInfo(user.profile.working_level).label}
              </span>
            </div>
            <p className="mb-5 text-xs italic leading-relaxed text-ink-secondary">&ldquo;{user.plan.goal}&rdquo;</p>
            <div className="mb-1.5 flex justify-between text-xs font-bold text-navy">
              <span>Tiến độ 30 ngày</span>
              <span className="text-gold">{Math.round((done / 30) * 100)}%</span>
            </div>
            <progress value={done} max={30} aria-label="Số buổi hoàn thành" className="w-full" />
            <small className="mt-1.5 block text-right text-xs text-ink-secondary">Đã hoàn thành {done}/30 buổi</small>
          </article>

          <article className={`${CARD} p-5 sm:p-6`}>
            <div className={LABEL}>
              <span className="size-1.5 rounded-full bg-gold" />
              Lời nhắc thực chiến
            </div>
            <h3 className="my-2 text-base font-bold leading-snug text-navy">Nghe, nói theo, rồi ứng dụng ngay vào công việc.</h3>
            <p className="text-xs leading-relaxed text-ink-secondary">
              Mỗi ngày một tình huống thực tế. AI Coach giúp bạn biến mẫu câu thành phản xạ tự nhiên của chính mình.
            </p>
          </article>

          <article className={`${CARD} p-5 sm:p-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-navy">7 ngày gần nhất</div>
              <span className="badge badge-gold !py-0.5">{week.filter((d) => d.done).length}/7 buổi</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5">
              {week.map((d, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span
                    className={`mb-1.5 grid size-7 place-items-center rounded-full text-xs font-bold min-[400px]:size-8 ${
                      d.done ? "bg-navy text-gold-light" : "bg-navy-soft text-muted"
                    } ${d.today ? "font-extrabold ring-2 ring-gold ring-offset-2" : ""}`}
                  >
                    {d.done ? "✓" : ""}
                  </span>
                  <small className="text-[11px] font-medium text-ink-secondary">{d.label}</small>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
