import DashboardClient from "./Dashboard";

export const metadata = {
  title: "Nirikshaka SaaS Control Panel",
  description: "Monitor and toggle SDK features for Nirikshaka client apps dynamically.",
};

export default function Home() {
  return <DashboardClient />;
}
