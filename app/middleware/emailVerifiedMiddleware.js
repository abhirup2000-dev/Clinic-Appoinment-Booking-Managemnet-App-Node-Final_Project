const { apiAuthCheck, restrictTo } = require("./apiAuthMiddleware");
const UserModel = require("../model/user.model");

/**
 * Middleware to ensure a patient has verified their email address via OTP.
 * Apply this to routes where verified email is strictly required (e.g. booking an appointment).
 */
const requireEmailVerified = async (req, res, next) => {
  try {
    // Only patients need email verification in this flow (doctors/admins are verified by admin creation)
    if (req.user && req.user.role === "patient") {
      const user = await UserModel.findById(req.user.userId);
      if (!user || !user.isVerified) {
        return res.status(403).json({
          success: false,
          message: "Email verification required. Please verify your email via OTP to access this feature.",
          requiresVerification: true,
        });
      }
    }
    next();
  } catch (error) {
    console.error("Email verification middleware error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during verification check." });
  }
};

module.exports = {
  requireEmailVerified,
};
