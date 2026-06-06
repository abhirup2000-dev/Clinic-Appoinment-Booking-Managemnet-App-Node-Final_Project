const UserModel = require("../model/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { sendEmail } = require("../config/emailconfig");
const otpService = require("../services/otpService");

class apiAuthController {
  async apiRegister(req, res) {
    try {
      const {
        name,
        email,
        password,
        phone,
        role,
        gender,
        age,
        clinic,
        specialization,
      } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          message: "Missing required registration parameters",
        });
      }

      const exists = await UserModel.findOne({ email });
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Email is already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        phone: phone || "",
        role,
        gender: gender || "",
        age: age ? parseInt(age) : null,
        clinic: clinic ? new mongoose.Types.ObjectId(clinic) : null,
        specialization: specialization || "",
        profilePicture: req.file
          ? req.file.path
          : "https://placehold.co/150x150?text=" + name.charAt(0),
        publicId: req.file ? req.file.filename : "",
      });

      // If user is a patient, trigger OTP verification flow
      if (role === "patient") {
        const plainOtp = await otpService.createAndSaveOtp(newUser._id);
        await otpService.sendOtpEmail(email, name, plainOtp);
        
        return res.status(201).json({
          success: true,
          message: "Registration successful. Please verify your email.",
          requiresVerification: true,
          data: {
            userId: newUser._id,
            email: newUser.email,
          },
        });
      }

      // For doctors/admins created by super_admin
      // (Normally this happens via admin panel, not public register, but keeping original fallback)
      return res.status(201).json({
        success: true,
        message: "Registration completed successfully",
        data: {
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error("API Register Error:", error);
      return res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message,
      });
    }
  }

  async apiLogin(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ success: false, message: "Email and password are required" });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid email credentials" });
      }

      if (user.status === "blocked") {
        return res.status(403).json({
          success: false,
          message: "This user profile has been suspended",
        });
      }

      // Force patient to verify email before login
      if (user.role === "patient" && !user.isVerified) {
        return res.status(403).json({
          success: false,
          message: "Please verify your email address before logging in",
          requiresVerification: true,
          userId: user._id,
          email: user.email
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid password credentials" });
      }

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          profilePicture: user.profilePicture,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "24h" },
      );

      // Store refresh token
      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET_KEY,
        { expiresIn: "7d" },
      );

      user.refreshToken = refreshToken;
      await user.save();

      // Set cookie based on role
      const cookieName =
        user.role === "super_admin"
          ? "adminAccessToken"
          : user.role === "doctor"
            ? "doctorAccessToken"
            : "patientAccessToken";
      const refreshCookieName =
        user.role === "super_admin"
          ? "adminRefreshToken"
          : user.role === "doctor"
            ? "doctorRefreshToken"
            : "patientRefreshToken";

      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.cookie(refreshCookieName, refreshToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        message: "Successfully logged in",
        token,
        user: {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
        },
      });
    } catch (error) {
      console.error("API Login Error:", error);
      return res.status(500).json({
        success: false,
        message: "Login execution failure",
        error: error.message,
      });
    }
  }

  async apiForgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "Email is required" });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account with that email exists",
        });
      }

      // Generate a random token
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 Hour

      await user.save();

      const resetURL = `${req.protocol}://${req.get("host")}/api/auth/reset-password-view?token=${resetToken}`;

      await sendEmail({
        to: user.email,
        subject: "CareConnect Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4f46e5;">Reset Your Password</h2>
            <p>You requested a password reset for your CareConnect account.</p>
            <p>Please click the button below to secure your credentials (valid for 1 hour):</p>
            <div style="margin: 25px 0;">
              <a href="${resetURL}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>If you did not request this password reset, please ignore this email.</p>
            <br>
            <p>Best regards,<br>CareConnect Team</p>
          </div>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "Password reset token successfully dispatched to email",
        token: resetToken, // Returned for sandbox testing ease
      });
    } catch (error) {
      console.error("API Forgot Password Error:", error);
      return res.status(500).json({
        success: false,
        message: "Forgot password operation failed",
        error: error.message,
      });
    }
  }

  async apiResetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res
          .status(400)
          .json({ success: false, message: "Token and password are required" });
      }

      const user = await UserModel.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Password reset token is invalid or has expired",
        });
      }

      user.password = await bcrypt.hash(password, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Password has been successfully updated",
      });
    } catch (error) {
      console.error("API Reset Password Error:", error);
      return res.status(500).json({
        success: false,
        message: "Reset password operation failed",
        error: error.message,
      });
    }
  }

  async apiGetProfile(req, res) {
    try {
      const userId = new mongoose.Types.ObjectId(req.user.userId);

      // STRICTLY use MongoDB Aggregation instead of populate
      const profile = await UserModel.aggregate([
        { $match: { _id: userId } },
        {
          $lookup: {
            from: "clinics",
            localField: "clinic",
            foreignField: "_id",
            as: "clinicDetails",
          },
        },
        {
          $unwind: {
            path: "$clinicDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            password: 0,
            refreshToken: 0,
            resetPasswordToken: 0,
            resetPasswordExpires: 0,
          },
        },
      ]);

      if (profile.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User profile not found" });
      }

      return res.status(200).json({
        success: true,
        data: profile[0],
      });
    } catch (error) {
      console.error("API Get Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load profile details",
        error: error.message,
      });
    }
  }

  async apiUpdateProfile(req, res) {
    try {
      const { name, phone, gender, age, specialization, password, isFirstLogin } = req.body;
      const user = await UserModel.findById(req.user.userId);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.gender = gender || user.gender;
      user.age = age ? parseInt(age) : user.age;
      user.specialization = specialization || user.specialization;

      if (password) {
        user.password = await bcrypt.hash(password, 10);
      }
      
      if (isFirstLogin !== undefined) {
        // Handle boolean parsing from form-data if needed
        user.isFirstLogin = isFirstLogin === 'false' ? false : isFirstLogin === 'true' ? true : isFirstLogin;
      }

      if (req.file) {
        user.profilePicture = req.file.path;
        user.publicId = req.file.filename;
      }

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Profile details updated successfully",
        data: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profilePicture: user.profilePicture,
          gender: user.gender,
          age: user.age,
        },
      });
    } catch (error) {
      console.error("API Update Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update profile details",
        error: error.message,
      });
    }
  }

  async apiVerifyOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email and OTP are required" });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const verificationResult = await otpService.verifyUserOtp(user._id, otp);
      if (!verificationResult.valid) {
        return res.status(400).json({ success: false, message: verificationResult.reason });
      }

      user.isVerified = true;
      await user.save();

      // Send Welcome Email
      const { welcomeEmailTemplate } = require("../services/emailTemplates");
      sendEmail({
        to: user.email,
        subject: "Welcome to CareConnect!",
        html: welcomeEmailTemplate(user.name, user.role),
      });

      return res.status(200).json({
        success: true,
        message: "Email verified successfully. You can now log in.",
      });
    } catch (error) {
      console.error("Verify OTP Error:", error);
      return res.status(500).json({ success: false, message: "OTP verification failed" });
    }
  }

  async apiResendOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "Email is already verified" });
      }

      const plainOtp = await otpService.createAndSaveOtp(user._id);
      await otpService.sendOtpEmail(user.email, user.name, plainOtp);

      return res.status(200).json({
        success: true,
        message: "A new OTP has been sent to your email",
      });
    } catch (error) {
      console.error("Resend OTP Error:", error);
      return res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
  }
}

module.exports = new apiAuthController();
