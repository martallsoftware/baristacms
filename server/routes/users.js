/**
 * User Routes
 * Handles user management, authentication, and permissions
 */

import { Router } from 'express';
import { hashPassword } from './localAuth.js';

export function createUserRoutes(db) {
  const router = Router();

  // Get current user (creates if not exists for M365 users)
  router.get('/me', async (req, res) => {
    try {
      const email = req.user?.email;
      const authType = req.user?.authType || 'm365';
      console.log('GET /users/me - email from token:', email, 'authType:', authType);

      if (!email) {
        return res.status(401).json({ message: 'User email not found in token' });
      }

      let user = null;

      // For local users, always filter by auth_type to avoid matching M365 users with same email
      if (authType === 'local') {
        // Try exact match first, then case-insensitive
        user = await db.get("SELECT * FROM users WHERE email = ? AND auth_type = 'local'", [email]);
        if (!user) {
          user = await db.get("SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND auth_type = 'local'", [email]);
        }
        if (!user) {
          return res.status(401).json({ message: 'Local user not found' });
        }
      } else {
        // M365 users - try exact match first
        user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        // If not found, try case-insensitive match
        if (!user) {
          user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
          if (user) {
            console.log('Found user with case-insensitive match:', user.email);
          }
        }

        // Auto-create for M365 users
        if (!user) {
          console.log('Creating new M365 user for email:', email);
          const result = await db.run(
            `INSERT INTO users (email, name, role, is_active, auth_type) VALUES (?, ?, 'user', 1, 'm365')`,
            [email, req.user?.name || email]
          );
          user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
        }
      }

      console.log('Returning user:', user.email, 'role:', user.role, 'auth_type:', user.auth_type);
      // Don't return password_hash to frontend
      const { password_hash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error('Error in /users/me:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all users
  router.get('/', async (req, res) => {
    try {
      const users = await db.all('SELECT id, email, name, role, is_active, auth_type, must_change_password, created_at, updated_at FROM users ORDER BY name');
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create local user
  router.post('/', async (req, res) => {
    try {
      const { email, name, role, password } = req.body;

      if (!email || !name) {
        return res.status(400).json({ message: 'Email and name are required' });
      }

      // Check if user already exists
      const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      if (existing) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Hash password if provided
      let passwordHash = null;
      let mustChangePassword = 0;
      if (password) {
        passwordHash = await hashPassword(password);
        mustChangePassword = 1; // Force password change on first login
      }

      const result = await db.run(
        `INSERT INTO users (email, name, role, is_active, auth_type, password_hash, must_change_password)
         VALUES (?, ?, ?, 1, 'local', ?, ?)`,
        [email, name, role || 'user', passwordHash, mustChangePassword]
      );

      const user = await db.get(
        'SELECT id, email, name, role, is_active, auth_type, must_change_password, created_at FROM users WHERE id = ?',
        [result.lastInsertRowid]
      );
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, role, is_active } = req.body;

      await db.run(
        `UPDATE users SET name = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, role, is_active ? 1 : 0, id]
      );

      const user = await db.get('SELECT id, email, name, role, is_active, auth_type, must_change_password, created_at, updated_at FROM users WHERE id = ?', [id]);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reset password for local user (admin function)
  router.put('/:id/reset-password', async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      // Check user exists and is local
      const user = await db.get('SELECT id, auth_type FROM users WHERE id = ?', [id]);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (user.auth_type !== 'local') {
        return res.status(400).json({ message: 'Cannot reset password for M365 users' });
      }

      // Hash and update password
      const passwordHash = await hashPassword(password);
      await db.run(
        'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, id]
      );

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete user
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM users WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user permissions
  router.get('/:id/permissions', async (req, res) => {
    try {
      const { id } = req.params;
      const permissions = await db.all('SELECT * FROM user_permissions WHERE user_id = ?', [id]);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check permission for current user
  router.get('/check', async (req, res) => {
    // This is accessed via /api/permissions/check
    try {
      const { module } = req.query;
      const email = req.user?.email;

      if (!email || !module) {
        return res.json({ permission: 'none' });
      }

      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        return res.json({ permission: 'none' });
      }

      // Admins have full access
      if (user.role === 'admin') {
        return res.json({ permission: 'admin' });
      }

      // Check module-specific permission
      const perm = await db.get(
        'SELECT permission FROM user_permissions WHERE user_id = ? AND module = ?',
        [user.id, module]
      );

      res.json({ permission: perm?.permission || 'none' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user permissions
  router.put('/:id/permissions', async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions, module, permission } = req.body;

      // Support both formats:
      // 1. { permissions: [...] } - replace all permissions
      // 2. { module, permission } - update single permission

      if (permissions && Array.isArray(permissions)) {
        // Bulk update - delete all and re-insert
        await db.run('DELETE FROM user_permissions WHERE user_id = ?', [id]);

        for (const perm of permissions) {
          if (perm.permission && perm.permission !== 'none') {
            await db.run(
              `INSERT INTO user_permissions (user_id, module, permission) VALUES (?, ?, ?)`,
              [id, perm.module, perm.permission]
            );
          }
        }
      } else if (module && permission) {
        // Single permission update
        // Delete existing permission for this module
        await db.run('DELETE FROM user_permissions WHERE user_id = ? AND module = ?', [id, module]);

        // Insert new permission if not 'none'
        if (permission !== 'none') {
          await db.run(
            `INSERT INTO user_permissions (user_id, module, permission) VALUES (?, ?, ?)`,
            [id, module, permission]
          );
        }
      }

      const updatedPermissions = await db.all('SELECT * FROM user_permissions WHERE user_id = ?', [id]);
      res.json(updatedPermissions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createUserRoutes;
