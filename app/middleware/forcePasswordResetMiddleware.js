const UserModel = require("../model/user.model");

/**
 * Middleware to force doctors to change their password on first login.
 * This ensures credentials generated and emailed by admins are rotated immediately.
 */
const requirePasswordReset = async (req, res, next) => {
  try {
    if (req.user && req.user.role === "doctor") {
      const user = await UserModel.findById(req.user.userId);
      if (user && user.isFirstLogin) {
        // If it's an API request, return 403
        if (req.originalUrl.startsWith("/api/")) {
          return res.status(403).json({
            success: false,
            message: "Password reset required. Please change your password to continue.",
            requiresPasswordReset: true,
          });
        }
        // If it's a page request, redirect to the change password page
        // But prevent infinite redirect loop if they are already on that page
        if (!req.originalUrl.includes("/change-password")) {
          return res.redirect("/doctor/change-password");
        }
      }
    }
    next();
  } catch (error) {
    console.error("Force password reset middleware error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during password check." });
  }
};

module.exports = {
  requirePasswordReset,
};
