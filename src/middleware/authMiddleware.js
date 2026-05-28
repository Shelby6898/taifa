const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "secret_key";

/*
|--------------------------------------------------------------------------
| AUTHENTICATE USER
|--------------------------------------------------------------------------
*/

exports.authenticate = (req, res, next) => {
  try {

    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded =
      jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

/*
|--------------------------------------------------------------------------
| AUTHORIZE ROLES
|--------------------------------------------------------------------------
*/

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  };
};
