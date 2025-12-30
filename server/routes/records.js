/**
 * Record Routes
 * Handles CRUD operations for module records
 */

import { Router } from 'express';
import { join } from 'path';
import { existsSync, unlinkSync, writeFileSync } from 'fs';

export function createRecordRoutes(db, uploadsDir) {
  const router = Router({ mergeParams: true });

  // Middleware to check module access based on user groups
  async function checkModuleAccess(req, res, next) {
    try {
      const userEmail = req.user?.email;
      const authType = req.user?.authType || 'm365';
      if (!userEmail) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Use case-insensitive email match, filtering by auth_type for local users
      let user;
      if (authType === 'local') {
        user = await db.get("SELECT id, role FROM users WHERE LOWER(email) = LOWER(?) AND auth_type = 'local'", [userEmail]);
      } else {
        user = await db.get('SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)', [userEmail]);
      }
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Admin users bypass group access check
      if (user.role === 'admin') {
        return next();
      }

      const module = await db.get('SELECT id FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      // Check if user has access to this module through any group
      const hasAccess = await db.get(`
        SELECT 1 FROM group_module_access gma
        INNER JOIN user_group_members ugm ON ugm.group_id = gma.group_id
        WHERE ugm.user_id = ? AND gma.module_id = ?
        LIMIT 1
      `, [user.id, module.id]);

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this module' });
      }

      next();
    } catch (error) {
      console.error('Error checking module access:', error);
      res.status(500).json({ message: 'Error checking access permissions' });
    }
  }

  // Apply access check to all routes
  router.use(checkModuleAccess);

  // Helper to get record with images
  async function getRecordWithImages(moduleId, recordId) {
    const record = await db.get('SELECT * FROM module_records WHERE id = ? AND module_id = ?', [recordId, moduleId]);
    if (!record) return null;

    if (record.data) record.data = JSON.parse(record.data);

    // Get thumbnail
    const firstImage = await db.get('SELECT image_path FROM record_images WHERE record_id = ? ORDER BY sort_order, id LIMIT 1', [recordId]);
    record.thumbnail = firstImage ? firstImage.image_path : null;

    // Get all images
    record.images = await db.all('SELECT * FROM record_images WHERE record_id = ? ORDER BY sort_order, id', [recordId]);

    return record;
  }

  // Get all records for a module
  router.get('/', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const userEmail = req.user?.email;

      // Fetch records with view status
      const records = await db.all(`
        SELECT mr.*,
               CASE WHEN rv.id IS NOT NULL THEN 1 ELSE 0 END as is_viewed
        FROM module_records mr
        LEFT JOIN record_views rv ON rv.record_id = mr.id AND rv.user_email = ?
        WHERE mr.module_id = ?
        ORDER BY mr.created_at DESC
      `, [userEmail || '', module.id]);

      for (const r of records) {
        if (r.data) r.data = JSON.parse(r.data);
        // Convert is_viewed to boolean
        r.is_viewed = r.is_viewed === 1;
        // Get thumbnail
        const firstImage = await db.get('SELECT image_path FROM record_images WHERE record_id = ? ORDER BY sort_order, id LIMIT 1', [r.id]);
        r.thumbnail = firstImage ? firstImage.image_path : null;
        // Get all images
        r.images = await db.all('SELECT * FROM record_images WHERE record_id = ? ORDER BY sort_order, id', [r.id]);
      }

      res.json(records);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single record
  router.get('/:id', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const record = await getRecordWithImages(module.id, req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Record not found' });
      }

      // Mark record as viewed by current user
      const userEmail = req.user?.email;
      if (userEmail) {
        try {
          // Try to insert, handle duplicate gracefully
          await db.run(
            'INSERT INTO record_views (record_id, module_id, user_email, viewed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [record.id, module.id, userEmail]
          );
        } catch (insertError) {
          // If duplicate key error, update the timestamp instead
          if (insertError.message?.includes('Duplicate') || insertError.message?.includes('UNIQUE constraint')) {
            try {
              await db.run(
                'UPDATE record_views SET viewed_at = CURRENT_TIMESTAMP WHERE record_id = ? AND user_email = ?',
                [record.id, userEmail]
              );
            } catch (updateError) {
              // Ignore update errors - record is already viewed
            }
          }
          // Ignore other errors - don't break the response
        }
      }

      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create record
  router.post('/', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const { name, data, status, createdBy, parentRecordId, assignedTo } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      const result = await db.run(`
        INSERT INTO module_records (module_id, name, data, status, parent_record_id, assigned_to, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        module.id,
        name,
        data ? JSON.stringify(data) : null,
        status || 'active',
        parentRecordId || null,
        assignedTo || null,
        createdBy || null,
        createdBy || null
      ]);

      // Add history entry
      await db.run(
        'INSERT INTO record_history (module_id, record_id, action, description, changed_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, result.lastInsertRowid, 'created', `${name} was created`, createdBy || null]
      );

      const record = await getRecordWithImages(module.id, result.lastInsertRowid);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update record
  router.put('/:id', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const existing = await db.get('SELECT * FROM module_records WHERE id = ? AND module_id = ?', [req.params.id, module.id]);
      if (!existing) {
        return res.status(404).json({ message: 'Record not found' });
      }

      const { name, data, status, updatedBy, assignedTo } = req.body;
      const existingData = existing.data ? JSON.parse(existing.data) : {};
      const newData = data || {};

      // Track changes for history
      const changes = [];

      // Check name change
      if (name !== undefined && name !== existing.name) {
        changes.push({
          field: 'name',
          displayName: 'Name',
          oldValue: existing.name,
          newValue: name
        });
      }

      // Check status change
      if (status !== undefined && status !== existing.status) {
        changes.push({
          field: 'status',
          displayName: 'Status',
          oldValue: existing.status,
          newValue: status
        });
      }

      // Check assigned_to change
      if (assignedTo !== undefined && assignedTo !== existing.assigned_to) {
        changes.push({
          field: 'assigned_to',
          displayName: 'Assigned To',
          oldValue: existing.assigned_to || '(none)',
          newValue: assignedTo || '(none)'
        });
      }

      // Check data field changes
      if (data) {
        // Get module fields for display names
        const moduleFields = await db.all('SELECT name, display_name FROM module_fields WHERE module_id = ?', [module.id]);
        const fieldDisplayNames = {};
        moduleFields.forEach(f => {
          fieldDisplayNames[f.name] = f.display_name;
        });

        // Check each field in the new data
        const allFieldKeys = new Set([...Object.keys(existingData), ...Object.keys(newData)]);
        for (const key of allFieldKeys) {
          const oldVal = existingData[key];
          const newVal = newData[key];

          // Convert to string for comparison (handle null/undefined)
          const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : '';
          const newStr = newVal !== null && newVal !== undefined ? String(newVal) : '';

          if (oldStr !== newStr) {
            changes.push({
              field: key,
              displayName: fieldDisplayNames[key] || key,
              oldValue: oldStr || '(empty)',
              newValue: newStr || '(empty)'
            });
          }
        }
      }

      await db.run(`
        UPDATE module_records
        SET name = ?, data = ?, status = ?, assigned_to = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name ?? existing.name,
        data ? JSON.stringify(data) : existing.data,
        status ?? existing.status,
        assignedTo !== undefined ? assignedTo : existing.assigned_to,
        updatedBy || existing.updated_by,
        req.params.id
      ]);

      // Add history entries for each change
      if (changes.length > 0) {
        for (const change of changes) {
          await db.run(
            'INSERT INTO record_history (module_id, record_id, action, description, field_name, old_value, new_value, changed_by, user_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              module.id,
              req.params.id,
              'field_updated',
              `${change.displayName} changed from "${change.oldValue}" to "${change.newValue}"`,
              change.field,
              change.oldValue,
              change.newValue,
              updatedBy || null,
              updatedBy || null
            ]
          );
        }
      } else {
        // No field changes detected, still log the update
        await db.run(
          'INSERT INTO record_history (module_id, record_id, action, description, changed_by, user_email) VALUES (?, ?, ?, ?, ?, ?)',
          [module.id, req.params.id, 'updated', `${name || existing.name} was updated (no field changes)`, updatedBy || null, updatedBy || null]
        );
      }

      const record = await getRecordWithImages(module.id, req.params.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete record
  router.delete('/:id', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const existing = await db.get('SELECT * FROM module_records WHERE id = ? AND module_id = ?', [req.params.id, module.id]);
      if (!existing) {
        return res.status(404).json({ message: 'Record not found' });
      }

      // Delete all images files
      const images = await db.all('SELECT * FROM record_images WHERE record_id = ?', [req.params.id]);
      for (const image of images) {
        const imagePath = join(uploadsDir, '..', image.image_path);
        if (existsSync(imagePath)) {
          unlinkSync(imagePath);
        }
      }

      // Delete all documents files
      const docs = await db.all('SELECT * FROM record_documents WHERE record_id = ?', [req.params.id]);
      for (const doc of docs) {
        const docPath = join(uploadsDir, '..', doc.file_path);
        if (existsSync(docPath)) {
          unlinkSync(docPath);
        }
      }

      await db.run('DELETE FROM module_records WHERE id = ?', [req.params.id]);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ IMAGES ============

  // Add image to record
  router.post('/:id/images', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const existing = await db.get('SELECT * FROM module_records WHERE id = ? AND module_id = ?', [req.params.id, module.id]);
      if (!existing) {
        return res.status(404).json({ message: 'Record not found' });
      }

      const { image, createdBy } = req.body;
      if (!image) {
        return res.status(400).json({ message: 'Image is required' });
      }

      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid image format' });
      }

      const ext = matches[1];
      const data = matches[2];
      const buffer = Buffer.from(data, 'base64');
      const filename = `${req.params.moduleName}_${req.params.id}_${Date.now()}.${ext}`;
      const filepath = join(uploadsDir, filename);

      writeFileSync(filepath, buffer);

      const imagePath = `/uploads/${filename}`;
      const maxOrder = await db.get('SELECT MAX(sort_order) as max FROM record_images WHERE record_id = ?', [req.params.id]);
      const sortOrder = (maxOrder?.max ?? -1) + 1;

      await db.run(
        'INSERT INTO record_images (module_id, record_id, image_path, sort_order, created_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, imagePath, sortOrder, createdBy || null]
      );

      // Add history entry
      await db.run(
        'INSERT INTO record_history (module_id, record_id, action, description, changed_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, 'image_added', 'Image was added', createdBy || null]
      );

      // Return updated record with images
      try {
        const record = await getRecordWithImages(module.id, req.params.id);
        res.status(201).json(record);
      } catch (fetchError) {
        // Image was saved, but couldn't fetch the updated record - return success anyway
        console.error('Failed to fetch record after image upload:', fetchError.message);
        res.status(201).json({
          id: parseInt(req.params.id),
          message: 'Image uploaded successfully',
          images: []
        });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete image from record
  router.delete('/:id/images/:imageId', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const image = await db.get('SELECT * FROM record_images WHERE id = ? AND record_id = ?', [req.params.imageId, req.params.id]);
      if (!image) {
        return res.status(404).json({ message: 'Image not found' });
      }

      // Delete file
      const imagePath = join(uploadsDir, '..', image.image_path);
      if (existsSync(imagePath)) {
        unlinkSync(imagePath);
      }

      await db.run('DELETE FROM record_images WHERE id = ?', [req.params.imageId]);

      // Add history entry
      await db.run(
        'INSERT INTO record_history (module_id, record_id, action, description, changed_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, 'image_deleted', 'Image was deleted', null]
      );

      const record = await getRecordWithImages(module.id, req.params.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder images
  router.put('/:id/images/reorder', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const { imageIds } = req.body;
      if (!Array.isArray(imageIds)) {
        return res.status(400).json({ message: 'imageIds array is required' });
      }

      for (let i = 0; i < imageIds.length; i++) {
        await db.run('UPDATE record_images SET sort_order = ? WHERE id = ?', [i, imageIds[i]]);
      }

      const record = await getRecordWithImages(module.id, req.params.id);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ DOCUMENTS ============

  // Get documents
  router.get('/:id/documents', async (req, res) => {
    try {
      const documents = await db.all('SELECT * FROM record_documents WHERE record_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add document
  router.post('/:id/documents', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      // Support both field name conventions (name/fileName, uploadedBy/createdBy)
      const { file, name, fileName, fileType, uploadedBy, createdBy } = req.body;
      const docName = name || fileName;
      const docCreatedBy = uploadedBy || createdBy;

      if (!file || !docName) {
        return res.status(400).json({ message: 'File and name are required' });
      }

      const matches = file.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid file format' });
      }

      const data = matches[2];
      const buffer = Buffer.from(data, 'base64');
      const safeFileName = `${req.params.moduleName}_${req.params.id}_${Date.now()}_${docName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filepath = join(uploadsDir, safeFileName);

      writeFileSync(filepath, buffer);

      const filePath = `/uploads/${safeFileName}`;

      const result = await db.run(
        'INSERT INTO record_documents (module_id, record_id, file_path, file_name, file_type, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [module.id, req.params.id, filePath, docName, fileType || null, buffer.length, docCreatedBy || null]
      );

      // Add history entry
      await db.run(
        'INSERT INTO record_history (module_id, record_id, action, description, changed_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, 'document_added', `Document "${docName}" was added`, docCreatedBy || null]
      );

      const doc = await db.get('SELECT * FROM record_documents WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete document
  router.delete('/:id/documents/:docId', async (req, res) => {
    try {
      const doc = await db.get('SELECT * FROM record_documents WHERE id = ? AND record_id = ?', [req.params.docId, req.params.id]);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Delete file
      const docPath = join(uploadsDir, '..', doc.file_path);
      if (existsSync(docPath)) {
        unlinkSync(docPath);
      }

      await db.run('DELETE FROM record_documents WHERE id = ?', [req.params.docId]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ HISTORY ============

  router.get('/:id/history', async (req, res) => {
    try {
      const history = await db.all('SELECT * FROM record_history WHERE record_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/:id/history', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const { action, description, changedBy } = req.body;

      const result = await db.run(
        'INSERT INTO record_history (module_id, record_id, action, description, changed_by) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, action || 'note', description || '', changedBy || null]
      );

      const entry = await db.get('SELECT * FROM record_history WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ LINKS ============

  router.get('/:id/links', async (req, res) => {
    try {
      const links = await db.all('SELECT * FROM record_links WHERE record_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(links);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/:id/links', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const { url, title, description } = req.body;
      if (!url) {
        return res.status(400).json({ message: 'URL is required' });
      }

      const result = await db.run(
        'INSERT INTO record_links (module_id, record_id, url, title, description) VALUES (?, ?, ?, ?, ?)',
        [module.id, req.params.id, url, title || null, description || null]
      );

      const link = await db.get('SELECT * FROM record_links WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(link);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.put('/:id/links/:linkId', async (req, res) => {
    try {
      const { url, title, description } = req.body;

      await db.run(
        'UPDATE record_links SET url = ?, title = ?, description = ? WHERE id = ?',
        [url, title || null, description || null, req.params.linkId]
      );

      const link = await db.get('SELECT * FROM record_links WHERE id = ?', [req.params.linkId]);
      res.json(link);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.delete('/:id/links/:linkId', async (req, res) => {
    try {
      await db.run('DELETE FROM record_links WHERE id = ?', [req.params.linkId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ COMPANIES ============

  router.get('/:id/companies', async (req, res) => {
    try {
      const companies = await db.all(`
        SELECT c.*, rc.relationship_type, rc.id as link_id
        FROM companies c
        JOIN record_companies rc ON c.id = rc.company_id
        WHERE rc.record_id = ?
        ORDER BY c.name
      `, [req.params.id]);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/:id/companies', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const { companyId, relationshipType } = req.body;
      if (!companyId) {
        return res.status(400).json({ message: 'companyId is required' });
      }

      await db.run(
        'INSERT INTO record_companies (module_id, record_id, company_id, relationship_type) VALUES (?, ?, ?, ?)',
        [module.id, req.params.id, companyId, relationshipType || 'related']
      );

      const companies = await db.all(`
        SELECT c.*, rc.relationship_type, rc.id as link_id
        FROM companies c
        JOIN record_companies rc ON c.id = rc.company_id
        WHERE rc.record_id = ?
        ORDER BY c.name
      `, [req.params.id]);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.delete('/:id/companies/:companyId', async (req, res) => {
    try {
      await db.run('DELETE FROM record_companies WHERE record_id = ? AND company_id = ?', [req.params.id, req.params.companyId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ CHILD RECORDS (Sub-module) ============

  // Get count of all child records for a parent record (across all sub-modules)
  router.get('/:id/children-count', async (req, res) => {
    try {
      const parentModule = await db.get('SELECT id FROM modules WHERE name = ?', [req.params.moduleName]);
      if (!parentModule) {
        return res.status(404).json({ message: 'Module not found' });
      }

      // Find all sub-modules of this module
      const subModules = await db.all(
        'SELECT id, name, display_name FROM modules WHERE parent_module_id = ?',
        [parentModule.id]
      );

      // Count child records in each sub-module
      let totalCount = 0;
      const breakdown = [];

      for (const subModule of subModules) {
        const result = await db.get(
          'SELECT COUNT(*) as count FROM module_records WHERE module_id = ? AND parent_record_id = ?',
          [subModule.id, req.params.id]
        );
        const count = result?.count || 0;
        if (count > 0) {
          breakdown.push({
            moduleName: subModule.name,
            displayName: subModule.display_name,
            count,
          });
          totalCount += count;
        }
      }

      res.json({
        totalCount,
        breakdown,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get child records for a parent record from a specific sub-module
  router.get('/:id/children/:subModuleName', async (req, res) => {
    try {
      const subModule = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.subModuleName]);
      if (!subModule) {
        return res.status(404).json({ message: 'Sub-module not found' });
      }

      const records = await db.all(`
        SELECT * FROM module_records
        WHERE module_id = ? AND parent_record_id = ?
        ORDER BY created_at DESC
      `, [subModule.id, req.params.id]);

      for (const r of records) {
        if (r.data) r.data = JSON.parse(r.data);
        // Get thumbnail
        const firstImage = await db.get('SELECT image_path FROM record_images WHERE record_id = ? ORDER BY sort_order, id LIMIT 1', [r.id]);
        r.thumbnail = firstImage ? firstImage.image_path : null;
      }

      res.json(records);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createRecordRoutes;
