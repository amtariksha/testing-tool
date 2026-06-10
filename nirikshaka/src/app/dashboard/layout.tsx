import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUser } from "@/app/auth/actions";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const userInfo = user ? {
    name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    email: user.email || "",
  } : null;

  return <DashboardLayout user={userInfo}>{children}</DashboardLayout>;
}
