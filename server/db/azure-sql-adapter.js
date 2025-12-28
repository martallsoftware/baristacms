/**
 * Azure SQL Database Adapter
 *
 * Uses mssql package for Azure SQL / SQL Server.
 * Fully async API.
 */

import sql from 'mssql';
import { DatabaseAdapter } from './interface.js';

export class AzureSQLAdapter extends DatabaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.pool = null;
  }

  async connect() {
    if (!this.pool) {
      this.pool = await sql.connect(this.config);
      console.log('Connected to Azure SQL Database');
    }
    return this.pool;
  }

  // Convert ? placeholders to @p1, @p2, etc. for mssql
  _convertPlaceholders(sqlQuery, params) {
    let index = 0;
    const convertedSql = sqlQuery.replace(/\?/g, () => `@p${index++}`);
    return convertedSql;
  }

  async all(sqlQuery, params = []) {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Bind parameters
      params.forEach((value, index) => {
        request.input(`p${index}`, value);
      });

      const convertedSql = this._convertPlaceholders(sqlQuery, params);
      const result = await request.query(convertedSql);
      return result.recordset || [];
    } catch (error) {
      console.error('Azure SQL all() error:', error.message);
      throw error;
    }
  }

  async get(sqlQuery, params = []) {
    const rows = await this.all(sqlQuery, params);
    return rows[0];
  }

  async run(sqlQuery, params = []) {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Bind parameters
      params.forEach((value, index) => {
        request.input(`p${index}`, value);
      });

      const convertedSql = this._convertPlaceholders(sqlQuery, params);

      // For INSERT, we need to get the inserted ID
      let finalSql = convertedSql;
      const isInsert = sqlQuery.trim().toUpperCase().startsWith('INSERT');
      if (isInsert) {
        // Add OUTPUT clause to get the inserted ID
        // This assumes the table has an 'id' column as primary key
        finalSql = convertedSql.replace(
          /INSERT\s+INTO\s+(\w+)\s*\(/i,
          'INSERT INTO $1 OUTPUT INSERTED.id ('
        );
      }

      const result = await request.query(finalSql);

      return {
        changes: result.rowsAffected[0] || 0,
        lastInsertRowid: isInsert && result.recordset?.[0]?.id
          ? result.recordset[0].id
          : null,
      };
    } catch (error) {
      console.error('Azure SQL run() error:', error.message);
      throw error;
    }
  }

  async exec(sqlStatements) {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Split by semicolon and execute each statement
      const statements = sqlStatements
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await request.query(stmt);
      }
    } catch (error) {
      console.error('Azure SQL exec() error:', error.message);
      throw error;
    }
  }

  async transaction(fn) {
    const pool = await this.connect();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();
      const result = await fn(this);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async isConnected() {
    try {
      const pool = await this.connect();
      await pool.request().query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // Helper method for ALTER TABLE that ignores "column already exists" errors
  async safeAddColumn(table, column, definition) {
    try {
      // Azure SQL syntax to check if column exists before adding
      const sql = `
        IF NOT EXISTS (
          SELECT * FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
        )
        BEGIN
          ALTER TABLE ${table} ADD ${column} ${definition}
        END
      `;
      await this.exec(sql);
      console.log(`Ensured column ${column} exists in ${table}`);
    } catch (error) {
      console.error(`Error adding column ${column} to ${table}:`, error.message);
      throw error;
    }
  }
}

export default AzureSQLAdapter;
