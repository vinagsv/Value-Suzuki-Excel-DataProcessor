import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Check for token in cookies OR Authorization header
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: No Token Provided' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    // 401 (not 400) so the client's auth:session-expired handler in App.jsx
    // fires and redirects to login. A 400 was treated as a generic error and
    // left the user stuck. Distinguish expiry from a malformed/tampered token
    // for clearer client-side handling and logs.
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
};

// Middleware for Admin Access
export const checkRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: Insufficient Permissions' });
    }
    next();
  };
};