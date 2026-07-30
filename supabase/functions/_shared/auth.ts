import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function getUserRole(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload?.sub;
    if (!userId) return null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { authorization: `Bearer ${token}` } } }
    );

    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", userId)
      .single();

    return dbUser?.role ?? null;
  } catch {
    return null;
  }
}

export async function requireRole(req: Request, ...roles: string[]): Promise<Response | null> {
  const userRole = await getUserRole(req);

  if (!userRole) {
    return new Response(
      JSON.stringify({ error: "Tidak terautentikasi" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!roles.includes(userRole)) {
    return new Response(
      JSON.stringify({ error: "Akses ditolak: peran tidak sesuai" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null;
}

export function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
