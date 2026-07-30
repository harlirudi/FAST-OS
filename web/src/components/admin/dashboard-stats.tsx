"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Users, MapPin, Clock, AlertTriangle } from "lucide-react";

export function DashboardStats() {
  const [stats, setStats] = useState({ activeCleaners: 0, totalCleaners: 0, sessions: 0, sites: 0, alerts: 0, loading: true });
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const fetchStats = async () => {
    const [
      { count: tc },
      { data: activeCheckIns },
      { count: as },
      { count: sc },
      { count: oa },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "cleaner"),
      supabase.from("attendance_logs").select("user_id").eq("type", "check_in").gte("timestamp", today),
      supabase.from("checkpoint_logs").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("sites").select("*", { count: "exact", head: true }),
      supabase.from("sop_alerts").select("*", { count: "exact", head: true }).eq("acknowledged_at", null),
    ]);

    setStats({
      activeCleaners: new Set((activeCheckIns || []).map((a: any) => a.user_id)).size,
      totalCleaners: tc ?? 0,
      sessions: as ?? 0,
      sites: sc ?? 0,
      alerts: oa ?? 0,
      loading: false,
    });
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cleaner Aktif</CardTitle>
          <Users className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.loading ? "-" : stats.activeCleaners}</div>
          <p className="text-xs text-gray-500">dari {stats.loading ? "-" : stats.totalCleaners} total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sesi Berjalan</CardTitle>
          <Clock className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.loading ? "-" : stats.sessions}</div>
          <p className="text-xs text-gray-500">checkpoint in progress</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Site</CardTitle>
          <MapPin className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.loading ? "-" : stats.sites}</div>
          <p className="text-xs text-gray-500">lokasi terdaftar</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Alert SOP</CardTitle>
          <AlertTriangle className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.loading ? "-" : stats.alerts}</div>
          <p className="text-xs text-gray-500">belum di-ack</p>
        </CardContent>
      </Card>
    </div>
  );
}
