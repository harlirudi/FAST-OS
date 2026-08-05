import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ok, err } from "../_shared/auth.ts";
import { haversineDistance } from "../_shared/geo.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ESCALATION_MS = 15 * 60 * 1000;

async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN tidak diset, skip Telegram");
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const threshold = new Date(now.getTime() - ONE_HOUR_MS).toISOString();

  // 1. Cari checkpoint yang overdue
  const { data: allCheckpoints } = await supabase
    .from("checkpoints")
    .select("id, name, site_id");

  if (!allCheckpoints) return ok({ message: "Tidak ada checkpoint", alerts: 0 });

  // Cek completed sessions (finished_at)
  const { data: recentCompleted } = await supabase
    .from("checkpoint_logs")
    .select("checkpoint_id, finished_at")
    .eq("status", "completed")
    .gte("finished_at", threshold)
    .order("finished_at", { ascending: false });

  // Cek in_progress sessions (started_at) — stale jika > 1 jam tanpa update
  const { data: recentInProgress } = await supabase
    .from("checkpoint_logs")
    .select("checkpoint_id, started_at")
    .eq("status", "in_progress")
    .gte("started_at", threshold)
    .order("started_at", { ascending: false });

  const lastActivity: Record<string, string> = {};

  // Prioritaskan finished_at dari completed, atau started_at dari in_progress
  recentCompleted?.forEach((log) => {
    if (!lastActivity[log.checkpoint_id]) {
      lastActivity[log.checkpoint_id] = log.finished_at;
    }
  });
  recentInProgress?.forEach((log) => {
    if (!lastActivity[log.checkpoint_id] ||
        new Date(log.started_at) > new Date(lastActivity[log.checkpoint_id])) {
      lastActivity[log.checkpoint_id] = log.started_at;
    }
  });

  const overdueIds = allCheckpoints
    .filter((cp) => {
      const last = lastActivity[cp.id];
      return !last || new Date(last).getTime() < new Date(threshold).getTime();
    })
    .map((cp) => cp.id);

  if (overdueIds.length === 0) {
    return ok({ message: "Semua checkpoint dalam batas waktu", alerts: 0 });
  }

  // 2. Dapatkan alert yang sudah ada
  const { data: existingAlerts } = await supabase
    .from("sop_alerts")
    .select("*")
    .in("checkpoint_id", overdueIds)
    .eq("acknowledged_at", null);

  const existingMap = new Map((existingAlerts || []).map((a) => [a.checkpoint_id, a]));

  let newAlerts = 0;
  let escalations = 0;

  for (const cpId of overdueIds) {
    const cp = allCheckpoints.find((c) => c.id === cpId)!;
    const existing = existingMap.get(cpId);

    if (!existing) {
      // Alert baru
      await supabase.from("sop_alerts").insert({
        checkpoint_id: cpId,
        site_id: cp.site_id,
        first_alert_at: now.toISOString(),
      });
      newAlerts++;
    } else {
      // Cek escalation
      const elapsed = now.getTime() - new Date(existing.first_alert_at).getTime();
      if (!existing.escalated && elapsed >= ESCALATION_MS) {
        // Escalate ke supervisor
        const { data: supervisors } = await supabase
          .from("users")
          .select("name, telegram_chat_id")
          .eq("role", "supervisor")
          .eq("site_id", cp.site_id)
          .not("telegram_chat_id", "is", null);

        // Cari cleaner terakhir yang scan checkpoint ini
        const { data: lastCleaner } = await supabase
          .from("checkpoint_logs")
          .select("user_id, users(name)")
          .eq("checkpoint_id", cpId)
          .eq("status", "completed")
          .order("finished_at", { ascending: false })
          .limit(1)
          .single();

        const cleanerName = lastCleaner?.users?.name || "unknown";
        const msg =
          `<b>⚠️ Eskalasi SOP</b>\n\n` +
          `Checkpoint: <b>${cp.name}</b>\n` +
          `Cleaner terakhir: ${cleanerName}\n` +
          `Waktu terakhir selesai: ${existing.first_alert_at ? new Date(existing.first_alert_at).toLocaleTimeString("id-ID") : "belum pernah"}\n` +
          `Status: tidak di-scan > 15 menit sejak alert pertama`;

        if (supervisors) {
          for (const spv of supervisors) {
            await sendTelegramMessage(spv.telegram_chat_id, msg);
          }
        }

        await supabase
          .from("sop_alerts")
          .update({ escalated: true, escalated_at: now.toISOString() })
          .eq("id", existing.id);

        escalations++;
      }
    }
  }

  return ok({
    message: "Monitoring selesai",
    overdue: overdueIds.length,
    newAlerts,
    escalations,
  });
});
