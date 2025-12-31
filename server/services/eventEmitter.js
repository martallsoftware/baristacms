/**
 * Server-Sent Events (SSE) Event Emitter
 *
 * Provides real-time notifications to connected clients when records are created/updated.
 */

// Store connected SSE clients
const clients = new Set();

/**
 * Add a new SSE client connection
 */
export function addClient(res) {
  clients.add(res);
  console.log(`[SSE] Client connected. Total clients: ${clients.size}`);

  // Remove client when connection closes
  res.on('close', () => {
    clients.delete(res);
    console.log(`[SSE] Client disconnected. Total clients: ${clients.size}`);
  });
}

/**
 * Send an event to all connected clients
 */
export function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  clients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // Client might have disconnected
      clients.delete(client);
    }
  });
}

/**
 * Emit a record created event
 */
export function emitRecordCreated(moduleName, recordId, source = 'manual') {
  broadcast('record:created', {
    moduleName,
    recordId,
    source,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit a record updated event
 */
export function emitRecordUpdated(moduleName, recordId) {
  broadcast('record:updated', {
    moduleName,
    recordId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit unread counts changed event
 */
export function emitUnreadCountsChanged() {
  broadcast('unread:changed', {
    timestamp: new Date().toISOString(),
  });
}

export default {
  addClient,
  broadcast,
  emitRecordCreated,
  emitRecordUpdated,
  emitUnreadCountsChanged,
};
