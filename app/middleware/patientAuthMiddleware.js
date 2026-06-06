const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const UserModel = require("../model/user.model");

const patientAuthCheck = async (req, res, next) => {
  const accessToken = req.cookies?.patientAccessToken;
  const refreshToken = req.cookies?.patientRefreshToken;

  if (!accessToken && !refreshToken) {
    return res.redirect("/patient/login-view");
  }

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
      req.patient = decoded;
      return next();
    } catch (err) {
      // Expired, try to refresh
    }
  }

  if (!refreshToken) {
    return res.redirect("/patient/login-view");
  }

  try {
    const decodedRefresh = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET_KEY
    );

    const user = await UserModel.findById(decodedRefresh.userId);

    if (!user || user.refreshToken !== refreshToken || user.status === "blocked") {
      res.clearCookie("patientAccessToken");
      res.clearCookie("patientRefreshToken");
      return res.redirect("/patient/login-view");
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        patientName: user.name,
        userId: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.cookie("patientAccessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
    });

    req.patient = {
      patientName: user.name,
      userId: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture,
    };

    return next();
  } catch (error) {
    res.clearCookie("patientAccessToken");
    res.clearCookie("patientRefreshToken");
    return res.redirect("/patient/login-view");
  }
};

module.exports = patientAuthCheck;
