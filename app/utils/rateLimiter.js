const rateLimit = require("express-rate-limit");

/**
 * OTP Rate Limiter — Max 3 OTP requests per 15 minutes per IP.
 * Applied to /api/auth/verify-otp and /api/auth/resend-otp
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests from this IP. Please wait 15 minutes before trying again.",
  },
  skipSuccessfulRequests: false,
});

/**
 * Login Rate Limiter — Max 10 login attempts per 15 minutes per IP.
 * Prevents brute force attacks on the login endpoint.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please wait 15 minutes before trying again.",
  },
  skipSuccessfulRequests: true,
});

/**
 * General API Rate Limiter — Max 100 requests per 15 minutes per IP.
 * Applied globally to all /api routes.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
  skipSuccessfulRequests: false,
});

/**
 * Upload Rate Limiter — Max 20 upload requests per hour per IP.
 * Applied to file upload endpoints.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Upload limit reached. Please try again in an hour.",
  },
});

module.exports = {
  otpLimiter,
  loginLimiter,
  apiLimiter,
  uploadLimiter,
};
