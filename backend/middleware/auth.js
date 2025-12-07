import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    // Remove "Bearer " if present
    const tokenString = token.startsWith("Bearer ") ? token.slice(7, token.length) : token;
    
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    req.user = decoded; // Adds user ID to the request
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};