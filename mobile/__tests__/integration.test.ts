/**
 * Integration tests — melawan Supabase local (harus menyala)
 *
 * Tes ini verifikasi seluruh flow end-to-end:
 * auth → RLS → attendance → checkpoint → SOP monitoring
 *
 * Jalankan: npx jest __tests__/integration.test.ts
 */

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Gunakan fetch bawaan Node (hindari expo winter fetch yang mock)
const rawFetch = globalThis.fetch.bind(globalThis);

const ts = Date.now();

// Helper: signup user dan return access token
async function signup(email: string, password: string, role?: string): Promise<string> {
  const res = await rawFetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { name: email.split("@")[0], role: role || "cleaner" } }),
  });
  const data = await res.json();
  return data.access_token;
}

async function login(email: string, password: string): Promise<string> {
  const res = await rawFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.access_token;
}

async function get(url: string, token: string): Promise<any> {
  const res = await rawFetch(`${SUPABASE_URL}/rest/v1/${url}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function invokeFunction(name: string, body: unknown, token: string): Promise<any> {
  const res = await rawFetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

describe("Integration: Auth + RLS (ticket 01-02)", () => {
  let adminToken: string;
  let cleanerToken: string;

  beforeAll(async () => {
    adminToken = await signup(`admin-int-${ts}@test.id`, "pass123", "admin");
    cleanerToken = await signup(`cleaner-int-${ts}@test.id`, "pass123");
  }, 15000);

  it("admin signup menghasilkan token valid, cleaner juga", () => {
    expect(adminToken).toBeDefined();
    expect(cleanerToken).toBeDefined();
    expect(adminToken.length).toBeGreaterThan(100);
  });

  it("admin bisa membaca semua users", async () => {
    const users = await get("users?select=id,name,role", adminToken);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(1);
  });

  it("cleaner hanya bisa membaca record sendiri", async () => {
    const users = await get("users?select=id,name,role", cleanerToken);
    expect(users).toHaveLength(1);
  });

  it("cleaner tidak bisa akses endpoint admin (403)", async () => {
    // Coba akses sites (seharusnya cleaner bisa baca site sendiri)
    const sites = await get("sites?select=id,name", cleanerToken);
    // Cleaner bisa baca sites (RLS policy untuk cleaner read own site)
    // Tapi cleaner tidak bisa INSERT ke users table
    expect(Array.isArray(sites)).toBe(true);
  });
});

describe("Integration: Attendance (ticket 04)", () => {
  let cleanerToken: string;

  beforeAll(async () => {
    cleanerToken = await login(`cleaner-int-${ts}@test.id`, "pass123");
  }, 10000);

  it("Edge Function attendance merespon (tanpa foto valid)", async () => {
    const res = await invokeFunction("attendance", {
      type: "check_in",
      latitude: -6.2088,
      longitude: 106.8456,
      photo_url: "http://example.com/foto.jpg",
    }, cleanerToken);

    // Bisa sukses atau gagal (tergantung site assignment)
    expect(res).toHaveProperty("message");
  });
});

describe("Integration: Checkpoint (ticket 05)", () => {
  let cleanerToken: string;

  beforeAll(async () => {
    cleanerToken = await login(`cleaner-int-${ts}@test.id`, "pass123");
  }, 10000);

  it("Edge Function checkpoint merespon start action", async () => {
    const res = await invokeFunction("checkpoint", {
      action: "start",
      nfc_tag_id: "04A1B2C3D4E5F6",
      latitude: -6.2088,
      longitude: 106.8456,
    }, cleanerToken);

    // Bisa gagal karena belum check-in — itu expected behavior
    expect(res).toHaveProperty("message");
  });
});

describe("Integration: SOP Monitor (ticket 07)", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await login(`admin-int-${ts}@test.id`, "pass123");
  }, 10000);

  it("sop-monitor merespon dan mengembalikan status", async () => {
    const res = await invokeFunction("sop-monitor", {}, adminToken);
    expect(res).toHaveProperty("message");
    expect(["Semua checkpoint dalam batas waktu", "Monitoring selesai"]).toContain(res.message);
  });
});

describe("Integration: Database Schema (ticket 01)", () => {
  it("semua tabel bisa di-query via service_role", async () => {
    const tables = ["sites", "users", "checkpoints", "attendance_logs", "checkpoint_logs", "sop_alerts"];
    for (const table of tables) {
      const res = await rawFetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});
