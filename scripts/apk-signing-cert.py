#!/usr/bin/env python3
"""Cetak SHA-256 certificate dari signature block APK (v2) — untuk verifikasi
keystore yang dipakai EAS build cocok dengan assetlinks.json App Links.

Usage: python3 scripts/apk-signing-cert.py <path-ke-apk>
"""
import struct
import sys
import hashlib


def main(path: str) -> None:
    data = open(path, "rb").read()
    eocd = data.rfind(b"PK\x05\x06")
    if eocd == -1:
        print("Bukan ZIP/APK valid")
        sys.exit(1)
    cd_offset = struct.unpack("<I", data[eocd + 16:eocd + 20])[0]
    if data[cd_offset - 16:cd_offset] != b"APK Sig Block 42":
        print("APK Signing Block tidak ditemukan (v2)")
        sys.exit(1)
    size = struct.unpack("<Q", data[cd_offset - 24:cd_offset - 16])[0]
    start = cd_offset - 8 - size
    pairs = data[start + 8:cd_offset - 24]
    off = 0
    while off + 12 <= len(pairs):
        (length,) = struct.unpack("<Q", pairs[off:off + 8])
        (pid,) = struct.unpack("<I", pairs[off + 8:off + 12])
        if pid == 0x7109871A:  # APK Signature Scheme v2
            payload = pairs[off + 12:off + 12 + length]
            (signer_len,) = struct.unpack("<I", payload[:4])
            signer = payload[4:4 + signer_len]
            (signed_len,) = struct.unpack("<I", signer[:4])
            signed = signer[4:4 + signed_len]
            (digests_len,) = struct.unpack("<I", signed[:4])
            rest = signed[4 + digests_len:]
            (certs_len,) = struct.unpack("<I", rest[:4])
            certs = rest[4:4 + certs_len]
            (cert_len,) = struct.unpack("<I", certs[:4])
            cert_der = certs[4:4 + cert_len]
            digest = hashlib.sha256(cert_der).hexdigest().upper()
            print(digest)
            print(":".join(digest[i:i + 2] for i in range(0, 64, 2)))
            return
        off += 12 + length
    print("Signature block v2 tidak ditemukan")
    sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
