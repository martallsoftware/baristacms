/**
 * Database Interface
 *
 * This defines the contract that all database adapters must implement.
 * Supports both SQLite (development) and Azure SQL (production).
 */

/**
 * @typedef {Object} QueryResult
 * @property {Array} rows - Array of result rows
 * @property {number} changes - Number of rows affected (for INSERT/UPDATE/DELETE)
 * @property {number|null} lastInsertRowid - Last inserted row ID
 */

/**
 * Database adapter interface
 * @interface DatabaseAdapter
 */
export class DatabaseAdapter {
  /**
   * Execute a query that returns multiple rows
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<Array>} Array of row objects
   */
  async all(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Execute a query that returns a single row
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<Object|undefined>} Single row object or undefined
   */
  async get(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Execute a query that modifies data (INSERT/UPDATE/DELETE)
   * @param {string} sql - SQL query with ? placeholders
   * @param {Array} params - Parameters to bind
   * @returns {Promise<QueryResult>} Result with changes and lastInsertRowid
   */
  async run(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Execute raw SQL (for schema creation, etc.)
   * @param {string} sql - SQL to execute
   * @returns {Promise<void>}
   */
  async exec(sql) {
    throw new Error('Not implemented');
  }

  /**
   * Execute multiple statements in a transaction
   * @param {Function} fn - Function that receives the db and performs operations
   * @returns {Promise<any>} Result of the transaction function
   */
  async transaction(fn) {
    throw new Error('Not implemented');
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('Not implemented');
  }

  /**
   * Check if the database is connected
   * @returns {Promise<boolean>}
   */
  async isConnected() {
    throw new Error('Not implemented');
  }
}

export default DatabaseAdapter;
