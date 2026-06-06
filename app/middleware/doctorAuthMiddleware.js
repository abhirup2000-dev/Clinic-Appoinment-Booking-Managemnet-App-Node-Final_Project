const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const UserModel = require("../model/user.model");

const doctorAuthCheck = async (req, res, next) => {
  const accessToken = req.cookies?.doctorAccessToken;
  const refreshToken = req.cookies?.doctorRefreshToken;

  if (!accessToken && !refreshToken) {
    return res.redirect("/doctor/login-view");
  }

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
      req.doctor = decoded;
      return next();
    } catch (err) {
      // Expired, try to refresh
    }
  }

  if (!refreshToken) {
    return res.redirect("/doctor/login-view");
  }

  try {
    const decodedRefresh = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET_KEY
    );

    const user = await UserModel.findById(decodedRefresh.userId);

    if (!user || user.refreshToken !== refreshToken || user.role !== "doctor") {
      res.clearCookie("doctorAccessToken");
      res.clearCookie("doctorRefreshToken");
      return res.redirect("/doctor/login-view");
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        doctorName: user.name,
        userId: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.cookie("doctorAccessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
    });

    req.doctor = {
      doctorName: user.name,
      userId: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture,
    };

    return next();
  } catch (error) {
    res.clearCookie("doctorAccessToken");
    res.clearCookie("doctorRefreshToken");
    return res.redirect("/doctor/login-view");
  }
};

module.exports = doctorAuthCheck;
