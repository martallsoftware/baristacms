/**
 * Page Templates Routes
 * Handles quick add form pages linked to modules
 */

import { Router } from 'express';
import { sendEmail } from '../services/email.js';

export function createPageTemplateRoutes(db) {
  const router = Router();

  // Get all page templates (admin)
  router.get('/', async (req, res) => {
    try {
      const templates = await db.all(`
        SELECT pt.*, m.name as module_name, m.display_name as module_display_name
        FROM page_templates pt
        LEFT JOIN modules m ON m.id = pt.module_id
        ORDER BY pt.name
      `);

      // Parse JSON fields
      for (const t of templates) {
        if (t.fields) t.fields = JSON.parse(t.fields);
        if (t.default_values) t.default_values = JSON.parse(t.default_values);
      }

      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single template by slug (public - for form page)
  router.get('/by-slug/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      const template = await db.get(`
        SELECT pt.*, m.name as module_name, m.display_name as module_display_name
        FROM page_templates pt
        LEFT JOIN modules m ON m.id = pt.module_id
        WHERE pt.slug = ? AND pt.is_active = 1
      `, [slug]);

      if (!template) {
        return res.status(404).json({ message: 'Page not found' });
      }

      // Check if auth is required
      if (template.require_auth && !req.user?.email) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Parse JSON fields
      if (template.fields) template.fields = JSON.parse(template.fields);
      if (template.default_values) template.default_values = JSON.parse(template.default_values);

      // Get module fields for the form (ordered by weight - lower weight first)
      const moduleFields = await db.all(
        'SELECT * FROM module_fields WHERE module_id = ? ORDER BY weight ASC, sort_order ASC',
        [template.module_id]
      );

      // Parse field options
      for (const f of moduleFields) {
        if (f.options) f.options = JSON.parse(f.options);
      }

      // Filter to only selected fields if specified (keep weight-based order)
      let formFields = moduleFields;
      if (template.fields && template.fields.length > 0) {
        formFields = moduleFields.filter(f => template.fields.includes(f.name));
        // Fields are already sorted by weight from the query
      }

      template.formFields = formFields;

      res.json(template);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single template by ID (admin)
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const template = await db.get(`
        SELECT pt.*, m.name as module_name, m.display_name as module_display_name
        FROM page_templates pt
        LEFT JOIN modules m ON m.id = pt.module_id
        WHERE pt.id = ?
      `, [id]);

      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      if (template.fields) template.fields = JSON.parse(template.fields);
      if (template.default_values) template.default_values = JSON.parse(template.default_values);

      // Get all module fields (ordered by weight - lower weight first)
      const moduleFields = await db.all(
        'SELECT * FROM module_fields WHERE module_id = ? ORDER BY weight ASC, sort_order ASC',
        [template.module_id]
      );

      for (const f of moduleFields) {
        if (f.options) f.options = JSON.parse(f.options);
      }

      template.moduleFields = moduleFields;

      res.json(template);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create page template (admin)
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        slug,
        moduleId,
        title,
        description,
        fields,
        defaultValues,
        successMessage,
        isActive,
        requireAuth,
      } = req.body;

      if (!name || !slug || !moduleId || !title) {
        return res.status(400).json({ message: 'Name, slug, module, and title are required' });
      }

      // Check if slug is unique
      const existing = await db.get('SELECT id FROM page_templates WHERE slug = ?', [slug]);
      if (existing) {
        return res.status(400).json({ message: 'A page with this slug already exists' });
      }

      const result = await db.run(`
        INSERT INTO page_templates (name, slug, module_id, title, description, fields, default_values, success_message, is_active, require_auth, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name,
        slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        moduleId,
        title,
        description || null,
        fields ? JSON.stringify(fields) : null,
        defaultValues ? JSON.stringify(defaultValues) : null,
        successMessage || 'Your submission has been received. Thank you!',
        isActive !== false ? 1 : 0,
        requireAuth ? 1 : 0,
        req.user?.email || null,
      ]);

      const template = await db.get('SELECT * FROM page_templates WHERE id = ?', [result.lastInsertRowid]);
      if (template.fields) template.fields = JSON.parse(template.fields);
      if (template.default_values) template.default_values = JSON.parse(template.default_values);

      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update page template (admin)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        slug,
        moduleId,
        title,
        description,
        fields,
        defaultValues,
        successMessage,
        isActive,
        requireAuth,
      } = req.body;

      // Check if template exists
      const existing = await db.get('SELECT * FROM page_templates WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ message: 'Template not found' });
      }

      // Check if new slug is unique (if changed)
      if (slug && slug !== existing.slug) {
        const slugExists = await db.get('SELECT id FROM page_templates WHERE slug = ? AND id != ?', [slug, id]);
        if (slugExists) {
          return res.status(400).json({ message: 'A page with this slug already exists' });
        }
      }

      await db.run(`
        UPDATE page_templates
        SET name = ?, slug = ?, module_id = ?, title = ?, description = ?,
            fields = ?, default_values = ?, success_message = ?,
            is_active = ?, require_auth = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name ?? existing.name,
        slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : existing.slug,
        moduleId ?? existing.module_id,
        title ?? existing.title,
        description !== undefined ? description : existing.description,
        fields ? JSON.stringify(fields) : existing.fields,
        defaultValues ? JSON.stringify(defaultValues) : existing.default_values,
        successMessage !== undefined ? successMessage : existing.success_message,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        requireAuth !== undefined ? (requireAuth ? 1 : 0) : existing.require_auth,
        id,
      ]);

      const template = await db.get('SELECT * FROM page_templates WHERE id = ?', [id]);
      if (template.fields) template.fields = JSON.parse(template.fields);
      if (template.default_values) template.default_values = JSON.parse(template.default_values);

      res.json(template);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete page template (admin)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM page_templates WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit form (create record) - can be public
  router.post('/submit/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const { name, data, email } = req.body;

      // Get template
      const template = await db.get(`
        SELECT pt.*, m.name as module_name, m.config as module_config
        FROM page_templates pt
        LEFT JOIN modules m ON m.id = pt.module_id
        WHERE pt.slug = ? AND pt.is_active = 1
      `, [slug]);

      if (!template) {
        return res.status(404).json({ message: 'Page not found' });
      }

      // Check if auth is required
      if (template.require_auth && !req.user?.email) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      // Merge default values with submitted data
      let recordData = data || {};
      if (template.default_values) {
        const defaults = JSON.parse(template.default_values);
        recordData = { ...defaults, ...recordData };
      }

      // Get module config for default status
      let defaultStatus = 'active';
      if (template.module_config) {
        try {
          const config = JSON.parse(template.module_config);
          if (config.defaultStatus) {
            defaultStatus = config.defaultStatus;
          }
        } catch (e) {
          // Ignore parse error
        }
      }

      // Use submitted email first, then authenticated user's email, then 'anonymous'
      const createdBy = email || req.user?.email || 'anonymous';

      // Create the record
      const result = await db.run(`
        INSERT INTO module_records (module_id, name, data, status, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        template.module_id,
        name,
        JSON.stringify(recordData),
        defaultStatus,
        createdBy,
        createdBy,
      ]);

      const recordId = result.lastInsertRowid;

      // Add history entry
      await db.run(`
        INSERT INTO record_history (record_id, module_id, action, description, changed_by, user_email)
        VALUES (?, ?, 'created', ?, ?, ?)
      `, [
        recordId,
        template.module_id,
        `Record created via quick add page: ${template.name}`,
        createdBy,
        createdBy,
      ]);

      // Send email notification if email is configured
      const notifyEmail = process.env.EMAIL_FROM || process.env.EMAIL_INBOX;
      if (notifyEmail && createdBy !== 'anonymous') {
        try {
          // Build email content with form data
          let dataHtml = '';
          if (recordData && Object.keys(recordData).length > 0) {
            dataHtml = '<h3>Submitted Data:</h3><ul>';
            for (const [key, value] of Object.entries(recordData)) {
              if (value) {
                dataHtml += `<li><strong>${key}:</strong> ${value}</li>`;
              }
            }
            dataHtml += '</ul>';
          }

          await sendEmail({
            to: notifyEmail,
            subject: `[${template.module_name?.toUpperCase() || 'Form'}] New submission: ${name}`,
            replyTo: createdBy,
            html: `
              <h2>New Form Submission</h2>
              <p><strong>Form:</strong> ${template.title}</p>
              <p><strong>Title:</strong> ${name}</p>
              <p><strong>From:</strong> ${createdBy}</p>
              <p><strong>Reference:</strong> ${template.module_name?.toUpperCase()}-${recordId}</p>
              ${dataHtml}
              <hr>
              <p><em>Reply to this email to respond directly to the submitter.</em></p>
            `,
          });
          console.log(`Notification email sent for ${template.module_name}-${recordId}`);
        } catch (emailError) {
          // Don't fail the submission if email fails
          console.error('Failed to send notification email:', emailError.message);
        }
      }

      res.status(201).json({
        success: true,
        recordId,
        moduleName: template.module_name,
        message: template.success_message || 'Your submission has been received. Thank you!',
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createPageTemplateRoutes;
