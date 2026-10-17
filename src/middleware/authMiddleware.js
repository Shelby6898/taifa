const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../config/jwt");

/*
|--------------------------------------------------------------------------
| AUTHENTICATE USER
|--------------------------------------------------------------------------
*/


exports.authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const parts = authHeader.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer" ||
      !parts[1]
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization header"
      });
    }

    const token = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET);

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

/*
|--------------------------------------------------------------------------
| AUTHORIZE WRITE (excludes super-admin - read-only oversight role)
| Use for POST/PUT/PATCH/DELETE routes. Super-admin can still read
| via authorizeRoles, but cannot perform write operations on tenant data.
|--------------------------------------------------------------------------
*/

exports.authorizeWrite = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === "super-admin") {
      return res.status(403).json({
        success: false,
        message: "Super-admin has read-only access to organization data. Write operations must be performed by an organization admin."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  };
};
