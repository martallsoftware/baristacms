/**
 * Basic Pages Routes
 * Handles static content pages (Start, Documentation, Tips, FAQ, etc.)
 */

import { Router } from 'express';
import { join } from 'path';
import { writeFileSync } from 'fs';

export function createBasicPagesRoutes(db, uploadsDir) {
  const router = Router();

  // Get all basic pages (admin)
  router.get('/', async (req, res) => {
    try {
      const pages = await db.all(`
        SELECT bp.*, mi.display_name as menu_display_name
        FROM basic_pages bp
        LEFT JOIN menu_items mi ON mi.id = bp.menu_id
        ORDER BY bp.sort_order, bp.title
      `);

      res.json(pages);
    } catch (error) {
      console.error('Failed to get basic pages:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get published pages for menu
  router.get('/menu/:menuId', async (req, res) => {
    try {
      const { menuId } = req.params;

      const pages = await db.all(`
        SELECT id, title, slug, icon, sort_order
        FROM basic_pages
        WHERE menu_id = ? AND is_published = 1 AND show_in_menu = 1
        ORDER BY sort_order, title
      `, [menuId]);

      res.json(pages);
    } catch (error) {
      console.error('Failed to get menu pages:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single page by slug (public)
  router.get('/by-slug/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      const page = await db.get(`
        SELECT bp.*, mi.display_name as menu_display_name
        FROM basic_pages bp
        LEFT JOIN menu_items mi ON mi.id = bp.menu_id
        WHERE bp.slug = ?
      `, [slug]);

      if (!page) {
        return res.status(404).json({ message: 'Page not found' });
      }

      // If not published and not admin, deny access
      if (!page.is_published && req.user?.role !== 'admin') {
        return res.status(404).json({ message: 'Page not found' });
      }

      res.json(page);
    } catch (error) {
      console.error('Failed to get page by slug:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single page by ID (admin)
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const page = await db.get(`
        SELECT bp.*, mi.display_name as menu_display_name
        FROM basic_pages bp
        LEFT JOIN menu_items mi ON mi.id = bp.menu_id
        WHERE bp.id = ?
      `, [id]);

      if (!page) {
        return res.status(404).json({ message: 'Page not found' });
      }

      res.json(page);
    } catch (error) {
      console.error('Failed to get page:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create basic page (admin)
  router.post('/', async (req, res) => {
    try {
      const {
        title,
        slug,
        content,
        menuId,
        pageType,
        isPublished,
        showInMenu,
        sortOrder,
        icon,
      } = req.body;

      if (!title || !slug) {
        return res.status(400).json({ message: 'Title and slug are required' });
      }

      // Check if slug is unique
      const existing = await db.get('SELECT id FROM basic_pages WHERE slug = ?', [slug]);
      if (existing) {
        return res.status(400).json({ message: 'A page with this slug already exists' });
      }

      const result = await db.run(`
        INSERT INTO basic_pages (title, slug, content, menu_id, page_type, is_published, show_in_menu, sort_order, icon, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title,
        slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        content || '',
        menuId || null,
        pageType || 'content',
        isPublished ? 1 : 0,
        showInMenu !== false ? 1 : 0,
        sortOrder || 0,
        icon || null,
        req.user?.email || null,
      ]);

      const page = await db.get('SELECT * FROM basic_pages WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(page);
    } catch (error) {
      console.error('Failed to create page:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update basic page (admin)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        slug,
        content,
        menuId,
        pageType,
        isPublished,
        showInMenu,
        sortOrder,
        icon,
      } = req.body;

      // Check if page exists
      const existing = await db.get('SELECT * FROM basic_pages WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ message: 'Page not found' });
      }

      // Check if new slug is unique (if changed)
      if (slug && slug !== existing.slug) {
        const slugExists = await db.get('SELECT id FROM basic_pages WHERE slug = ? AND id != ?', [slug, id]);
        if (slugExists) {
          return res.status(400).json({ message: 'A page with this slug already exists' });
        }
      }

      await db.run(`
        UPDATE basic_pages
        SET title = ?, slug = ?, content = ?, menu_id = ?, page_type = ?,
            is_published = ?, show_in_menu = ?, sort_order = ?, icon = ?,
            updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        title ?? existing.title,
        slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : existing.slug,
        content !== undefined ? content : existing.content,
        menuId !== undefined ? menuId : existing.menu_id,
        pageType ?? existing.page_type,
        isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
        showInMenu !== undefined ? (showInMenu ? 1 : 0) : existing.show_in_menu,
        sortOrder !== undefined ? sortOrder : existing.sort_order,
        icon !== undefined ? icon : existing.icon,
        req.user?.email || null,
        id,
      ]);

      const page = await db.get('SELECT * FROM basic_pages WHERE id = ?', [id]);
      res.json(page);
    } catch (error) {
      console.error('Failed to update page:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete basic page (admin)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM basic_pages WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete page:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upload image for basic page content
  router.post('/upload-image', async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ message: 'No image provided' });
      }

      // Parse base64 image
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid image format' });
      }

      const ext = matches[1];
      const data = matches[2];
      const buffer = Buffer.from(data, 'base64');

      // Generate unique filename
      const filename = `page-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filepath = join(uploadsDir, filename);

      // Save file
      writeFileSync(filepath, buffer);

      // Return the URL path
      const imageUrl = `/uploads/${filename}`;
      res.json({ url: imageUrl });
    } catch (error) {
      console.error('Failed to upload image:', error);
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createBasicPagesRoutes;
