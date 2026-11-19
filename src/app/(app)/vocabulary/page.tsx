import { VocabularyBrowser } from "@/components/vocabulary/vocabulary-browser";
import { vocabularyGroups, vocabularyIndex } from "@/server/learning/vocabulary";
import { requirePlan } from "@/server/http/page-guards";

type Props = { searchParams: Promise<{ industry?: string; position?: string }> };

export default async function VocabularyPage({ searchParams }: Props) {
  const user = await requirePlan();
  const params = await searchParams;
  const index = await vocabularyIndex();
  const requestedIndustry = index.find((item) => item.id === params.industry);
  const profileIndustry = index.find((item) => item.id === user.profile.industry);
  const industry = requestedIndustry ?? profileIndustry ?? index[0];
  const requestedPosition = industry?.positions.find((item) => item.id === params.position);
  const profilePosition =
    industry?.id === user.profile.industry ? industry.positions.find((item) => item.id === user.profile.position) : undefined;
  const position = requestedPosition ?? profilePosition ?? industry?.positions[0];
  const groups = position ? await vocabularyGroups(position.clusterLabel, position.job, position.groups) : [];

  return (
    <section className="animate-fade-in pb-12">
      <header className="mb-6 rounded-2xl border-2 border-black bg-gray-100 p-5 text-navy shadow-(--ww-frame-shadow) md:p-7">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
          <span className="size-2 rounded-full bg-gold" />
          Theo nhóm ngành và vị trí
        </div>
        <h1 className="mt-3 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-tight tracking-tight">Từ vựng.</h1>
        <p className="mt-2 max-w-[860px] text-base leading-relaxed text-ink-secondary md:text-lg">
          {position
            ? `${industry?.label} · ${position.label}. Bộ từ của giáo trình, cộng những từ đã được lưu thêm trong ngân hàng bài học.`
            : "Chưa có bộ từ cho lựa chọn này."}
        </p>
      </header>
      {industry && position && (
        <VocabularyBrowser
          industries={index.map((item) => ({
            id: item.id,
            label: item.label,
            positions: item.positions.map((job) => ({ id: job.id, label: job.label, count: job.count })),
          }))}
          industryId={industry.id}
          positionId={position.id}
          groups={groups}
        />
      )}
    </section>
  );
}
