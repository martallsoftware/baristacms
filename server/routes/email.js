/**
 * Email Routes
 * Handles sending emails from the server
 */

import { Router } from 'express';
import { sendEmail, verifyEmailConfig } from '../services/email.js';

export function createEmailRoutes() {
  const router = Router();

  // Send email
  router.post('/send', async (req, res) => {
    try {
      const { to, subject, message, cc, bcc } = req.body;

      // Validation
      if (!to) {
        return res.status(400).json({ success: false, error: 'Recipient (to) is required' });
      }
      if (!subject) {
        return res.status(400).json({ success: false, error: 'Subject is required' });
      }
      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      // Get sender info from authenticated user
      const senderEmail = req.user?.email;
      const senderName = req.user?.name;

      // Add sender signature to message
      const textBody = message + (senderName ? `\n\n--\n${senderName}` : '');

      const result = await sendEmail({
        to,
        subject,
        text: textBody,
        cc,
        bcc,
        replyTo: senderEmail, // Replies go to the logged-in user
      });

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: 'Email sent successfully',
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Email route error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Check email configuration status
  router.get('/status', async (req, res) => {
    try {
      const status = await verifyEmailConfig();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        configured: false,
        verified: false,
        error: error.message,
      });
    }
  });

  return router;
}

export default createEmailRoutes;
