import { redirect } from "next/navigation";
import { hasActiveAccess } from "@/domain/access";
import { requireUser } from "@/server/http/page-guards";
import { listCatalog } from "@/server/shadowing/store";
import { ShadowingLocked } from "./locked";

export default async function ShadowingIndexPage() {
  const user = await requireUser();
  if (!hasActiveAccess(user)) return <ShadowingLocked />;
  const catalog = await listCatalog();
  if (catalog.length) redirect(`/shadowing/${catalog[0].slug}`);
  return (
    <section className="mx-auto w-full max-w-[640px] rounded-2xl border-2 border-black bg-white p-6 text-center shadow-(--ww-frame-shadow) sm:p-8">
      <div className="mb-2 text-xs font-bold tracking-wider text-gold uppercase">Shadowing</div>
      <h1 className="mb-3 border-b-2 border-black pb-3 text-2xl font-extrabold text-navy md:text-[28px]">Chưa có bài luyện nào.</h1>
      <p className="text-ink-secondary">WeWIN đang chuẩn bị các video luyện shadowing. Bạn quay lại sau nhé!</p>
    </section>
  );
}
