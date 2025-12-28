/**
 * Dashboard Routes
 * Handles dashboard configurations linked to modules
 */

import { Router } from 'express';
import { getDatabaseType } from '../db/index.js';

export function createDashboardRoutes(db) {
  const isMySQL = getDatabaseType() === 'mysql';
  const router = Router();

  // Get all dashboards (admin)
  router.get('/', async (req, res) => {
    try {
      const dashboards = await db.all(`
        SELECT d.*, m.name as module_name, m.display_name as module_display_name
        FROM dashboards d
        LEFT JOIN modules m ON m.id = d.module_id
        ORDER BY d.name
      `);

      // Parse JSON fields
      for (const d of dashboards) {
        if (d.widgets) d.widgets = JSON.parse(d.widgets);
        if (d.layout) d.layout = JSON.parse(d.layout);
      }

      res.json(dashboards);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single dashboard by slug (public or auth based on require_auth setting)
  router.get('/by-slug/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      const dashboard = await db.get(`
        SELECT d.*, m.name as module_name, m.display_name as module_display_name
        FROM dashboards d
        LEFT JOIN modules m ON m.id = d.module_id
        WHERE d.slug = ? AND d.is_active = 1
      `, [slug]);

      if (!dashboard) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }

      // Check if auth is required
      if (dashboard.require_auth && !req.user?.email) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Parse JSON fields
      if (dashboard.widgets) dashboard.widgets = JSON.parse(dashboard.widgets);
      if (dashboard.layout) dashboard.layout = JSON.parse(dashboard.layout);

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single dashboard by ID (admin)
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Handle stats request
      if (id === 'stats') {
        return res.status(400).json({ message: 'Use /api/dashboards/:id/stats endpoint' });
      }

      const dashboard = await db.get(`
        SELECT d.*, m.name as module_name, m.display_name as module_display_name
        FROM dashboards d
        LEFT JOIN modules m ON m.id = d.module_id
        WHERE d.id = ?
      `, [id]);

      if (!dashboard) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }

      if (dashboard.widgets) dashboard.widgets = JSON.parse(dashboard.widgets);
      if (dashboard.layout) dashboard.layout = JSON.parse(dashboard.layout);

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get dashboard statistics
  router.get('/:id/stats', async (req, res) => {
    try {
      const { id } = req.params;
      const { days } = req.query;

      const dashboard = await db.get(`
        SELECT d.*, m.name as module_name, m.display_name as module_display_name
        FROM dashboards d
        LEFT JOIN modules m ON m.id = d.module_id
        WHERE d.id = ?
      `, [id]);

      if (!dashboard) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }

      // Check if auth is required
      if (dashboard.require_auth && !req.user?.email) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const widgets = dashboard.widgets ? JSON.parse(dashboard.widgets) : [];
      const dateRange = days || dashboard.date_range_default || '30';
      const moduleId = dashboard.module_id;

      const stats = {
        moduleId,
        moduleName: dashboard.module_name,
        moduleDisplayName: dashboard.module_display_name,
        dateRange,
        widgets: {},
      };

      // Calculate stats for each widget type
      for (const widget of widgets) {
        switch (widget) {
          case 'total_count': {
            const result = await db.get(
              'SELECT COUNT(*) as count FROM module_records WHERE module_id = ?',
              [moduleId]
            );
            stats.widgets.total_count = {
              type: 'total_count',
              data: { count: result?.count || 0 },
            };
            break;
          }

          case 'items_by_month': {
            // Get items grouped by month for the date range
            let query;
            let params;

            if (isMySQL) {
              // MySQL syntax
              if (dateRange === 'all') {
                query = `
                  SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                  FROM module_records
                  WHERE module_id = ?
                  GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                  ORDER BY month
                `;
                params = [moduleId];
              } else {
                query = `
                  SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                  FROM module_records
                  WHERE module_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                  GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                  ORDER BY month
                `;
                params = [moduleId, parseInt(dateRange)];
              }
            } else {
              // SQLite syntax
              if (dateRange === 'all') {
                query = `
                  SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
                  FROM module_records
                  WHERE module_id = ?
                  GROUP BY strftime('%Y-%m', created_at)
                  ORDER BY month
                `;
                params = [moduleId];
              } else {
                query = `
                  SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
                  FROM module_records
                  WHERE module_id = ? AND created_at >= date('now', '-' || ? || ' days')
                  GROUP BY strftime('%Y-%m', created_at)
                  ORDER BY month
                `;
                params = [moduleId, dateRange];
              }
            }

            const rows = await db.all(query, params);

            // Format for chart
            const labels = rows.map(r => {
              const [year, month] = r.month.split('-');
              const date = new Date(year, parseInt(month) - 1);
              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            });
            const values = rows.map(r => r.count);

            stats.widgets.items_by_month = {
              type: 'items_by_month',
              data: { labels, values },
            };
            break;
          }

          case 'items_by_user': {
            const rows = await db.all(`
              SELECT created_by, COUNT(*) as count
              FROM module_records
              WHERE module_id = ? AND created_by IS NOT NULL AND created_by != ''
              GROUP BY created_by
              ORDER BY count DESC
              LIMIT 10
            `, [moduleId]);

            const labels = rows.map(r => r.created_by);
            const values = rows.map(r => r.count);

            stats.widgets.items_by_user = {
              type: 'items_by_user',
              data: { labels, values },
            };
            break;
          }

          case 'items_by_status': {
            const rows = await db.all(`
              SELECT status, COUNT(*) as count
              FROM module_records
              WHERE module_id = ?
              GROUP BY status
              ORDER BY count DESC
            `, [moduleId]);

            const labels = rows.map(r => r.status || 'No Status');
            const values = rows.map(r => r.count);

            // Default colors for common statuses
            const statusColors = {
              'active': '#22c55e',
              'pending': '#eab308',
              'completed': '#3b82f6',
              'done': '#3b82f6',
              'closed': '#6b7280',
              'cancelled': '#ef4444',
              'on_hold': '#f97316',
            };
            const colors = labels.map(l => statusColors[l.toLowerCase()] || '#94a3b8');

            stats.widgets.items_by_status = {
              type: 'items_by_status',
              data: { labels, values, colors },
            };
            break;
          }

          case 'todays_items': {
            // Get items created today
            let query;
            if (isMySQL) {
              query = `
                SELECT id, data, status, created_by, created_at
                FROM module_records
                WHERE module_id = ? AND DATE(created_at) = CURDATE()
                ORDER BY created_at DESC
                LIMIT 50
              `;
            } else {
              query = `
                SELECT id, data, status, created_by, created_at
                FROM module_records
                WHERE module_id = ? AND DATE(created_at) = DATE('now')
                ORDER BY created_at DESC
                LIMIT 50
              `;
            }

            const rows = await db.all(query, [moduleId]);

            // Parse JSON data for each record
            const items = rows.map(r => {
              let parsedData = {};
              try {
                parsedData = r.data ? JSON.parse(r.data) : {};
              } catch (e) {
                parsedData = {};
              }
              return {
                id: r.id,
                data: parsedData,
                status: r.status,
                created_by: r.created_by,
                created_at: r.created_at,
              };
            });

            stats.widgets.todays_items = {
              type: 'todays_items',
              data: { items, count: items.length },
            };
            break;
          }
        }
      }

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create dashboard (admin)
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        slug,
        moduleId,
        title,
        description,
        widgets,
        layout,
        dateRangeDefault,
        isActive,
        requireAuth,
      } = req.body;

      if (!name || !slug || !moduleId || !title) {
        return res.status(400).json({ message: 'Name, slug, module, and title are required' });
      }

      // Check if slug is unique
      const existing = await db.get('SELECT id FROM dashboards WHERE slug = ?', [slug]);
      if (existing) {
        return res.status(400).json({ message: 'A dashboard with this slug already exists' });
      }

      const result = await db.run(`
        INSERT INTO dashboards (name, slug, module_id, title, description, widgets, layout, date_range_default, is_active, require_auth, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name,
        slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        moduleId,
        title,
        description || null,
        widgets ? JSON.stringify(widgets) : JSON.stringify(['total_count', 'items_by_month', 'items_by_user', 'items_by_status']),
        layout ? JSON.stringify(layout) : null,
        dateRangeDefault || '30',
        isActive !== false ? 1 : 0,
        requireAuth !== false ? 1 : 0,
        req.user?.email || null,
      ]);

      const dashboard = await db.get('SELECT * FROM dashboards WHERE id = ?', [result.lastInsertRowid]);
      if (dashboard.widgets) dashboard.widgets = JSON.parse(dashboard.widgets);
      if (dashboard.layout) dashboard.layout = JSON.parse(dashboard.layout);

      res.status(201).json(dashboard);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update dashboard (admin)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        slug,
        moduleId,
        title,
        description,
        widgets,
        layout,
        dateRangeDefault,
        isActive,
        requireAuth,
      } = req.body;

      // Check if dashboard exists
      const existing = await db.get('SELECT * FROM dashboards WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }

      // Check if new slug is unique (if changed)
      if (slug && slug !== existing.slug) {
        const slugExists = await db.get('SELECT id FROM dashboards WHERE slug = ? AND id != ?', [slug, id]);
        if (slugExists) {
          return res.status(400).json({ message: 'A dashboard with this slug already exists' });
        }
      }

      await db.run(`
        UPDATE dashboards
        SET name = ?, slug = ?, module_id = ?, title = ?, description = ?,
            widgets = ?, layout = ?, date_range_default = ?, is_active = ?, require_auth = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name ?? existing.name,
        slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : existing.slug,
        moduleId ?? existing.module_id,
        title ?? existing.title,
        description !== undefined ? description : existing.description,
        widgets ? JSON.stringify(widgets) : existing.widgets,
        layout !== undefined ? JSON.stringify(layout) : existing.layout,
        dateRangeDefault ?? existing.date_range_default,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        requireAuth !== undefined ? (requireAuth ? 1 : 0) : existing.require_auth,
        id,
      ]);

      const dashboard = await db.get('SELECT * FROM dashboards WHERE id = ?', [id]);
      if (dashboard.widgets) dashboard.widgets = JSON.parse(dashboard.widgets);
      if (dashboard.layout) dashboard.layout = JSON.parse(dashboard.layout);

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete dashboard (admin)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM dashboards WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createDashboardRoutes;
