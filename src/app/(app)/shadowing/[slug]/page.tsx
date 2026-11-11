import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShadowingPractice } from "@/components/shadowing/shadowing-practice";
import { hasActiveAccess } from "@/domain/access";
import { requireUser } from "@/server/http/page-guards";
import { getPublishedExercise, listCatalog, toPublicExercise } from "@/server/shadowing/store";
import { ShadowingLocked } from "../locked";

export const metadata: Metadata = { title: "Shadowing · WeWIN Daily Speaking" };

export default async function ShadowingExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (!hasActiveAccess(user)) return <ShadowingLocked />;
  const { slug } = await params;
  const [row, catalog] = await Promise.all([getPublishedExercise(decodeURIComponent(slug)), listCatalog()]);
  if (!row) notFound();
  return <ShadowingPractice key={row.slug} exercise={toPublicExercise(row)} catalog={catalog} />;
}
