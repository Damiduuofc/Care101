import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  let token = req.header("Authorization");

  // Also check x-auth-token for admin/dashboard compatibility
  if (!token) {
    token = req.header("x-auth-token");
  }

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const tokenString = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id, role, ... }
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};

// Check if user has specific roles
// Usage: authorize('system_admin', 'receptionist') or authorize(['system_admin', 'receptionist'])
export const authorize = (...roles) => {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        msg: `User role ${req.user?.role || 'unknown'} is not authorized to access this route` 
      });
    }
    next();
  };
};
