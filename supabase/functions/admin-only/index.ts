import { requireRole, ok } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const unauthorized = requireRole(req, "admin", "supervisor");
  if (unauthorized) return unauthorized;

  return ok({ message: "Akses diizinkan", role: "admin/supervisor" });
});
