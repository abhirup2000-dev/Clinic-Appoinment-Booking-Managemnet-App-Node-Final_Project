const jwt = require("jsonwebtoken");
const UserModel = require("../model/user.model");

const apiAuthCheck = async (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } 
    // Fallback to role-specific cookies
    else {
      token = req.cookies?.patientAccessToken || req.cookies?.doctorAccessToken || req.cookies?.adminAccessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing or unauthorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    
    // Find user to verify status
    const user = await UserModel.findById(decoded.userId);
    if (!user || user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "User is blocked or does not exist",
      });
    }

    req.user = {
      userId: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profilePicture: user.profilePicture,
    };

    next();
  } catch (error) {
    console.error("API Auth Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid token",
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role) && !(req.user.role === "super_admin" && roles.includes("admin"))) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this operation",
      });
    }
    next();
  };
};

module.exports = {
  apiAuthCheck,
  restrictTo,
};
