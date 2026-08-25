"use server";

// Export ke Google Sheets via Service Account (Google Sheets API).
// Env yang dibutuhkan (Vercel):
//   GOOGLE_SHEETS_CLIENT_EMAIL   — email service account (…@….iam.gserviceaccount.com)
//   GOOGLE_SHEETS_PRIVATE_KEY    — private key dari JSON service account (PEM)
//   GOOGLE_SHEETS_SPREADSHEET_ID — ID spreadsheet target (dari URL: /spreadsheets/d/<ID>/edit)

import crypto from "crypto";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

// Key disimpan sebagai BASE64 (GOOGLE_SHEETS_PRIVATE_KEY_B64) agar bebas
// masalah escaping newline di env var. Fallback: GOOGLE_SHEETS_PRIVATE_KEY
// (literal \n diubah jadi newline).
function resolvePrivateKey(): string {
  const b64 = process.env.GOOGLE_SHEETS_PRIVATE_KEY_B64;
  if (b64) {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  const raw = process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? "";
  return raw
    .replace(/\\n/g, "\n")
    .replace(/^"|"$/g, "")
    .replace(/\\"/g, '"');
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = resolvePrivateKey();
  if (!email || !key) {
    throw new Error("Google Sheets belum dikonfigurasi (env service account).");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  let signature: string;
  try {
    signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(key);
  } catch (e: any) {
    throw new Error(
      `Sign gagal: b64=${!!process.env.GOOGLE_SHEETS_PRIVATE_KEY_B64} email=${!!email} keyLen=${key.length} head=${key.slice(0, 40)} :: ${e.message}`
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signingInput + "." + base64url(signature),
    }),
  });
  if (!res.ok) throw new Error(`Gagal mendapatkan token Google Sheets (${res.status})`);
  const data = await res.json();
  return data.access_token as string;
}

// Tambahkan baris ke spreadsheet. `range` misal "Absensi!A1" (append di bawah data yang ada).
export async function appendToSheet(range: string, values: string[][]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID belum di-set.");

  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal menulis ke Google Sheets (${res.status}): ${body.slice(0, 300)}`);
  }
}
