import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompletionChart } from "@/components/admin/completion-chart";
import { AttendanceTable } from "@/components/admin/attendance-table";
import { CheckpointTable } from "@/components/admin/checkpoint-table";
import { Users, MapPin, Clock, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Stats
  const { count: totalCleaners } = await supabase
    .from("users").select("*", { count: "exact", head: true }).eq("role", "cleaner");

  const { count: activeSessions } = await supabase
    .from("checkpoint_logs").select("*", { count: "exact", head: true }).eq("status", "in_progress");

  const { data: activeCheckIns } = await supabase
    .from("attendance_logs")
    .select("user_id")
    .eq("type", "check_in")
    .gte("timestamp", today);

  const { count: overdueAlerts } = await supabase
    .from("sop_alerts").select("*", { count: "exact", head: true })
    .eq("acknowledged_at", null);

  // Completion rate per site
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

  // Count unique check-ins today
  const uniqueCheckInUsers = new Set((activeCheckIns || []).map((a) => a.user_id));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cleaner Aktif</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueCheckInUsers.size}</div>
            <p className="text-xs text-gray-500">dari {totalCleaners ?? 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesi Berjalan</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions ?? 0}</div>
            <p className="text-xs text-gray-500">checkpoint in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Site</CardTitle>
            <MapPin className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites?.length ?? 0}</div>
            <p className="text-xs text-gray-500">lokasi terdaftar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alert SOP</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueAlerts ?? 0}</div>
            <p className="text-xs text-gray-500">belum di-ack</p>
          </CardContent>
        </Card>
      </div>

      <CompletionChart data={completionData} />

      <AttendanceTable />
      <CheckpointTable />
    </div>
  );
}
