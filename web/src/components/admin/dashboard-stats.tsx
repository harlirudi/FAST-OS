"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { Users, MapPin, Clock, AlertTriangle } from "lucide-react";

export function DashboardStats() {
  const [stats, setStats] = useState({
    activeCleaners: 0,
    totalCleaners: 0,
    sessions: 0,
    sites: 0,
    alerts: 0,
    loading: true,
  });
  const supabase = useMemo(() => createClient(), []);

  const fetchStats = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setStats((prev) => ({ ...prev, loading: true }));
      }
      const today = new Date().toISOString().split("T")[0];

      try {
        const [
          { count: tc },
          { data: activeCheckIns },
          { count: as },
          { count: sc },
          { count: oa },
        ] = await Promise.all([
          supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "cleaner"),
          supabase
            .from("attendance_logs")
            .select("user_id")
            .eq("type", "check_in")
            .gte("timestamp", today),
          supabase
            .from("checkpoint_logs")
            .select("*", { count: "exact", head: true })
            .eq("status", "in_progress"),
          supabase.from("sites").select("*", { count: "exact", head: true }),
          supabase
            .from("sop_alerts")
            .select("*", { count: "exact", head: true })
            .eq("acknowledged_at", null),
        ]);

        setStats({
          activeCleaners: new Set((activeCheckIns || []).map((a: any) => a.user_id)).size,
          totalCleaners: tc ?? 0,
          sessions: as ?? 0,
          sites: sc ?? 0,
          alerts: oa ?? 0,
          loading: false,
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        if (isInitial) {
          setStats((prev) => ({ ...prev, loading: false }));
        }
      }
    },
    [supabase]
  );

  useEffect(() => {
    fetchStats(true);
    const interval = setInterval(() => fetchStats(false), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const cards = [
    {
      title: "Cleaner Aktif",
      icon: Users,
      value: stats.activeCleaners,
      sub: `dari ${stats.totalCleaners} total`,
    },
    {
      title: "Sesi Berjalan",
      icon: Clock,
      value: stats.sessions,
      sub: "checkpoint in progress",
    },
    {
      title: "Site",
      icon: MapPin,
      value: stats.sites,
      sub: "lokasi terdaftar",
    },
    {
      title: "Alert SOP",
      icon: AlertTriangle,
      value: stats.alerts,
      sub: "belum di-ack",
      isAlert: stats.alerts > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <Card key={idx} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
            <card.icon
              className={`h-4 w-4 ${card.isAlert ? "text-rose-500" : "text-slate-400"}`}
            />
          </CardHeader>
          <CardContent className="min-h-[64px]">
            {stats.loading ? (
              <div className="space-y-2 py-1">
                <div className="h-7 w-12 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${
                    card.isAlert ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {card.value}
                </div>
                <p className="text-xs text-slate-500">{card.sub}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
