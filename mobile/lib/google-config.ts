// Konfigurasi Google Sign-In (native).
//
// GOOGLE_WEB_CLIENT_ID: OAuth client WEB yang dipakai Supabase — audience dari
// ID token yang diminta via requestIdToken(). JANGAN diganti.
//
// Android OAuth client (tipe ANDROID, package com.harlirudi.facilityos + SHA-1
// cert APK) TIDAK perlu diisi nilainya di sini — dipakai Play Services untuk
// memvalidasi identitas app. Buat di Google Cloud Console:
//   https://console.cloud.google.com/apis/credentials
//   → Create Credentials → OAuth client ID → Android
//   Package name: com.harlirudi.facilityos
//   SHA-1: (lihat output scripts/apk-signing-cert.sh / keytool keystore)

export const GOOGLE_WEB_CLIENT_ID =
  "424874598334-93696k6ja8cec2gpkngp6meo31nmmoti.apps.googleusercontent.com";
