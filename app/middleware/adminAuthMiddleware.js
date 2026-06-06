const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const UserModel = require("../model/user.model")

const adminAuthCheck = async (req, res, next) => {
  const accessToken = req.cookies?.adminAccessToken;
  const refreshToken = req.cookies?.adminRefreshToken;

  //  No tokens at all
  if (!accessToken && !refreshToken) {
    return res.redirect("/admin/login-view");
  }

  //  Try ACCESS TOKEN
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);

      req.admin = decoded;
      return next();
    } catch (err) {
      // expired → move to refresh
    }
  }

  //  Try REFRESH TOKEN
  if (!refreshToken) {
    return res.redirect("/admin/login-view");
  }

  try {
    const decodedRefresh = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET_KEY,
    );

    const user = await UserModel.findById(decodedRefresh.userId);

    //  Token mismatch (VERY IMPORTANT SECURITY CHECK)
    if (!user || !bcrypt.compare(refreshToken, user.refreshToken)) {
      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return res.redirect("/admin/login-view");
    }

    // Generate NEW access token
    const newAccessToken = jwt.sign(
      {
        adminName: user.name,
        userId: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1m" },
    );

    //  Set new access token
    res.cookie("adminAccessToken", newAccessToken, {
      httpOnly: true,
      maxAge: 1 * 60 * 1000,
    });

    req.admin = {
      adminName: user.name,
      userId: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture
    }; //pass user data to admin

    return next();
  } catch (error) {
    res.clearCookie("adminAccessToken");
    res.clearCookie("adminRefreshToken");
    return res.redirect("/admin/login-view");
  }
};


module.exports = adminAuthCheck
