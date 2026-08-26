// Helper AWS Rekognition (CompareFaces) dengan SigV4 — untuk Deno edge functions.
// Kredensial dari env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.

const enc = new TextEncoder();

async function sha256hex(data: Uint8Array | string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: Uint8Array, data: Uint8Array | string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, typeof data === "string" ? enc.encode(data) : data);
  return new Uint8Array(sig);
}

function b64(data: Uint8Array): string {
  let bin = "";
  for (const b of data) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Bandingkan dua gambar (source = foto patokan, target = selfie).
// Mengembalikan kemiripan 0-100 (0 jika tidak ada wajah cocok).
export async function awsCompareFaces(
  sourceBytes: Uint8Array,
  targetBytes: Uint8Array
): Promise<{ similarity: number; error?: string }> {
  const ak = Deno.env.get("AWS_ACCESS_KEY_ID");
  const sk = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AWS_REGION") || "ap-southeast-1";
  if (!ak || !sk) return { similarity: 0, error: "AWS belum dikonfigurasi" };

  const service = "rekognition";
  const host = `rekognition.${region}.amazonaws.com`;
  const payload = JSON.stringify({
    SourceImage: { Bytes: b64(sourceBytes) },
    TargetImage: { Bytes: b64(targetBytes) },
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256hex(payload);

  const headers: Record<string, string> = {
    "content-type": "application/x-amz-json-1.1",
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "x-amz-target": "RekognitionService.CompareFaces",
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const signedHeaders = sortedKeys.join(";");
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256hex(canonicalRequest)].join("\n");

  let k = await hmac(enc.encode(`AWS4${sk}`), dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  const signature = [...(await hmac(k, stringToSign))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const authHeader = `AWS4-HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}/`, {
    method: "POST",
    headers: { ...headers, Authorization: authHeader },
    body: payload,
  });
  if (!res.ok) {
    const body = await res.text();
    return { similarity: 0, error: `AWS CompareFaces gagal (${res.status}): ${body.slice(0, 150)}` };
  }
  const data = await res.json();
  const matches = data.FaceMatches ?? [];
  return { similarity: matches.length > 0 ? Math.round(matches[0].Similarity) : 0 };
}
