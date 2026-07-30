/**
 * Integration tests — Node.js murni, melawan Supabase local
 * 
 * Jalankan: node tests/integration.js
 */
const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ts = Date.now();
let passed = 0;
let failed = 0;

function test(name, fn) {
  (async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  })();
}

async function signup(email, password, role) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { name: email.split("@")[0], role: role || "cleaner" } }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Signup failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function restGet(path, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function invokeFunction(name, body, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function run() {
  console.log("\n🏗️  Integration Tests — FacilityOS MVP\n");

  // =================== Auth + RLS ===================
  console.log("📦 Auth + RLS (ticket 01-02):");
  const adminToken = await signup(`admin-int-${ts}@t.id`, "pass123", "admin");
  const cleanerToken = await signup(`cleaner-int-${ts}@t.id`, "pass123");

  test("admin signup menghasilkan token valid", () => {
    if (!adminToken || adminToken.length < 100) throw new Error("Token invalid");
  });

  test("cleaner signup menghasilkan token valid", () => {
    if (!cleanerToken || cleanerToken.length < 100) throw new Error("Token invalid");
  });

  test("admin bisa membaca semua users (> 1)", async () => {
    const users = await restGet("users?select=id,name,role", adminToken);
    if (!Array.isArray(users) || users.length < 2) throw new Error(`Expected >1 users, got ${users.length}`);
  });

  test("cleaner hanya bisa baca record sendiri (= 1)", async () => {
    const users = await restGet("users?select=id,name,role", cleanerToken);
    if (users.length !== 1) throw new Error(`Expected 1 user, got ${users.length}`);
  });

  // =================== Database Schema ===================
  console.log("\n📦 Database Schema (ticket 01):");
  const tables = ["sites", "users", "checkpoints", "attendance_logs", "checkpoint_logs", "sop_alerts"];
  for (const table of tables) {
    test(`tabel ${table} bisa di-query`, async () => {
      const data = await restGet(`${table}?limit=1`, SERVICE_KEY);
      if (!Array.isArray(data)) throw new Error(`Table ${table} not queryable`);
    });
  }

  // =================== Attendance ===================
  console.log("\n📦 Attendance (ticket 04):");
  test("Edge Function /attendance merespon (cleaner belum punya site)", async () => {
    const res = await invokeFunction("attendance", {
      type: "check_in", latitude: -6.2088, longitude: 106.8456, photo_url: "http://example.com/selfie.jpg"
    }, cleanerToken);
    // Expected: gagal karena cleaner belum di-assign ke site
    if (!res.message && !res.error) throw new Error("No response");
  });

  // =================== Checkpoint ===================
  console.log("\n📦 Checkpoint (ticket 05):");
  test("Edge Function /checkpoint merespon (cleaner belum check-in)", async () => {
    const res = await invokeFunction("checkpoint", {
      action: "start", nfc_tag_id: "04A1B2C3D4E5F6", latitude: -6.2088, longitude: 106.8456
    }, cleanerToken);
    // Expected: gagal karena cleaner belum check-in
    if (!res.message && !res.error) throw new Error("No response");
  });

  // =================== SOP Monitor ===================
  console.log("\n📦 SOP Monitor (ticket 07):");
  test("sop-monitor merespon status", async () => {
    const res = await invokeFunction("sop-monitor", {}, adminToken);
    if (!res.message) throw new Error(`No message: ${JSON.stringify(res)}`);
  });

  // Wait for async tests
  await new Promise(r => setTimeout(r, 3000));

  console.log(`\n📊 Result: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
