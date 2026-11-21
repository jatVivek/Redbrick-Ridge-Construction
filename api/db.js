import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
  if (!pool) {
    if (!process.env.MYSQL_HOST) {
      return null;
    }

    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
      ssl: process.env.MYSQL_SSL === 'false' ? false : { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}
