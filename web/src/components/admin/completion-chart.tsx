"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Props = {
  data: Array<{ name: string; completed: number; total: number; rate: number }>;
};

export function CompletionChart({ data }: Props) {
  const hasSites = Array.isArray(data) && data.length > 0;

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800">Completion Rate per Site</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Persentase penyelesaian pembersihan checkpoint hari ini
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {hasSites ? (
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 30, bottom: 15, left: 15 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)}
                  dy={6}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  width={50}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v: unknown) => [`${v}%`, "Tingkat Selesai"]}
                  cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                />
                <Bar
                  dataKey="rate"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  background={{ fill: "#f1f5f9", radius: 4 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-slate-500">
              Belum ada data site terdaftar
            </p>
            <p className="text-xs text-slate-400">
              Tambahkan site pada menu Site untuk melihat grafik analitik.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
