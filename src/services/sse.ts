/**
 * Server-Sent Events (SSE) Service
 *
 * Provides real-time updates from the server for record changes.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type EventCallback = (data: unknown) => void;

interface EventListeners {
  [event: string]: EventCallback[];
}

class SSEService {
  private eventSource: EventSource | null = null;
  private listeners: EventListeners = {};
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      return; // Already connected
    }

    try {
      this.eventSource = new EventSource(`${API_URL}/events`);

      this.eventSource.onopen = () => {
        console.log('[SSE] Connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = () => {
        console.warn('[SSE] Connection error, will retry...');
        this.handleError();
      };

      // Listen for specific events
      this.eventSource.addEventListener('connected', (e) => {
        console.log('[SSE] Server confirmed connection');
        this.emit('connected', JSON.parse(e.data));
      });

      this.eventSource.addEventListener('record:created', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Record created:', data);
        this.emit('record:created', data);
      });

      this.eventSource.addEventListener('record:updated', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Record updated:', data);
        this.emit('record:updated', data);
      });

      this.eventSource.addEventListener('unread:changed', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Unread counts changed');
        this.emit('unread:changed', data);
      });
    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
      this.handleError();
    }
  }

  /**
   * Handle connection errors with exponential backoff
   */
  private handleError(): void {
    this.disconnect();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;

      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.warn('[SSE] Max reconnect attempts reached, falling back to polling');
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: string, data: unknown): void {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[SSE] Error in ${event} callback:`, error);
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Singleton instance
export const sseService = new SSEService();

export default sseService;
