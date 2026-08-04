import NfcManager, { NfcTech } from "react-native-nfc-manager";

export type NfcReadResult = {
  success: boolean;
  tagId?: string;
  error?: string;
};

export async function isNfcSupported(): Promise<boolean> {
  return NfcManager.isSupported();
}

export async function isNfcEnabled(): Promise<boolean> {
  return NfcManager.isEnabled();
}

export async function startNfcSession(): Promise<void> {
  await NfcManager.start();
}

export async function stopNfcSession(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {}
}

// Baca tag ID (UID) dari NFC tag — NTAG 215 support
export async function readNfcTag(): Promise<NfcReadResult> {
  try {
    await NfcManager.requestTechnology(NfcTech.NfcA);
    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest();
    if (tag?.id) {
      return { success: true, tagId: tag.id.toUpperCase() };
    }
    return { success: false, error: "Tag tidak memiliki ID" };
  } catch (e: any) {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    return { success: false, error: e?.message || "Gagal membaca tag" };
  }
}

// Baca URL dari NDEF (untuk QR mapping / data NDEF)
export async function readNdefUrl(): Promise<NfcReadResult> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest();
    const ndef = tag?.ndefMessage?.[0]?.payload;
    if (ndef) {
      // NDEF payload format: [0x03] <length> <text/url>
      const bytes = Array.from(ndef);
      const url = String.fromCharCode(...bytes.slice(3)).replace(/^https?:\/\//, "");
      return { success: true, tagId: url };
    }
    return { success: false, error: "Tag tidak memiliki NDEF URL" };
  } catch (e: any) {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    return { success: false, error: e?.message || "Gagal membaca NDEF" };
  }
}
