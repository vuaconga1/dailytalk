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
    <section className="card mx-auto max-w-[640px] text-center">
      <div className="eyebrow">SHADOWING</div>
      <h1 className="page-title mb-2 !text-[28px]">Chưa có bài luyện nào.</h1>
      <p className="text-muted">WeWIN đang chuẩn bị các video luyện shadowing. Bạn quay lại sau nhé!</p>
    </section>
  );
}
