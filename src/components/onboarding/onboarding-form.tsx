"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/client/api";
import { isLightPace } from "@/domain/pace";
import { MAX_AGE, MIN_AGE, NAME_MAX } from "@/domain/profile";
import { AUDIENCES, DURATIONS, FREQUENCIES, GENDERS, GOALS, INDUSTRIES, labelOf, LEVELS, OTHER, type Option } from "@/domain/profile-options";

export type OnboardingValues = Form;

type Form = {
  name: string;
  age: string;
  gender: string;
  industry: string;
  industry_other: string;
  position: string;
  position_other: string;
  audiences: string[];
  goals: string[];
  self_level: string;
  frequency: string;
  duration_months: string;
  study_time: string;
  reminders: boolean;
};

const EMPTY: Form = {
  name: "",
  age: "",
  gender: "",
  industry: "",
  industry_other: "",
  position: "",
  position_other: "",
  audiences: [],
  goals: [],
  self_level: "",
  frequency: "",
  duration_months: "",
  study_time: "20:30",
  reminders: true,
};

function Chips({ options, value, onChange }: { options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={`rounded-full border px-3.5 py-2 text-[13px] transition ${
              on ? "border-teal bg-teal text-white" : "border-[#cfdae1] bg-white text-ink hover:border-teal"
            }`}
          >
            {on ? "✓ " : ""}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Choice({ name, options, value, onChange }: { name: string; options: readonly (Option & { description?: string })[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 text-sm ${
            value === o.id ? "border-teal bg-teal-soft" : "border-[#cfdae1] bg-white"
          }`}
        >
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} required className="mt-0.5 size-4 shrink-0 accent-teal" />
          <span className="min-w-0">
            <b className="block">{o.label}</b>
            {o.description && <small className="text-muted">{o.description}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

type Props = {
  restart?: boolean;
  /** A trial learner revising a saved profile before paying. */
  editing?: boolean;
  defaultName?: string;
  initial?: Partial<Form>;
};

export function OnboardingForm({ restart = false, editing = false, defaultName = "", initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ ...EMPTY, name: defaultName, ...initial });
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const sector = useMemo(() => INDUSTRIES.find((i) => i.id === form.industry), [form.industry]);
  const industryLabel = form.industry === OTHER ? form.industry_other : sector?.label;
  const positionLabel = form.position === OTHER ? form.position_other : sector?.positions.find((p) => p.id === form.position)?.label;

  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.audiences.length) return setError("Hãy chọn ít nhất một đối tượng giao tiếp.");
    if (!form.goals.length) return setError("Hãy chọn ít nhất một mục tiêu học tiếng Anh.");
    setError("");
    setStep("confirm");
    window.scrollTo(0, 0);
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const { next } = await api<{ next: string }>("/api/onboard", form);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (step === "confirm") {
    const rows: [string, string][] = [
      ["Họ và tên", form.name.trim()],
      ["Tuổi", form.age],
      ["Giới tính", labelOf(GENDERS, form.gender) ?? ""],
      ["Công việc", industryLabel ?? ""],
      ["Vị trí", positionLabel ?? ""],
      ["Giao tiếp với", form.audiences.map((a) => labelOf(AUDIENCES, a)).join(", ")],
      ["Mục tiêu", form.goals.map((g) => labelOf(GOALS, g)).join(", ")],
      ["Trình độ hiện tại", labelOf(LEVELS, form.self_level) ?? ""],
      ["Tần suất dùng tiếng Anh", labelOf(FREQUENCIES, form.frequency) ?? ""],
      ["Thời gian học mong muốn", labelOf(DURATIONS, form.duration_months) ?? ""],
      ["Giờ học", `${form.study_time} · ${form.reminders ? "có nhắc học" : "không nhắc"}`],
    ];
    return (
      <div className="card">
        <h2 className="mb-1 text-[25px] font-bold tracking-[-0.5px]">Xác nhận hồ sơ học tập</h2>
        <p className="mb-5 text-muted">WeWIN dùng thông tin này để xếp trình độ ban đầu và gợi ý lộ trình 30 ngày cho bạn.</p>
        <dl className="mb-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[190px_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {isLightPace({ age: Number(form.age) }) && (
          <p className="note mb-4">
            Lộ trình sẽ theo nhịp nhẹ nhàng hơn: khoảng 5 từ mới cho mỗi 2 ngày học, ít mẫu câu và câu shadowing hơn mỗi buổi.
          </p>
        )}
        {restart && (
          <p className="note mb-4">Hồ sơ mới sẽ thay thế khảo sát cũ và bắt đầu lại lộ trình từ ngày 1.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setStep("form")}>
            ← Sửa thông tin
          </button>
          <button type="button" className="btn" disabled={busy} onClick={confirm}>
            {busy ? "Đang phân tích hồ sơ và tạo lộ trình…" : editing ? "Lưu hồ sơ và tiếp tục thanh toán →" : "Xác nhận và tiếp tục →"}
          </button>
        </div>
        <div className="form-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="card">
      <h2 className="mb-4 text-[clamp(20px,2.2vw,25px)] font-bold tracking-[-0.5px]">01. Công việc của bạn</h2>
      <div className="grid gap-x-5 md:grid-cols-2">
        <div className="field">
          <label htmlFor="name">Họ và tên</label>
          <input
            id="name"
            required
            maxLength={NAME_MAX}
            autoComplete="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn An"
          />
        </div>
        <div className="field">
          <label htmlFor="age">Tuổi</label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            required
            min={MIN_AGE}
            max={MAX_AGE}
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="Ví dụ: 32"
          />
        </div>
        <div className="field">
          <label htmlFor="gender">Giới tính</label>
          <select id="gender" required value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="" disabled>
              Chọn giới tính
            </option>
            {GENDERS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="industry">Công việc</label>
          <select
            id="industry"
            required
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value, position: "", position_other: "" }))}
          >
            <option value="" disabled>
              Chọn ngành nghề
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        {form.industry === OTHER && (
          <div className="field">
            <label htmlFor="industry_other">Công việc khác</label>
            <input id="industry_other" required maxLength={100} value={form.industry_other} onChange={(e) => set("industry_other", e.target.value)} placeholder="Ví dụ: Bất động sản" />
          </div>
        )}
        <div className="field">
          <label htmlFor="position">Vị trí</label>
          <select id="position" required disabled={!sector} value={form.position} onChange={(e) => set("position", e.target.value)}>
            <option value="" disabled>
              {sector ? "Chọn vị trí" : "Chọn công việc trước"}
            </option>
            {sector?.positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {form.position === OTHER && (
          <div className="field">
            <label htmlFor="position_other">Vị trí khác</label>
            <input id="position_other" required maxLength={100} value={form.position_other} onChange={(e) => set("position_other", e.target.value)} placeholder="Ví dụ: Chuyên viên pháp chế" />
          </div>
        )}
      </div>

      <h2 className="mt-2 mb-4 border-t border-[#e2e8f4] pt-6 text-[clamp(20px,2.2vw,25px)] font-bold tracking-[-0.5px]">02. Nhu cầu tiếng Anh</h2>
      <div className="field">
        <label>Bạn muốn học tiếng Anh để giao tiếp với ai? (chọn nhiều)</label>
        <Chips options={AUDIENCES} value={form.audiences} onChange={(v) => set("audiences", v)} />
      </div>
      <div className="field">
        <label>Mục tiêu học tiếng Anh (chọn nhiều)</label>
        <Chips options={GOALS} value={form.goals} onChange={(v) => set("goals", v)} />
      </div>
      <div className="field">
        <label>Trình độ hiện tại</label>
        <Choice name="self_level" options={LEVELS} value={form.self_level} onChange={(v) => set("self_level", v)} />
      </div>
      <div className="field">
        <label>Tần suất sử dụng tiếng Anh</label>
        <Choice name="frequency" options={FREQUENCIES} value={form.frequency} onChange={(v) => set("frequency", v)} />
      </div>

      <h2 className="mt-2 mb-4 border-t border-[#e2e8f4] pt-6 text-[clamp(20px,2.2vw,25px)] font-bold tracking-[-0.5px]">03. Một cuộc hẹn với chính mình</h2>
      <div className="field">
        <label>Thời gian học mong muốn</label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {DURATIONS.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border p-3 text-sm font-semibold ${
                form.duration_months === o.id ? "border-teal bg-teal-soft" : "border-[#cfdae1] bg-white"
              }`}
            >
              <input
                type="radio"
                name="duration_months"
                checked={form.duration_months === o.id}
                onChange={() => set("duration_months", o.id)}
                required
                className="size-4 shrink-0 accent-teal"
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="study_time">Giờ học hằng ngày (giờ Việt Nam)</label>
        <input id="study_time" type="time" required value={form.study_time} onChange={(e) => set("study_time", e.target.value)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={form.reminders} onChange={(e) => set("reminders", e.target.checked)} />
        Nhắc tôi trước giờ học mỗi ngày.
      </label>
      <label className="check mt-3">
        <input type="checkbox" required defaultChecked={editing} />
        Tôi đồng ý để WeWIN lưu hồ sơ và kết quả học tập nhằm cá nhân hóa lộ trình của tôi.
      </label>
      <button type="submit" className="btn mt-6 w-full sm:w-auto">
        Xem lại hồ sơ →
      </button>
      <div className="form-error" role="alert">
        {error}
      </div>
    </form>
  );
}
