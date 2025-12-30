import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// JWT secret for local tokens - should be set in environment
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = '8h'; // Local tokens expire in 8 hours

/**
 * Create local authentication routes
 * @param {import('../db/interface.js').DatabaseAdapter} db
 */
export function createLocalAuthRoutes(db) {
  const router = Router();

  /**
   * POST /api/auth/login
   * Authenticate local user with email and password
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find user by email
      const user = await db.get(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND auth_type = 'local'",
        [email]
      );

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.is_active) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      if (!user.password_hash) {
        return res.status(401).json({ message: 'Account not set up for local login' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          sub: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          auth_type: 'local',
          iss: 'baristacms-local',
          aud: 'baristacms-local',
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Check if user must change password
      const mustChangePassword = user.must_change_password === 1;

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        mustChangePassword,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  /**
   * POST /api/auth/change-password
   * Change password for local user (requires authentication)
   */
  router.post('/change-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET, {
          issuer: 'baristacms-local',
          audience: 'baristacms-local',
        });
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      // Get user
      const user = await db.get(
        "SELECT * FROM users WHERE id = ? AND auth_type = 'local'",
        [decoded.sub]
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // If user has a password, verify current password (skip for first-time setup)
      if (user.password_hash && !user.must_change_password) {
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required' });
        }
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ message: 'Current password is incorrect' });
        }
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear must_change_password flag
      await db.run(
        'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, user.id]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  /**
   * POST /api/auth/verify
   * Verify if a local token is still valid
   */
  router.post('/verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ valid: false, message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET, {
          issuer: 'baristacms-local',
          audience: 'baristacms-local',
        });

        // Verify user still exists and is active
        const user = await db.get(
          "SELECT id, email, name, role, is_active FROM users WHERE id = ? AND auth_type = 'local'",
          [decoded.sub]
        );

        if (!user || !user.is_active) {
          return res.status(401).json({ valid: false, message: 'User not found or inactive' });
        }

        res.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        });
      } catch (err) {
        return res.status(401).json({ valid: false, message: 'Invalid or expired token' });
      }
    } catch (error) {
      console.error('Token verify error:', error);
      res.status(500).json({ valid: false, message: 'Verification failed' });
    }
  });

  return router;
}

/**
 * Verify a local JWT token
 * @param {string} token
 * @returns {Promise<object>} decoded token payload
 */
export function verifyLocalToken(token) {
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
          resolve(decoded);
        }
      }
    );
  });
}

/**
 * Hash a password
 * @param {string} password
 * @returns {Promise<string>} hashed password
 */
export async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export default { createLocalAuthRoutes, verifyLocalToken, hashPassword };
