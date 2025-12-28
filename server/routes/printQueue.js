/**
 * Print Queue Routes
 * Handles label/barcode print queue management
 */

import { Router } from 'express';

export function createPrintQueueRoutes(db) {
  const router = Router();

  // Get all print queue items
  router.get('/', async (req, res) => {
    try {
      const items = await db.all(`
        SELECT * FROM print_queue
        ORDER BY created_at DESC
      `);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending print queue items
  router.get('/pending', async (req, res) => {
    try {
      const items = await db.all(`
        SELECT * FROM print_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add item to print queue
  router.post('/', async (req, res) => {
    try {
      const { recordId, moduleId, moduleName, recordName } = req.body;
      const createdBy = req.user?.email || 'unknown';

      if (!recordId || !moduleId || !moduleName || !recordName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const result = await db.run(`
        INSERT INTO print_queue (record_id, module_id, module_name, record_name, status, created_by)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `, [recordId, moduleId, moduleName, recordName, createdBy]);

      const item = await db.get('SELECT * FROM print_queue WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark item as printed
  router.put('/:id/printed', async (req, res) => {
    try {
      const { id } = req.params;

      await db.run(`
        UPDATE print_queue
        SET status = 'printed', printed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [id]);

      const item = await db.get('SELECT * FROM print_queue WHERE id = ?', [id]);
      if (!item) {
        return res.status(404).json({ message: 'Print queue item not found' });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete print queue item
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM print_queue WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all printed items
  router.delete('/clear/printed', async (req, res) => {
    try {
      await db.run("DELETE FROM print_queue WHERE status = 'printed'");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createPrintQueueRoutes;
