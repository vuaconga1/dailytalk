import { redirect } from "next/navigation";
import { isStaff } from "@/domain/access";
import { getSessionUser } from "@/server/auth";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isStaff(user.role) ? "/admin" : user.plan ? "/today" : "/onboarding");
}
