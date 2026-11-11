import Link from "next/link";
import { StartLessonButton } from "@/components/lesson/start-lesson-button";
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

function callName(name: string) {
  const words = name.trim().split(/\s+/);
  return words.slice(words.length > 2 ? -2 : -1).join(" ");
}

export default async function TodayPage() {
  const user = await requirePlan();
  const [attempt, history] = await Promise.all([getTodayAttempt(user), getHistory(user.id)]);
  const done = completedCount(history);
  const week = lastWeek(history);
  const { lesson } = attempt;
  const labels = profileLabels(user.profile);
  const cta = attempt.completed
    ? "Xem lại kết quả"
    : attempt.wordsDone || attempt.practice
      ? "Tiếp tục buổi học"
      : "Bắt đầu học ngay";

  return (
    <section className="animate-fade-in pb-12">
      {/* Top Welcome Header */}
      <div className="mb-8 gap-5 md:flex md:items-end md:justify-between border-b border-[#e2e8f4] pb-6">
        <div>
    
          <h1 className="page-title mt-1">
            Chào {callName(user.name)}, sẵn sàng cho 15 phút hôm nay?
          </h1>
         
        </div>

        <div className="mt-4 shrink-0 md:mt-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 border border-amber-200/80 shadow-xs">
            <span>◷</span> Giờ học quen thuộc: {user.profile.study_time}
          </span>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <div>
          {/* Main Today Hero Banner - Matches Reference Style */}
          <article className="group relative overflow-hidden rounded-3xl border border-[#e2e8f4] bg-white p-7 md:p-9 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-soft px-3.5 py-1 text-xs font-bold tracking-wider text-blue-accent border border-blue-200/60">
                BUỔI {String(attempt.day).padStart(2, "0")} / 30
              </span>
              <span className="text-xs font-medium text-slate-500">15 phút tập trung</span>
            </div>

            <div className="my-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-navy leading-snug tracking-tight">
                {lesson.title}
              </h2>
              <div className="text-xl md:text-2xl font-extrabold text-gold mt-1">
                Tiến bộ không ngừng!
              </div>
            </div>

            <p className="text-base text-slate-600 leading-relaxed max-w-[620px]">
              {lesson.goal}
            </p>

            {attempt.focus && !attempt.completed && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-xs md:text-sm font-semibold text-amber-900 border border-amber-200/70">
                <span>✦</span>
                <span>Trọng tâm buổi học: {attempt.focus}</span>
              </div>
            )}

            {attempt.locked && (
              <div className="relative mt-6 rounded-2xl bg-slate-50 p-4.5 text-sm text-slate-700 border border-slate-200">
                {user.status === "LEAD"
                  ? "Bạn đã hoàn thành buổi học thử. Chuyên viên WeWIN sẽ liên hệ tư vấn và kích hoạt lộ trình 30 ngày để bạn học tiếp."
                  : "Tài khoản đang tạm dừng hoặc đã hết hạn. Vui lòng liên hệ chuyên viên WeWIN để tiếp tục học."}
              </div>
            )}

            <div className="relative mt-7 flex flex-wrap items-center gap-4">
              <StartLessonButton
                attemptId={attempt.id}
                track={!attempt.completed && !attempt.locked}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-navy px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-70"
              >
                {cta}
                <span className="text-base">→</span>
              </StartLessonButton>
              <Link
                href="/plan"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-navy shadow-xs transition-all hover:bg-slate-50"
              >
                Xem lộ trình
              </Link>
              <span className="text-xs md:text-sm text-slate-500 italic pl-1">
                {lesson.situation}
              </span>
            </div>

            {/* Subtle background ambient decorations */}
            <div
              className="pointer-events-none absolute -right-12 -bottom-16 size-64 rounded-full border-[36px] border-[#edf3fd]"
              aria-hidden="true"
            />
          </article>

          {/* Quick Stats Counter Grid */}
          <div className="my-6 grid grid-cols-3 gap-3 md:gap-4.5">
            {[
              [done, " / 30", "Buổi hoàn thành"],
              [streak(history), " ngày", "Chuỗi học liên tiếp"],
              [totalTurns(history), " lượt", "Lượt nói cùng AI"],
            ].map(([value, unit, label]) => (
              <div
                key={label}
                className="group rounded-2xl border border-[#e2e8f4] bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-2xl sm:text-3xl font-extrabold text-navy leading-tight">
                  {value}
                  <small className="text-sm font-normal text-slate-500 ml-1">{unit}</small>
                </div>
                <div className="mt-1 text-xs sm:text-sm font-medium text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          {/* 4-Step Routine Overview Card */}
          <article className="rounded-2xl border border-[#e2e8f4] bg-white p-6 sm:p-8 shadow-xs">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-navy">Quy trình 15 phút hôm nay</h3>
                <p className="text-xs text-slate-500 mt-0.5">Được tối ưu cho người đi làm bận rộn</p>
              </div>
              <span className="rounded-full bg-blue-soft px-3 py-1 text-xs font-bold text-blue-accent border border-blue-200/50">
                4 BƯỚC THỰC CHIẾN
              </span>
            </div>

            <div className="space-y-3">
              {FLOW.map(([n, title, desc, min]) => (
                <div
                  key={n}
                  className="group flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-[#edf3fd]/50"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-soft text-sm font-bold text-blue-accent transition-transform group-hover:scale-105 border border-blue-200/60">
                    {n}
                  </div>
                  <div className="flex-1">
                    <b className="text-sm font-bold text-navy group-hover:text-blue-accent transition-colors">
                      {title}
                    </b>
                    <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                    {min}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Right Column: Goal & Consistency Tracker */}
        <aside className="grid content-start gap-6">
          {/* Goal & Profile Info Card */}
          <article className="rounded-2xl border border-[#e2e8f4] bg-white p-6 shadow-xs">
            <div className="eyebrow flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-gold" />
              MỤC TIÊU CÔNG VIỆC CỦA BẠN
            </div>
            <p className="my-3 text-base font-semibold text-navy leading-snug">
              {labels.goals.join(" · ")}
            </p>

            <div className="flex flex-wrap gap-2 my-3">
              <span className="rounded-lg bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue-accent border border-blue-200/50">
                {labels.position}
              </span>
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/70">
                {levelInfo(user.profile.working_level).label}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4 italic">
              &ldquo;{user.plan.goal}&rdquo;
            </p>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex justify-between text-xs font-semibold text-navy mb-1.5">
                <span>Tiến độ 30 ngày</span>
                <span>{Math.round((done / 30) * 100)}%</span>
              </div>
              <progress value={done} max={30} aria-label="Số buổi hoàn thành" className="w-full" />
              <small className="block text-right text-xs text-slate-500 mt-1.5">
                Đã hoàn thành {done}/30 buổi
              </small>
            </div>
          </article>

          {/* Habit & Practice Reminder Card */}
          <article className="rounded-2xl border border-[#e2e8f4] bg-white p-6 shadow-xs">
            <div className="eyebrow flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-gold" />
              LỜI NHẮC THỰC CHIẾN
            </div>
            <h3 className="my-2 text-base font-bold text-navy leading-snug">
              Nghe. Nói theo.
              <br />
              Rồi ứng dụng ngay vào công việc.
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mỗi ngày một tình huống thực tế. AI Coach giúp bạn biến mẫu câu thành phản xạ tự nhiên của chính mình.
            </p>
          </article>

          {/* 7-Day Activity Week Tracker */}
          <article className="rounded-2xl border border-[#e2e8f4] bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-navy">
                7 ngày gần nhất
              </div>
              <small className="text-xs font-semibold text-blue-accent">
                {week.filter((d) => d.done).length}/7 buổi
              </small>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {week.map((d, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span
                    className={`mb-1.5 grid size-8 place-items-center rounded-full text-xs font-bold transition-all ${
                      d.done
                        ? "bg-navy text-white shadow-xs"
                        : "bg-slate-100 text-slate-400"
                    } ${
                      d.today ? "ring-2 ring-gold ring-offset-2 font-extrabold" : ""
                    }`}
                  >
                    {d.done ? "✓" : ""}
                  </span>
                  <small className="text-[11px] font-medium text-slate-500">{d.label}</small>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
