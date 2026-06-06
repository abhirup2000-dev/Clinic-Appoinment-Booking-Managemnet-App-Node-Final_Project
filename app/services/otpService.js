const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const OtpModel = require("../model/otp.model");
const { sendEmail } = require("../config/emailconfig");
const { otpEmailTemplate } = require("./emailTemplates");

/**
 * Generate a cryptographically secure 6-digit OTP.
 * @returns {string} 6-digit OTP string
 */
function generateOtp() {
  // Use crypto for true randomness
  const buffer = crypto.randomBytes(3);
  const otp = (parseInt(buffer.toString("hex"), 16) % 1000000)
    .toString()
    .padStart(6, "0");
  return otp;
}

/**
 * Hash the OTP using bcrypt before storing in DB.
 * @param {string} otp - Plain OTP
 * @returns {Promise<string>} Hashed OTP
 */
async function hashOtp(otp) {
  return await bcrypt.hash(otp, 10);
}

/**
 * Compare plain OTP with stored hash.
 * @param {string} plain - User-submitted OTP
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>}
 */
async function verifyOtpHash(plain, hash) {
  return await bcrypt.compare(plain, hash);
}

/**
 * Create and persist a new OTP record for a user.
 * Deletes any existing OTPs for that user first.
 * @param {string} userId - MongoDB ObjectId string
 * @returns {Promise<string>} Plain OTP (to be sent via email)
 */
async function createAndSaveOtp(userId) {
  // Delete all existing OTPs for this user (cleanup)
  await OtpModel.deleteMany({ userId });

  const plainOtp = generateOtp();
  const otpHash = await hashOtp(plainOtp);

  await OtpModel.create({
    userId,
    otpHash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  return plainOtp;
}

/**
 * Send OTP verification email to patient.
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} otp - Plain OTP
 */
async function sendOtpEmail(email, name, otp) {
  await sendEmail({
    to: email,
    subject: "🔐 CareConnect — Your Email Verification Code",
    html: otpEmailTemplate(name, otp),
  });
}

/**
 * Verify a submitted OTP against DB record.
 * @param {string} userId
 * @param {string} submittedOtp
 * @returns {{ valid: boolean, reason?: string }}
 */
async function verifyUserOtp(userId, submittedOtp) {
  const record = await OtpModel.findOne({ userId }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, reason: "No OTP found. Please request a new one." };
  }

  if (new Date() > record.expiresAt) {
    await OtpModel.deleteMany({ userId });
    return { valid: false, reason: "OTP has expired. Please request a new one." };
  }

  const isMatch = await verifyOtpHash(submittedOtp, record.otpHash);
  if (!isMatch) {
    return { valid: false, reason: "Invalid OTP. Please check and try again." };
  }

  // OTP verified — delete all OTP records for this user
  await OtpModel.deleteMany({ userId });

  return { valid: true };
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  createAndSaveOtp,
  sendOtpEmail,
  verifyUserOtp,
};
