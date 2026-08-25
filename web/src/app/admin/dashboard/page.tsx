import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { CompletionChart } from "@/components/admin/completion-chart";
import { QrSettingsPanel } from "@/components/admin/qr-settings-panel";
import AttendanceSpotlight from "@/components/admin/attendance-spotlight";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sites } = await supabase.from("sites").select("id, name");
  const { data: checkpoints } = await supabase.from("checkpoints").select("id, site_id");
  const { data: completedLogs } = await supabase
    .from("checkpoint_logs")
    .select("checkpoint_id")
    .eq("status", "completed")
    .gte("created_at", today);

  const completionData = (sites || []).map((site) => {
    const siteCPs = (checkpoints || []).filter((c) => c.site_id === site.id);
    const cpIds = new Set(siteCPs.map((c) => c.id));
    const completed = (completedLogs || []).filter((l) => cpIds.has(l.checkpoint_id)).length;
    const total = siteCPs.length;
    return {
      name: site.name,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <DashboardStats />
      <AttendanceSpotlight />
      <CompletionChart data={completionData} />
      <QrSettingsPanel />
    </div>
  );
}
