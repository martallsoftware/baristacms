import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Local JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Microsoft Entra (Azure AD) configuration
const TENANT_ID = process.env.AZURE_TENANT_ID || '7388d115-29cd-4cde-b8f1-78559e9476ec';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '780ae31c-468a-45ba-8a5a-976ecbe1063d';
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

// Function to create JWKS client
function createJwksClient() {
  return jwksClient({
    jwksUri: JWKS_URI,
    cache: true,
    cacheMaxAge: 600000, // 10 minutes
    cacheMaxEntries: 5,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
}

// JWKS client instance
let client = createJwksClient();

// Get signing key from JWKS
function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, null);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Recreate client to clear cache
function resetClient() {
  client = createJwksClient();
  console.log('JWKS client recreated with fresh cache');
}

// Verify Microsoft Entra token
function verifyTokenOnce(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        algorithms: ['RS256'],
        // Accept tokens for our app OR Graph API (for flexibility)
        audience: [CLIENT_ID, `api://${CLIENT_ID}`, '00000003-0000-0000-c000-000000000000'],
        issuer: [
          `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
          `https://sts.windows.net/${TENANT_ID}/`,
        ],
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

// Decode token without verification
function decodeToken(token) {
  try {
    return jwt.decode(token, { complete: true });
  } catch {
    return null;
  }
}

// Verify local JWT token
function verifyLocalToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      JWT_SECRET,
      {
        issuer: 'baristacms-local',
        audience: 'baristacms-local',
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve({ ...decoded, isLocalToken: true });
        }
      }
    );
  });
}

// Verify with retry on invalid signature (Microsoft Entra tokens)
async function verifyMsalToken(token) {
  const decoded = decodeToken(token);

  if (!decoded) {
    throw new Error('Invalid token format');
  }

  // Graph API tokens have a 'nonce' in header and use different signing
  // For these, we validate issuer/tenant but skip signature verification
  const isGraphToken = decoded.header.nonce !== undefined;

  if (isGraphToken) {
    console.log('Graph API token detected, validating issuer only');

    // Validate issuer contains our tenant
    const validIssuer = decoded.payload.iss?.includes(TENANT_ID);
    if (!validIssuer) {
      throw new Error('Invalid token issuer');
    }

    // Check token is not expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp && decoded.payload.exp < now) {
      throw new Error('Token has expired');
    }

    return decoded.payload;
  }

  // For regular tokens, do full verification
  try {
    return await verifyTokenOnce(token);
  } catch (err) {
    // If signature is invalid, reset client and retry once
    if (err.message === 'invalid signature') {
      console.log('Invalid signature detected, resetting JWKS client and retrying...');
      resetClient();
      return await verifyTokenOnce(token);
    }
    throw err;
  }
}

// Verify token (tries local first, then Microsoft Entra)
async function verifyToken(token) {
  // First, try to decode to check if it's a local token
  const decoded = decodeToken(token);

  if (decoded?.payload?.iss === 'baristacms-local') {
    // This is a local token
    return await verifyLocalToken(token);
  }

  // Try Microsoft Entra verification
  return await verifyMsalToken(token);
}

// Authentication middleware
export async function authenticate(req, res, next) {
  // Skip auth for health check
  if (req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header provided' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Invalid authorization header format. Use: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const decoded = await verifyToken(token);

    // Attach user info to request
    if (decoded.isLocalToken) {
      // Local token - user info is directly in the token
      console.log('Auth - local token for:', decoded.email);
      req.user = {
        email: decoded.email,
        name: decoded.name,
        authType: 'local',
      };
    } else {
      // Microsoft Entra token
      const email = decoded.preferred_username || decoded.email || decoded.upn;
      console.log('Auth - M365 token for:', email);
      req.user = {
        email: email,
        name: decoded.name,
        oid: decoded.oid, // Object ID
        tid: decoded.tid, // Tenant ID
        authType: 'm365',
      };
    }

    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }

    return res.status(401).json({ message: 'Authentication failed' });
  }
}

// Optional: Development mode bypass (set AUTH_BYPASS=true in .env)
export function authenticateWithBypass(req, res, next) {
  if (process.env.AUTH_BYPASS === 'true') {
    // In development, allow bypass with a mock user
    // Use AUTH_BYPASS_EMAIL env var or header to specify user
    req.user = {
      email: req.headers['x-user-email'] || process.env.AUTH_BYPASS_EMAIL || 'dev@example.com',
      name: req.headers['x-user-name'] || process.env.AUTH_BYPASS_NAME || 'Dev User',
    };
    return next();
  }

  return authenticate(req, res, next);
}

export default authenticate;
