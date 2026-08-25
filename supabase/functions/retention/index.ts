// Retensi data: hapus log absensi & checkpoint + foto terkait yang lebih tua dari 30 hari.
// Dijadwalkan harian via cron (config.toml). Dipanggil dengan header x-cron-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RETENTION_DAYS = 30;

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Kumpulkan URL foto yang akan ikut terhapus
  const { data: attLogs } = await supabase
    .from("attendance_logs")
    .select("check_in_photo_url, check_out_photo_url")
    .lt("timestamp", cutoff);
  const { data: cpLogs } = await supabase
    .from("checkpoint_logs")
    .select("before_photo_url, after_photo_url")
    .lt("created_at", cutoff);

  // Hapus log
  const { error: delAtt } = await supabase.from("attendance_logs").delete().lt("timestamp", cutoff);
  const { error: delCp } = await supabase.from("checkpoint_logs").delete().lt("created_at", cutoff);

  // Hapus objek foto dari storage (path: <userId>/<timestamp>.<ext>)
  const paths: string[] = [];
  for (const r of [...(attLogs || []), ...(cpLogs || [])]) {
    for (const url of [r.check_in_photo_url, r.check_out_photo_url, r.before_photo_url, r.after_photo_url]) {
      if (url) {
        const m = url.match(/\/object\/public\/attendance-photos\/(.+)$/);
        if (m) paths.push(m[1]);
      }
    }
  }
  let photosDeleted = 0;
  if (paths.length > 0) {
    const { error: delPhotos } = await supabase.storage.from("attendance-photos").remove(paths);
    if (!delPhotos) photosDeleted = paths.length;
  }

  return new Response(
    JSON.stringify({
      cutoff,
      logs_deleted: { attendance: !delAtt, checkpoint: !delCp },
      photos_deleted: photosDeleted,
    }),
    { headers: { "content-type": "application/json" } }
  );
});
