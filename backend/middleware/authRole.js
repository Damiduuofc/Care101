import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const token = req.header("x-auth-token");

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id, role }
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};

// Check if user has specific roles
// Usage: authorize(['system_admin', 'receptionist'])
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        msg: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};