const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/v1/system/master
router.get('/master', async (req, res) => {
  try {
    const systems = await db.all('SELECT * FROM MASTER_SYSTEM');
    systems.forEach(s => {
      s.systemType = s.SYSTEM_TYPE || s.system_type;
      s.systemCd = s.SYSTEM_CD || s.system_cd;
      s.systemValue = s.SYSTEM_VALUE || s.system_value;
      s.remarks = s.REMARKS || s.remarks;
    });

    return res.json({
      total: systems.length,
      data: systems
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/system/admins
router.get('/admins', async (req, res) => {
  try {
    const admins = await db.all('SELECT USERNAME, ROLE, NAME, CREATED_DT, CREATED_BY FROM MASTER_ADMIN');
    admins.forEach(a => {
      a.username = a.USERNAME || a.username;
      a.role = a.ROLE || a.role;
      a.name = a.NAME || a.name;
      a.createdDt = a.CREATED_DT || a.created_dt;
      a.createdBy = a.CREATED_BY || a.created_by;
    });

    return res.json({
      total: admins.length,
      data: admins
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/system/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM HIST_LOG ORDER BY CREATED_DT DESC LIMIT 100');
    logs.forEach(l => {
      l.logId = l.LOG_ID || l.log_id;
      l.apiUrl = l.API_URL || l.api_url;
      l.method = l.METHOD || l.method;
      l.paramBody = l.PARAM_BODY || l.param_body;
      l.paramQuery = l.PARAM_QUERY || l.param_query;
      l.response = l.RESPONSE || l.response;
      l.createdDt = l.CREATED_DT || l.created_dt;
    });

    return res.json({
      total: logs.length,
      data: logs
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/system/reset-data
router.post('/reset-data', async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  try {
    await db.run('TRUNCATE TABLE TRANSACTION_VISIT, MASTER_CARD, MASTER_USER, MASTER_ATTACHMENT, HIST_LOG RESTART IDENTITY CASCADE;');

    const uploadsDir = path.join(__dirname, '..', 'Uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      }
    }

    return res.json({ success: true, message: 'All transaction data, visitors, cards, and photos reset successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
