const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

async function validateMcuAccess(phoneNo) {
  if (!phoneNo) return { allowed: true };
  const user = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);
  if (!user) return { allowed: true };

  const userType = user.USER_TYPE || user.user_type || 'VISITOR';
  if (userType !== 'EMPLOYEE') {
    return { allowed: true };
  }

  const mcuFrom = user.MCU_VALID_FROM || user.mcu_valid_from;
  const mcuTo = user.MCU_VALID_TO || user.mcu_valid_to;

  if (!mcuFrom || !mcuTo) {
    return {
      allowed: false,
      message: 'Access Denied: Employee MCU validity period is not set.'
    };
  }

  const todayStr = new Date().toISOString().substring(0, 10);
  const fromStr = String(mcuFrom).substring(0, 10);
  const toStr = String(mcuTo).substring(0, 10);

  if (todayStr < fromStr) {
    return {
      allowed: false,
      message: `Access Denied: Employee MCU is not yet valid (Valid from: ${fromStr}).`
    };
  }

  if (todayStr > toStr) {
    return {
      allowed: false,
      message: `Access Denied: Employee MCU has expired (Valid to: ${toStr}).`
    };
  }

  return { allowed: true };
}

// POST /api/v1/gate/check-in
router.post('/check-in', async (req, res) => {
  try {
    const { cardNo } = req.body;
    if (!cardNo) {
      return res.status(400).json({ message: 'Card number is required.' });
    }

    let card = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [cardNo]);
    if (!card) {
      const user = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [cardNo]);
      if (user) {
        card = await db.get('SELECT * FROM MASTER_CARD WHERE PHONE_NO = ?', [user.PHONE_NO || user.phone_no]);
      }
    }

    if (!card) {
      return res.status(404).json({
        accessGranted: false,
        message: 'Card / Visitor not registered. Please register first.'
      });
    }

    const phoneNo = card.PHONE_NO || card.phone_no;
    const mcuCheck = await validateMcuAccess(phoneNo);
    if (!mcuCheck.allowed) {
      return res.status(403).json({
        accessGranted: false,
        message: mcuCheck.message
      });
    }

    const cardNum = card.CARD_NO || card.card_no;
    const activeVisit = await db.get('SELECT * FROM TRANSACTION_VISIT WHERE CARD_NO = ? AND CHECK_OUT IS NULL', [cardNum]);
    if (activeVisit) {
      return res.json({
        accessGranted: true,
        message: 'Visitor already checked in. Gate Opened.',
        visit: activeVisit
      });
    }

    const visitId = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO TRANSACTION_VISIT (VISIT_ID, CARD_NO, CHECK_IN)
      VALUES (?, ?, ?)
    `, [visitId, cardNum, now]);

    const visit = await db.get('SELECT * FROM TRANSACTION_VISIT WHERE VISIT_ID = ?', [visitId]);

    return res.json({
      accessGranted: true,
      message: 'Check-In successful. Gate Opened!',
      visit: visit
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/gate/check-out
router.post('/check-out', async (req, res) => {
  try {
    const { cardNo } = req.body;
    if (!cardNo) {
      return res.status(400).json({ message: 'Card number is required.' });
    }

    let card = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [cardNo]);
    if (!card) {
      const user = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [cardNo]);
      if (user) {
        card = await db.get('SELECT * FROM MASTER_CARD WHERE PHONE_NO = ?', [user.PHONE_NO || user.phone_no]);
      }
    }

    if (!card) {
      return res.status(404).json({
        accessGranted: false,
        message: 'Card / Visitor not registered.'
      });
    }

    const phoneNo = card.PHONE_NO || card.phone_no;
    const mcuCheck = await validateMcuAccess(phoneNo);
    if (!mcuCheck.allowed) {
      return res.status(403).json({
        accessGranted: false,
        message: mcuCheck.message
      });
    }

    const cardNum = card.CARD_NO || card.card_no;
    const activeVisit = await db.get('SELECT * FROM TRANSACTION_VISIT WHERE CARD_NO = ? AND CHECK_OUT IS NULL ORDER BY CHECK_IN DESC', [cardNum]);
    if (!activeVisit) {
      return res.status(400).json({
        accessGranted: false,
        message: 'Visitor has not checked in! Please check in at the Entrance Gate first.'
      });
    }

    const now = new Date().toISOString();
    const visitId = activeVisit.VISIT_ID || activeVisit.visit_id;
    await db.run(`
      UPDATE TRANSACTION_VISIT
      SET CHECK_OUT = ?, CHANGED_DT = CURRENT_TIMESTAMP
      WHERE VISIT_ID = ?
    `, [now, visitId]);

    activeVisit.CHECK_OUT = now;
    activeVisit.checkOut = now;

    return res.json({
      accessGranted: true,
      message: 'Check-Out successful. Gate Opened!',
      visit: activeVisit
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/gate/visits
router.get('/visits', async (req, res) => {
  try {
    const visits = await db.all(`
      SELECT v.*, COALESCE(u.NAME, c.NAME) as card_name, c.CARD_TYPE as card_type
      FROM TRANSACTION_VISIT v
      LEFT JOIN MASTER_CARD c ON v.CARD_NO = c.CARD_NO
      LEFT JOIN MASTER_USER u ON c.PHONE_NO = u.PHONE_NO
      ORDER BY v.CHECK_IN DESC
      LIMIT 50
    `);

    visits.forEach(v => {
      v.visitId = v.VISIT_ID || v.visit_id;
      v.cardNo = v.CARD_NO || v.card_no;
      v.checkIn = v.CHECK_IN || v.check_in;
      v.checkOut = v.CHECK_OUT || v.check_out;
      v.card = { name: v.card_name || v.CARD_NAME, cardType: v.card_type || v.CARD_TYPE };
    });

    return res.json({
      total: visits.length,
      data: visits
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/gate/stats
router.get('/stats', async (req, res) => {
  try {
    const totalRes = await db.get('SELECT COUNT(*) as count FROM MASTER_USER');
    const activeRes = await db.get('SELECT COUNT(*) as count FROM TRANSACTION_VISIT WHERE CHECK_OUT IS NULL');
    
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayRes = await db.get('SELECT COUNT(*) as count FROM TRANSACTION_VISIT WHERE CHECK_OUT IS NOT NULL AND DATE(CHECK_OUT) = ?::date', [todayStr]);

    return res.json({
      totalVisitors: parseInt(totalRes ? (totalRes.count || totalRes.COUNT || 0) : 0, 10),
      activeCheckIns: parseInt(activeRes ? (activeRes.count || activeRes.COUNT || 0) : 0, 10),
      todayCheckOuts: parseInt(todayRes ? (todayRes.count || todayRes.COUNT || 0) : 0, 10),
      gateStatus: 'OPERATIONAL'
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
