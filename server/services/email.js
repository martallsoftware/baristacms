/**
 * Email Service
 *
 * Sends emails using Microsoft Graph API with OAuth2 (recommended for Office 365).
 * Falls back to SMTP with nodemailer if Graph API is not configured.
 *
 * For Microsoft Graph API (OAuth2):
 *   EMAIL_PROVIDER=graph
 *   AZURE_TENANT_ID=your-tenant-id
 *   AZURE_CLIENT_ID=your-client-id
 *   AZURE_CLIENT_SECRET=your-client-secret
 *   EMAIL_FROM=sender@company.com
 *
 * For SMTP (legacy):
 *   EMAIL_PROVIDER=smtp
 *   SMTP_HOST=smtp.office365.com
 *   SMTP_PORT=587
 *   SMTP_USER=your-email@company.com
 *   SMTP_PASSWORD=your-password
 */

let ClientSecretCredential, Client, TokenCredentialAuthenticationProvider;
let nodemailer;

// Lazy load dependencies to prevent crashes if packages are missing
async function loadDependencies() {
  if (!ClientSecretCredential) {
    try {
      const azureIdentity = await import('@azure/identity');
      ClientSecretCredential = azureIdentity.ClientSecretCredential;
    } catch (e) {
      console.warn('Azure Identity package not available:', e.message);
    }
  }
  if (!Client) {
    try {
      const graphClient = await import('@microsoft/microsoft-graph-client');
      Client = graphClient.Client;
      const authProvider = await import('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js');
      TokenCredentialAuthenticationProvider = authProvider.TokenCredentialAuthenticationProvider;
    } catch (e) {
      console.warn('Microsoft Graph package not available:', e.message);
    }
  }
  if (!nodemailer) {
    try {
      const nm = await import('nodemailer');
      nodemailer = nm.default;
    } catch (e) {
      console.warn('Nodemailer package not available:', e.message);
    }
  }
}

// ============ Microsoft Graph API (OAuth2) ============

let graphClient = null;

/**
 * Initialize Microsoft Graph client
 */
async function getGraphClient() {
  if (graphClient) {
    return graphClient;
  }

  await loadDependencies();

  if (!ClientSecretCredential || !Client || !TokenCredentialAuthenticationProvider) {
    console.warn('Microsoft Graph packages not available');
    return null;
  }

  // Use EMAIL_AZURE_* for email-specific config, fallback to AZURE_* for backwards compatibility
  const tenantId = process.env.EMAIL_AZURE_TENANT_ID || process.env.AZURE_TENANT_ID;
  const clientId = process.env.EMAIL_AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.EMAIL_AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn('Microsoft Graph not configured: EMAIL_AZURE_TENANT_ID, EMAIL_AZURE_CLIENT_ID, EMAIL_AZURE_CLIENT_SECRET required');
    return null;
  }

  try {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    graphClient = Client.initWithMiddleware({
      authProvider,
    });

    console.log('Microsoft Graph client initialized');
    return graphClient;
  } catch (error) {
    console.error('Failed to initialize Graph client:', error.message);
    return null;
  }
}

/**
 * Send email using Microsoft Graph API
 */
async function sendEmailViaGraph({ to, subject, text, html, cc, bcc, replyTo }) {
  const client = await getGraphClient();
  if (!client) {
    return {
      success: false,
      error: 'Microsoft Graph not configured. Please set EMAIL_AZURE_TENANT_ID, EMAIL_AZURE_CLIENT_ID, EMAIL_AZURE_CLIENT_SECRET.',
    };
  }

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    return {
      success: false,
      error: 'EMAIL_FROM not configured. Please set the sender email address.',
    };
  }

  // Build recipients list
  const toRecipients = to.split(',').map(email => ({
    emailAddress: { address: email.trim() },
  }));

  const ccRecipients = cc ? cc.split(',').map(email => ({
    emailAddress: { address: email.trim() },
  })) : [];

  const bccRecipients = bcc ? bcc.split(',').map(email => ({
    emailAddress: { address: email.trim() },
  })) : [];

  const message = {
    subject,
    body: {
      contentType: html ? 'HTML' : 'Text',
      content: html || text,
    },
    toRecipients,
    ccRecipients,
    bccRecipients,
  };

  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }];
  }

  try {
    await client.api(`/users/${fromAddress}/sendMail`).post({
      message,
      saveToSentItems: true,
    });

    console.log('Email sent via Microsoft Graph');
    return {
      success: true,
      messageId: `graph-${Date.now()}`,
    };
  } catch (error) {
    console.error('Graph API error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to send email via Microsoft Graph',
    };
  }
}

/**
 * Verify Microsoft Graph configuration
 */
async function verifyGraphConfig() {
  const client = await getGraphClient();
  if (!client) {
    return {
      configured: false,
      verified: false,
      error: 'Microsoft Graph not configured',
    };
  }

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    return {
      configured: true,
      verified: false,
      error: 'EMAIL_FROM not set',
    };
  }

  try {
    // Try to get user info to verify credentials
    await client.api(`/users/${fromAddress}`).select('displayName,mail').get();
    return {
      configured: true,
      verified: true,
      provider: 'Microsoft Graph (OAuth2)',
    };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      error: error.message || 'Failed to verify Graph API access',
    };
  }
}

// ============ SMTP (Nodemailer) - Legacy ============

let transporter = null;

/**
 * Initialize SMTP transporter
 */
async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  await loadDependencies();

  if (!nodemailer) {
    console.warn('Nodemailer package not available');
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!user || !password) {
    console.warn('SMTP not configured: SMTP_USER and SMTP_PASSWORD required');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
  });

  console.log(`SMTP configured with ${host}:${port}`);
  return transporter;
}

/**
 * Send email via SMTP
 */
async function sendEmailViaSMTP({ to, subject, text, html, cc, bcc, replyTo }) {
  const transport = await getTransporter();
  if (!transport) {
    return {
      success: false,
      error: 'SMTP not configured. Please set SMTP_USER and SMTP_PASSWORD.',
    };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    const mailOptions = { from, to, subject, text };
    if (html) mailOptions.html = html;
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;
    if (replyTo) mailOptions.replyTo = replyTo;

    const info = await transport.sendMail(mailOptions);
    console.log('Email sent via SMTP:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('SMTP error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify SMTP configuration
 */
async function verifySMTPConfig() {
  const transport = await getTransporter();
  if (!transport) {
    return {
      configured: false,
      verified: false,
      error: 'SMTP not configured',
    };
  }

  try {
    await transport.verify();
    return {
      configured: true,
      verified: true,
      provider: 'SMTP',
    };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      error: error.message,
    };
  }
}

// ============ Public API ============

/**
 * Get the configured email provider
 */
function getProvider() {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();

  // Explicit provider selection
  if (provider === 'graph') return 'graph';
  if (provider === 'smtp') return 'smtp';

  // Auto-detect based on available config
  if ((process.env.EMAIL_AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET) && process.env.EMAIL_FROM) return 'graph';
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) return 'smtp';

  return null;
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options) {
  const provider = getProvider();

  if (provider === 'graph') {
    return sendEmailViaGraph(options);
  } else if (provider === 'smtp') {
    return sendEmailViaSMTP(options);
  } else {
    return {
      success: false,
      error: 'No email provider configured. Set EMAIL_PROVIDER=graph or EMAIL_PROVIDER=smtp with required credentials.',
    };
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig() {
  const provider = getProvider();

  if (provider === 'graph') {
    return verifyGraphConfig();
  } else if (provider === 'smtp') {
    return verifySMTPConfig();
  } else {
    return {
      configured: false,
      verified: false,
      error: 'No email provider configured',
    };
  }
}

// ============ Email Inbox (Read Emails) ============

/**
 * Fetch unread emails from the inbox
 * Requires Mail.Read permission in Azure AD
 */
export async function fetchInboxEmails(options = {}) {
  const provider = getProvider();

  if (provider !== 'graph') {
    return {
      success: false,
      error: 'Email inbox only supported with Microsoft Graph (EMAIL_PROVIDER=graph)',
      emails: [],
    };
  }

  const client = await getGraphClient();
  if (!client) {
    return {
      success: false,
      error: 'Microsoft Graph not configured',
      emails: [],
    };
  }

  const inboxAddress = process.env.EMAIL_INBOX || process.env.EMAIL_FROM;
  if (!inboxAddress) {
    return {
      success: false,
      error: 'EMAIL_INBOX or EMAIL_FROM not configured',
      emails: [],
    };
  }

  try {
    const { maxResults = 50, unreadOnly = true } = options;

    let query = client.api(`/users/${inboxAddress}/messages`)
      .select('id,subject,from,receivedDateTime,bodyPreview,body,isRead,hasAttachments')
      .top(maxResults)
      .orderby('receivedDateTime desc');

    if (unreadOnly) {
      query = query.filter('isRead eq false');
    }

    const response = await query.get();

    const emails = (response.value || []).map(email => ({
      id: email.id,
      subject: email.subject || '(No subject)',
      fromAddress: email.from?.emailAddress?.address || '',
      fromName: email.from?.emailAddress?.name || '',
      receivedAt: email.receivedDateTime,
      bodyPreview: email.bodyPreview || '',
      body: email.body?.content || '',
      isRead: email.isRead,
      hasAttachments: email.hasAttachments || false,
    }));

    return {
      success: true,
      emails,
    };
  } catch (error) {
    console.error('Failed to fetch inbox emails:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch emails',
      emails: [],
    };
  }
}

/**
 * Mark an email as read
 */
export async function markEmailAsRead(emailId) {
  const client = await getGraphClient();
  if (!client) {
    return { success: false, error: 'Microsoft Graph not configured' };
  }

  const inboxAddress = process.env.EMAIL_INBOX || process.env.EMAIL_FROM;

  try {
    await client.api(`/users/${inboxAddress}/messages/${emailId}`)
      .patch({ isRead: true });

    return { success: true };
  } catch (error) {
    console.error('Failed to mark email as read:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Parse module tag from email subject
 * E.g., "[Support] Customer issue" returns "support"
 */
export function parseModuleTagFromSubject(subject) {
  const match = subject?.match(/^\[([^\]]+)\]/);
  if (match) {
    return {
      moduleName: match[1].toLowerCase().trim(),
      cleanSubject: subject.replace(/^\[[^\]]+\]\s*/, '').trim(),
    };
  }
  return { moduleName: null, cleanSubject: subject };
}

/**
 * Get attachments list for an email
 * Returns metadata about each attachment (not the content)
 */
export async function getEmailAttachments(emailId) {
  console.log(`[Email Service] Getting attachments for email: ${emailId}`);

  const client = await getGraphClient();
  if (!client) {
    console.error('[Email Service] Microsoft Graph client not available');
    return { success: false, error: 'Microsoft Graph not configured', attachments: [] };
  }

  const inboxAddress = process.env.EMAIL_INBOX || process.env.EMAIL_FROM;
  console.log(`[Email Service] Using inbox address: ${inboxAddress}`);

  try {
    const apiUrl = `/users/${inboxAddress}/messages/${emailId}/attachments`;
    console.log(`[Email Service] Calling Graph API: ${apiUrl}`);

    const response = await client.api(apiUrl)
      .select('id,name,contentType,size,isInline')
      .get();

    console.log(`[Email Service] Graph API response:`, JSON.stringify(response, null, 2));

    const allAttachments = response.value || [];
    console.log(`[Email Service] Total attachments returned: ${allAttachments.length}`);

    // Include all attachments (both inline and regular)
    // Inline images are embedded in email body (screenshots, pasted images)
    // Regular attachments are files attached to the email
    const attachments = allAttachments
      .map(att => {
        console.log(`[Email Service] Found attachment: ${att.name} (inline: ${att.isInline}, type: ${att.contentType}, size: ${att.size})`);
        return {
          id: att.id,
          name: att.name,
          contentType: att.contentType,
          size: att.size,
          isInline: att.isInline,
        };
      });

    console.log(`[Email Service] Total attachments to process: ${attachments.length}`);
    return { success: true, attachments };
  } catch (error) {
    console.error('[Email Service] Failed to get email attachments:', error.message);
    console.error('[Email Service] Full error:', error);
    return { success: false, error: error.message, attachments: [] };
  }
}

/**
 * Download attachment content
 * Returns the attachment as a Buffer
 */
export async function downloadAttachment(emailId, attachmentId) {
  console.log(`[Email Service] Downloading attachment: ${attachmentId} from email ${emailId}`);

  const client = await getGraphClient();
  if (!client) {
    console.error('[Email Service] Microsoft Graph client not available for download');
    return { success: false, error: 'Microsoft Graph not configured' };
  }

  const inboxAddress = process.env.EMAIL_INBOX || process.env.EMAIL_FROM;

  try {
    const apiUrl = `/users/${inboxAddress}/messages/${emailId}/attachments/${attachmentId}`;
    console.log(`[Email Service] Calling Graph API for download: ${apiUrl}`);

    const attachment = await client.api(apiUrl).get();

    console.log(`[Email Service] Attachment metadata: name=${attachment.name}, type=${attachment.contentType}, size=${attachment.size}`);

    if (!attachment.contentBytes) {
      console.error('[Email Service] Attachment has no contentBytes');
      return { success: false, error: 'Attachment has no content' };
    }

    // contentBytes is base64 encoded
    const buffer = Buffer.from(attachment.contentBytes, 'base64');
    console.log(`[Email Service] Decoded attachment buffer size: ${buffer.length} bytes`);

    return {
      success: true,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      content: buffer,
    };
  } catch (error) {
    console.error('[Email Service] Failed to download attachment:', error.message);
    console.error('[Email Service] Full error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a content type is an image
 */
export function isImageContentType(contentType) {
  return contentType && contentType.startsWith('image/');
}

export default {
  sendEmail,
  verifyEmailConfig,
  fetchInboxEmails,
  markEmailAsRead,
  parseModuleTagFromSubject,
  getEmailAttachments,
  downloadAttachment,
  isImageContentType,
};
