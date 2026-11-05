import { redirect } from "next/navigation";
import { isStaff } from "@/lib/access";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isStaff(user.role) ? "/admin" : user.plan ? "/today" : "/onboarding");
}
