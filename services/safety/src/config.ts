import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4400', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/corporate_shuttle',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '5432', 10),
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  dbName: process.env.DB_NAME || 'corporate_shuttle',
  wsTicketTtlSec: parseInt(process.env.WS_TICKET_TTL_SEC || '30', 10),
  heartbeatIntervalMs: 30000,
  maxMissedPongs: 2,
  rateLimitPerSec: 2,
  maxPayloadBytes: 2048,
  otpSecret: process.env.OTP_SECRET || 'corporate-otp-secret-hmac-key-2026',
  otpTtlMinutes: 10,
  maxOtpAttempts: 5,
};
