/**
 * User Routes
 * Handles user management, authentication, and permissions
 */

import { Router } from 'express';

export function createUserRoutes(db) {
  const router = Router();

  // Get current user (creates if not exists)
  router.get('/me', async (req, res) => {
    try {
      const email = req.user?.email;
      console.log('GET /users/me - email from token:', email);

      if (!email) {
        return res.status(401).json({ message: 'User email not found in token' });
      }

      // Try exact match first
      let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

      // If not found, try case-insensitive match
      if (!user) {
        user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        if (user) {
          console.log('Found user with case-insensitive match:', user.email);
        }
      }

      if (!user) {
        // Create user with default role
        console.log('Creating new user for email:', email);
        const result = await db.run(
          `INSERT INTO users (email, name, role, is_active) VALUES (?, ?, 'user', 1)`,
          [email, req.user?.name || email]
        );
        user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
      }

      console.log('Returning user:', user.email, 'role:', user.role);
      res.json(user);
    } catch (error) {
      console.error('Error in /users/me:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all users
  router.get('/', async (req, res) => {
    try {
      const users = await db.all('SELECT * FROM users ORDER BY name');
      res.json(users);
    } catch (error) {
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

      const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
      res.json(user);
    } catch (error) {
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
