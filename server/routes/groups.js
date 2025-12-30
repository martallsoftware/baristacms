/**
 * Group Routes
 * Handles user group CRUD operations and membership management
 */

import { Router } from 'express';

export function createGroupRoutes(db) {
  const router = Router();

  // Get all groups with member, module, and menu item counts
  router.get('/', async (req, res) => {
    try {
      const groups = await db.all(`
        SELECT
          g.*,
          (SELECT COUNT(*) FROM user_group_members WHERE group_id = g.id) as member_count,
          (SELECT COUNT(*) FROM group_module_access WHERE group_id = g.id) as module_count,
          (SELECT COUNT(*) FROM group_menu_access WHERE group_id = g.id) as menu_item_count
        FROM user_groups g
        WHERE g.is_active = 1
        ORDER BY g.display_name
      `);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single group with members, modules, and menu items
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Get members
      group.members = await db.all(`
        SELECT u.id, u.email, u.name, u.role, ugm.created_at as joined_at
        FROM users u
        INNER JOIN user_group_members ugm ON ugm.user_id = u.id
        WHERE ugm.group_id = ?
        ORDER BY u.name
      `, [id]);

      // Get modules
      group.modules = await db.all(`
        SELECT m.id, m.name, m.display_name, m.icon, gma.created_at as added_at
        FROM modules m
        INNER JOIN group_module_access gma ON gma.module_id = m.id
        WHERE gma.group_id = ? AND m.is_active = 1
        ORDER BY m.display_name
      `, [id]);

      // Get menu items
      group.menuItems = await db.all(`
        SELECT mi.id, mi.name, mi.display_name, mi.icon, mi.path, gma.created_at as added_at
        FROM menu_items mi
        INNER JOIN group_menu_access gma ON gma.menu_item_id = mi.id
        WHERE gma.group_id = ? AND mi.is_active = 1
        ORDER BY mi.display_name
      `, [id]);

      res.json(group);
    } catch (error) {
      console.error('Error fetching group:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new group
  router.post('/', async (req, res) => {
    try {
      const { name, displayName, description, color } = req.body;

      if (!name || !displayName) {
        return res.status(400).json({ message: 'Name and displayName are required' });
      }

      // Create slug from name
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const result = await db.run(`
        INSERT INTO user_groups (name, display_name, description, color)
        VALUES (?, ?, ?, ?)
      `, [slug, displayName, description || null, color || null]);

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(group);
    } catch (error) {
      console.error('Error creating group:', error);
      if (error.message.includes('UNIQUE constraint failed') || error.message.includes('Duplicate entry')) {
        return res.status(400).json({ message: 'A group with this name already exists' });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Update group
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { displayName, description, color, isActive } = req.body;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      await db.run(`
        UPDATE user_groups
        SET display_name = ?, description = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        displayName ?? group.display_name,
        description ?? group.description,
        color ?? group.color,
        isActive !== undefined ? (isActive ? 1 : 0) : group.is_active,
        id
      ]);

      const updatedGroup = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      res.json(updatedGroup);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete group
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Delete group (cascades to members and module access)
      await db.run('DELETE FROM user_groups WHERE id = ?', [id]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update group members (replace all)
  router.put('/:id/members', async (req, res) => {
    try {
      const { id } = req.params;
      const { userIds } = req.body;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Delete existing members
      await db.run('DELETE FROM user_group_members WHERE group_id = ?', [id]);

      // Add new members
      if (userIds && Array.isArray(userIds)) {
        for (const userId of userIds) {
          await db.run(`
            INSERT INTO user_group_members (user_id, group_id)
            VALUES (?, ?)
          `, [userId, id]);
        }
      }

      // Return updated members
      const members = await db.all(`
        SELECT u.id, u.email, u.name, u.role
        FROM users u
        INNER JOIN user_group_members ugm ON ugm.user_id = u.id
        WHERE ugm.group_id = ?
        ORDER BY u.name
      `, [id]);

      res.json({ members });
    } catch (error) {
      console.error('Error updating group members:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update group modules (replace all)
  router.put('/:id/modules', async (req, res) => {
    try {
      const { id } = req.params;
      const { moduleIds } = req.body;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Delete existing module access
      await db.run('DELETE FROM group_module_access WHERE group_id = ?', [id]);

      // Add new module access
      if (moduleIds && Array.isArray(moduleIds)) {
        for (const moduleId of moduleIds) {
          await db.run(`
            INSERT INTO group_module_access (group_id, module_id)
            VALUES (?, ?)
          `, [id, moduleId]);
        }
      }

      // Return updated modules
      const modules = await db.all(`
        SELECT m.id, m.name, m.display_name, m.icon
        FROM modules m
        INNER JOIN group_module_access gma ON gma.module_id = m.id
        WHERE gma.group_id = ? AND m.is_active = 1
        ORDER BY m.display_name
      `, [id]);

      res.json({ modules });
    } catch (error) {
      console.error('Error updating group modules:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update group menu items (replace all)
  router.put('/:id/menu-items', async (req, res) => {
    try {
      const { id } = req.params;
      const { menuItemIds } = req.body;

      const group = await db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Delete existing menu access
      await db.run('DELETE FROM group_menu_access WHERE group_id = ?', [id]);

      // Add new menu access
      if (menuItemIds && Array.isArray(menuItemIds)) {
        for (const menuItemId of menuItemIds) {
          await db.run(`
            INSERT INTO group_menu_access (group_id, menu_item_id)
            VALUES (?, ?)
          `, [id, menuItemId]);
        }
      }

      // Return updated menu items
      const menuItems = await db.all(`
        SELECT mi.id, mi.name, mi.display_name, mi.icon, mi.path
        FROM menu_items mi
        INNER JOIN group_menu_access gma ON gma.menu_item_id = mi.id
        WHERE gma.group_id = ? AND mi.is_active = 1
        ORDER BY mi.display_name
      `, [id]);

      res.json({ menuItems });
    } catch (error) {
      console.error('Error updating group menu items:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get groups for a specific user
  router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const groups = await db.all(`
        SELECT g.*
        FROM user_groups g
        INNER JOIN user_group_members ugm ON ugm.group_id = g.id
        WHERE ugm.user_id = ? AND g.is_active = 1
        ORDER BY g.display_name
      `, [userId]);

      res.json(groups);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get accessible modules for a user (based on their groups)
  router.get('/user/:userId/modules', async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user is admin
      const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);

      if (user?.role === 'admin') {
        // Admin gets all active modules
        const modules = await db.all('SELECT * FROM modules WHERE is_active = 1 ORDER BY display_name');
        return res.json({ isAdmin: true, modules });
      }

      // Get modules from all user's groups (union)
      const modules = await db.all(`
        SELECT DISTINCT m.*
        FROM modules m
        INNER JOIN group_module_access gma ON gma.module_id = m.id
        INNER JOIN user_group_members ugm ON ugm.group_id = gma.group_id
        WHERE ugm.user_id = ? AND m.is_active = 1
        ORDER BY m.display_name
      `, [userId]);

      res.json({ isAdmin: false, modules });
    } catch (error) {
      console.error('Error fetching user accessible modules:', error);
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createGroupRoutes;
