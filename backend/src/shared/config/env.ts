import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/upi_qr_monitor"),
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  jwtTtl: process.env.JWT_TTL ?? "12h",
  seedOnStart: (process.env.SEED_ON_START ?? "true") === "true",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@company.local",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
  adminName: process.env.ADMIN_NAME ?? "Admin",
  employeePassword: process.env.EMPLOYEE_PASSWORD ?? "employee123",
  appPublicUrl: process.env.APP_PUBLIC_URL ?? "http://localhost:5174",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "UPI QR Monitor <onboarding@resend.dev>",
};
