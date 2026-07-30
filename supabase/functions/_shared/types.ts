export const Role = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  CLEANER: "cleaner",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const LogStatus = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;
export type LogStatus = (typeof LogStatus)[keyof typeof LogStatus];

export const LogType = {
  CLEANING: "cleaning",
  INSPECTION: "inspection",
} as const;
export type LogType = (typeof LogType)[keyof typeof LogType];

export const ScanMode = {
  NFC: "nfc",
  QR: "qr",
} as const;
export type ScanMode = (typeof ScanMode)[keyof typeof ScanMode];

export const PhotoType = {
  BEFORE: "before",
  AFTER: "after",
} as const;
export type PhotoType = (typeof PhotoType)[keyof typeof PhotoType];

export const AttendanceType = {
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
} as const;
export type AttendanceType = (typeof AttendanceType)[keyof typeof AttendanceType];

export type GeoPoint = {
  latitude: number;
  longitude: number;
};
