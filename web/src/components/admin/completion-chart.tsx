"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  data: Array<{ name: string; completed: number; total: number; rate: number }>;
};

export function CompletionChart({ data }: Props) {
  const hasData = data.length > 0 && data.some((d) => d.total > 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Completion Rate per Site</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {hasData ? (
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                />
                <YAxis domain={[0, 100]} unit="%" width={40} />
                <Tooltip formatter={(v: unknown) => `${v}%`} />
                <Bar dataKey="rate" fill="#2563eb" radius={[4, 4, 0, 0]} minPointSize={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] w-full items-center justify-center">
            <p className="text-sm text-gray-400">
              Belum ada aktivitas hari ini — data completion rate akan muncul setelah ada sesi checkpoint.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
