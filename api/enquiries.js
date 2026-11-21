import { getPool } from './db.js';

export default async function handler(req, res) {
  // CORS & headers
  res.setHeader('Content-Type', 'application/json');

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'MYSQL environment variables (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE) are missing.'
    });
  }

  try {
    if (req.method === 'GET') {
      const [rows] = await pool.query(
        'SELECT id, name, phone, email, postcode, project_type AS projectType, budget_band AS budgetBand, visit_pref AS visitPref, notes, status, created_at AS createdAt FROM enquiries ORDER BY created_at DESC'
      );
      return res.status(200).json({ success: true, data: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        id,
        name,
        phone,
        email = '',
        postcode,
        projectType = '',
        budgetBand = '',
        visitPref = '',
        notes = '',
        status = 'New Enquiry'
      } = body || {};

      if (!id || !name || !phone || !postcode) {
        return res.status(400).json({ error: 'Missing required fields: id, name, phone, postcode' });
      }

      await pool.query(
        `INSERT INTO enquiries (id, name, phone, email, postcode, project_type, budget_band, visit_pref, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           phone = VALUES(phone),
           email = VALUES(email),
           postcode = VALUES(postcode),
           project_type = VALUES(project_type),
           budget_band = VALUES(budget_band),
           visit_pref = VALUES(visit_pref),
           notes = VALUES(notes),
           status = VALUES(status)`,
        [id, name, phone, email, postcode, projectType, budgetBand, visitPref, notes, status]
      );

      return res.status(201).json({ success: true, message: 'Enquiry saved successfully' });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, status } = body || {};

      if (!id || !status) {
        return res.status(400).json({ error: 'Missing id or status' });
      }

      await pool.query('UPDATE enquiries SET status = ? WHERE id = ?', [status, id]);
      return res.status(200).json({ success: true, message: 'Status updated' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Missing enquiry id query parameter' });
      }

      await pool.query('DELETE FROM enquiries WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Enquiry deleted' });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Database query error', details: error.message });
  }
}
