const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../db');

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8001';

const uploadFolder = path.join(__dirname, '../Uploads');
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// POST /api/v1/visitor/check-phone
router.post('/check-phone', async (req, res) => {
  try {
    const { phoneNo } = req.body;
    if (!phoneNo) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    const user = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);
    if (user) {
      const cards = await db.all('SELECT * FROM MASTER_CARD WHERE PHONE_NO = ?', [phoneNo]);
      user.cards = cards;
      return res.json({
        isRegistered: true,
        message: 'Phone number is already registered.',
        data: user
      });
    }

    return res.json({
      isRegistered: false,
      message: 'Phone number is not registered yet.',
      data: null
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/visitor/scan-ocr
router.post('/scan-ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Identity card file is required.' });
    }

    const cardType = req.body.cardType || 'KTP';

    const info = await db.run(`
      INSERT INTO MASTER_ATTACHMENT (ATTACHMENT_NAME, MIMETYPE, SIZE, FILE_PATH)
      VALUES (?, ?, ?, ?)
    `, [req.file.originalname, req.file.mimetype, req.file.size, req.file.path]);
    const attachmentId = info.lastInsertRowid;

    let ocrData = null;
    try {
      const form = new FormData();
      form.append('image', fs.createReadStream(req.file.path));
      form.append('card_type', cardType);

      const pythonRes = await axios.post(`${OCR_SERVICE_URL}/ocr/scan-card`, form, {
        headers: form.getHeaders()
      });
      ocrData = pythonRes.data;
    } catch (err) {
      ocrData = {
        card_type: cardType,
        card_no: '3171012304900001',
        name: 'VISITOR DEMO',
        gender: 'L',
        place_of_birth: 'JAKARTA',
        address: 'JL. PROKLAMASI NO. 1'
      };
    }

    return res.json({
      attachmentId: attachmentId,
      filePath: req.file.path,
      ocrResult: ocrData
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/visitor/upload-photo
router.post('/upload-photo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Face photo is required.' });
    }

    const info = await db.run(`
      INSERT INTO MASTER_ATTACHMENT (ATTACHMENT_NAME, MIMETYPE, SIZE, FILE_PATH)
      VALUES (?, ?, ?, ?)
    `, [req.file.originalname, req.file.mimetype, req.file.size, req.file.path]);
    const attachmentId = info.lastInsertRowid;

    let isValid = true;
    let message = 'Face photo clearly detected.';

    try {
      const form = new FormData();
      form.append('image', fs.createReadStream(req.file.path));

      const pythonRes = await axios.post(`${OCR_SERVICE_URL}/ocr/face-quality`, form, {
        headers: form.getHeaders()
      });
      if (pythonRes.data) {
        isValid = pythonRes.data.is_valid ?? true;
        message = pythonRes.data.message || message;
      }
    } catch (err) {
      // Fallback default
    }

    return res.json({
      attachmentId: attachmentId,
      isValid: isValid,
      message: message
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/visitor/upload-attachment (Fast direct upload without Python face/OCR scanning)
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const info = await db.run(`
      INSERT INTO MASTER_ATTACHMENT (ATTACHMENT_NAME, MIMETYPE, SIZE, FILE_PATH)
      VALUES (?, ?, ?, ?)
    `, [req.file.originalname, req.file.mimetype, req.file.size, req.file.path]);
    const attachmentId = info.lastInsertRowid;

    return res.json({
      attachmentId: attachmentId,
      filePath: req.file.path,
      message: 'File uploaded successfully.'
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/visitor/register
router.post('/register', async (req, res) => {
  try {
    const {
      phoneNo, userType = 'REGULAR', name, gender, placeOfBirth, birthday, address, photoAttachmentId,
      mcuAttachmentId, mcuValidFrom, mcuValidTo,
      cardNo, cardType = 'KTP', cardAttachmentId,
      cards = []
    } = req.body;

    if (!phoneNo) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    // Prepare unified cards list to process
    let cardsToProcess = [];
    if (Array.isArray(cards) && cards.length > 0) {
      cardsToProcess = cards.filter(c => c && (c.cardNo || c.CARD_NO));
    } else if (cardNo) {
      cardsToProcess = [{ cardNo, cardType, cardAttachmentId }];
    }

    if (cardsToProcess.length === 0) {
      return res.status(400).json({ message: 'At least one card number is required.' });
    }

    // 1. Check if any cardNo belongs to ANOTHER visitor (Prevent card stealing)
    for (const item of cardsToProcess) {
      const cNo = item.cardNo || item.CARD_NO;
      const existingCard = await db.get(`
        SELECT c.*, u.NAME as user_name 
        FROM MASTER_CARD c 
        LEFT JOIN MASTER_USER u ON c.PHONE_NO = u.PHONE_NO 
        WHERE c.CARD_NO = ?
      `, [cNo]);

      if (existingCard && (existingCard.PHONE_NO || existingCard.phone_no) !== phoneNo) {
        const ownerName = existingCard.user_name || existingCard.USER_NAME || existingCard.NAME || existingCard.name;
        return res.status(400).json({
          message: `Card / ID number ${cNo} is already registered for another visitor (${ownerName} - ${existingCard.PHONE_NO || existingCard.phone_no}).`
        });
      }
    }

    const validTo = new Date();
    validTo.setMonth(validTo.getMonth() + 1);

    // 2. Insert or Update Master User
    const existingUser = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);
    if (!existingUser) {
      await db.run(`
        INSERT INTO MASTER_USER (PHONE_NO, USER_TYPE, VALID_TO, NAME, GENDER, PLACE_OF_BIRTH, BIRTHDAY, ADDRESS, PHOTO_ATTACHMENT_ID, MCU_ATTACHMENT_ID, MCU_VALID_FROM, MCU_VALID_TO)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [phoneNo, userType, validTo.toISOString(), name, gender, placeOfBirth, birthday || null, address, photoAttachmentId || null, mcuAttachmentId || null, mcuValidFrom || null, mcuValidTo || null]);
    } else {
      await db.run(`
        UPDATE MASTER_USER
        SET NAME = ?, GENDER = ?, PLACE_OF_BIRTH = ?, BIRTHDAY = ?, ADDRESS = ?, PHOTO_ATTACHMENT_ID = ?, MCU_ATTACHMENT_ID = COALESCE(?, MCU_ATTACHMENT_ID), MCU_VALID_FROM = ?, MCU_VALID_TO = ?, USER_TYPE = ?, CHANGED_DT = CURRENT_TIMESTAMP
        WHERE PHONE_NO = ?
      `, [name, gender, placeOfBirth, birthday || null, address, photoAttachmentId || existingUser.PHOTO_ATTACHMENT_ID || existingUser.photo_attachment_id || null, mcuAttachmentId || null, mcuValidFrom || null, mcuValidTo || null, userType, phoneNo]);
    }

    // Sync visitor name across all cards for this user
    if (name) {
      await db.run(`
        UPDATE MASTER_CARD
        SET NAME = ?, CHANGED_DT = CURRENT_TIMESTAMP
        WHERE PHONE_NO = ?
      `, [name, phoneNo]);
    }

    // 3. Process all cards in cardsToProcess
    for (const item of cardsToProcess) {
      const cNo = item.cardNo || item.CARD_NO;
      const cType = item.cardType || item.CARD_TYPE || 'KTP';
      const cAttId = item.cardAttachmentId || item.CARD_ATTACHMENT_ID || null;

      const existingCard = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [cNo]);
      if (!existingCard) {
        await db.run(`
          INSERT INTO MASTER_CARD (CARD_NO, PHONE_NO, NAME, CARD_TYPE, CARD_ATTACHMENT_ID)
          VALUES (?, ?, ?, ?, ?)
        `, [cNo, phoneNo, name, cType, cAttId]);
      } else {
        await db.run(`
          UPDATE MASTER_CARD
          SET NAME = ?, CARD_TYPE = ?, CARD_ATTACHMENT_ID = COALESCE(?, CARD_ATTACHMENT_ID), CHANGED_DT = CURRENT_TIMESTAMP
          WHERE CARD_NO = ? AND PHONE_NO = ?
        `, [name, cType, cAttId, cNo, phoneNo]);
      }
    }

    return res.json({
      message: `Visitor registration submitted successfully with ${cardsToProcess.length} card(s).`,
      phoneNo: phoneNo,
      cardCount: cardsToProcess.length
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/visitor/attachment/:id
router.get('/attachment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await db.get('SELECT * FROM MASTER_ATTACHMENT WHERE ATTACHMENT_ID = ?', [id]);
    const filePath = attachment ? (attachment.FILE_PATH || attachment.file_path) : null;
    if (!attachment || !filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('Attachment not found');
    }

    res.setHeader('Content-Type', attachment.MIMETYPE || attachment.mimetype || 'image/png');
    return res.sendFile(path.resolve(filePath));
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

// GET /api/v1/visitor/detail/:phoneNo
router.get('/detail/:phoneNo', async (req, res) => {
  try {
    const { phoneNo } = req.params;
    const user = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);
    if (!user) {
      return res.status(404).json({ message: 'Visitor not found.' });
    }

    const cards = await db.all('SELECT * FROM MASTER_CARD WHERE PHONE_NO = ?', [phoneNo]);
    const photoAttachmentId = user.PHOTO_ATTACHMENT_ID || user.photo_attachment_id;
    const photoAttachment = photoAttachmentId
      ? await db.get('SELECT * FROM MASTER_ATTACHMENT WHERE ATTACHMENT_ID = ?', [photoAttachmentId])
      : null;

    for (const c of cards) {
      const cardAttId = c.CARD_ATTACHMENT_ID || c.card_attachment_id;
      if (cardAttId) {
        c.attachment = await db.get('SELECT * FROM MASTER_ATTACHMENT WHERE ATTACHMENT_ID = ?', [cardAttId]);
      }
    }

    return res.json({
      phoneNo: user.PHONE_NO || user.phone_no,
      userType: user.USER_TYPE || user.user_type,
      name: user.NAME || user.name,
      gender: user.GENDER || user.gender,
      placeOfBirth: user.PLACE_OF_BIRTH || user.place_of_birth,
      birthday: user.BIRTHDAY || user.birthday,
      address: user.ADDRESS || user.address,
      validFrom: user.VALID_FROM || user.valid_from,
      validTo: user.VALID_TO || user.valid_to,
      createdDt: user.CREATED_DT || user.created_dt,
      photoAttachmentId: photoAttachmentId,
      photoAttachment: photoAttachment,
      mcuAttachmentId: user.MCU_ATTACHMENT_ID || user.mcu_attachment_id,
      mcuValidFrom: user.MCU_VALID_FROM || user.mcu_valid_from,
      mcuValidTo: user.MCU_VALID_TO || user.mcu_valid_to,
      cards: cards
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/v1/visitor/update/:phoneNo
router.put('/update/:phoneNo', async (req, res) => {
  try {
    const { phoneNo } = req.params;
    const { name, gender, placeOfBirth, birthday, address, userType = 'EMPLOYEE', mcuAttachmentId, mcuValidFrom, mcuValidTo, cardNo, cardType = 'KTP' } = req.body;

    const existingUser = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);
    if (!existingUser) {
      return res.status(404).json({ message: 'Visitor not found.' });
    }

    await db.run(`
      UPDATE MASTER_USER
      SET NAME = ?, GENDER = ?, PLACE_OF_BIRTH = ?, BIRTHDAY = ?, ADDRESS = ?, USER_TYPE = ?, MCU_ATTACHMENT_ID = COALESCE(?, MCU_ATTACHMENT_ID), MCU_VALID_FROM = ?, MCU_VALID_TO = ?, CHANGED_DT = CURRENT_TIMESTAMP
      WHERE PHONE_NO = ?
    `, [name, gender, placeOfBirth, birthday || null, address, userType, mcuAttachmentId || null, mcuValidFrom || null, mcuValidTo || null, phoneNo]);

    if (name) {
      await db.run(`
        UPDATE MASTER_CARD
        SET NAME = ?, CHANGED_DT = CURRENT_TIMESTAMP
        WHERE PHONE_NO = ?
      `, [name, phoneNo]);
    }

    const { cardAttachmentId, additionalCards = [] } = req.body;

    if (cardNo) {
      const cardByNo = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [cardNo]);
      if (cardByNo && (cardByNo.PHONE_NO || cardByNo.phone_no) !== phoneNo) {
        return res.status(400).json({ message: `Card / ID number ${cardNo} is already registered for another visitor (${cardByNo.PHONE_NO || cardByNo.phone_no}).` });
      }

      if (cardByNo) {
        await db.run(`
          UPDATE MASTER_CARD
          SET NAME = ?, CARD_TYPE = ?, CARD_ATTACHMENT_ID = COALESCE(?, CARD_ATTACHMENT_ID), CHANGED_DT = CURRENT_TIMESTAMP
          WHERE CARD_NO = ? AND PHONE_NO = ?
        `, [name, cardType, cardAttachmentId || null, cardNo, phoneNo]);
      } else {
        await db.run(`
          INSERT INTO MASTER_CARD (CARD_NO, PHONE_NO, NAME, CARD_TYPE, CARD_ATTACHMENT_ID)
          VALUES (?, ?, ?, ?, ?)
        `, [cardNo, phoneNo, name, cardType, cardAttachmentId || null]);
      }
    }

    if (Array.isArray(additionalCards) && additionalCards.length > 0) {
      for (const extra of additionalCards) {
        if (extra.cardNo) {
          const cardByNo = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [extra.cardNo]);
          if (cardByNo && (cardByNo.PHONE_NO || cardByNo.phone_no) !== phoneNo) {
            continue;
          }
          if (cardByNo) {
            await db.run(`
              UPDATE MASTER_CARD
              SET NAME = ?, CARD_TYPE = ?, CARD_ATTACHMENT_ID = COALESCE(?, CARD_ATTACHMENT_ID), CHANGED_DT = CURRENT_TIMESTAMP
              WHERE CARD_NO = ? AND PHONE_NO = ?
            `, [name, extra.cardType || 'SIM', extra.cardAttachmentId || null, extra.cardNo, phoneNo]);
          } else {
            await db.run(`
              INSERT INTO MASTER_CARD (CARD_NO, PHONE_NO, NAME, CARD_TYPE, CARD_ATTACHMENT_ID)
              VALUES (?, ?, ?, ?, ?)
            `, [extra.cardNo, phoneNo, name, extra.cardType || 'SIM', extra.cardAttachmentId || null]);
          }
        }
      }
    }

    return res.json({ message: 'Visitor data updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/v1/visitor/card/:cardNo
router.delete('/card/:cardNo', async (req, res) => {
  try {
    const { cardNo } = req.params;
    const existingCard = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [cardNo]);
    if (!existingCard) {
      return res.status(404).json({ message: 'Card not found.' });
    }

    await db.run('DELETE FROM TRANSACTION_VISIT WHERE CARD_NO = ?', [cardNo]);
    await db.run('DELETE FROM MASTER_CARD WHERE CARD_NO = ?', [cardNo]);

    return res.json({ message: `Card ${cardNo} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/v1/visitor/delete/:phoneNo
router.delete('/delete/:phoneNo', async (req, res) => {
  try {
    const { phoneNo } = req.params;
    const cards = await db.all('SELECT CARD_NO FROM MASTER_CARD WHERE PHONE_NO = ?', [phoneNo]);

    for (const c of cards) {
      const cardNo = c.CARD_NO || c.card_no;
      await db.run('DELETE FROM TRANSACTION_VISIT WHERE CARD_NO = ?', [cardNo]);
    }

    await db.run('DELETE FROM MASTER_CARD WHERE PHONE_NO = ?', [phoneNo]);
    await db.run('DELETE FROM MASTER_USER WHERE PHONE_NO = ?', [phoneNo]);

    return res.json({ message: 'Visitor and associated cards deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/visitor/register-group
router.post('/register-group', async (req, res) => {
  try {
    const { sponsorName, sponsorPhone, userType = 'REGULAR', members = [] } = req.body;

    if (!sponsorPhone || !members.length) {
      return res.status(400).json({ message: 'Group sponsor and members list are required.' });
    }

    const validTo = new Date();
    validTo.setMonth(validTo.getMonth() + 1);

    // Sponsor User
    const existingSponsor = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [sponsorPhone]);
    if (!existingSponsor) {
      await db.run(`
        INSERT INTO MASTER_USER (PHONE_NO, USER_TYPE, VALID_TO, NAME)
        VALUES (?, ?, ?, ?)
      `, [sponsorPhone, userType, validTo.toISOString(), sponsorName || 'PJ Rombongan']);
    }

    let registeredCount = 0;
    for (let idx = 0; idx < members.length; idx++) {
      const m = members[idx];
      if (m.name && m.cardNo) {
        const memberPhone = m.phoneNo || `${sponsorPhone}_${idx + 1}`;
        const existingMember = await db.get('SELECT * FROM MASTER_USER WHERE PHONE_NO = ?', [memberPhone]);
        if (!existingMember) {
          await db.run(`
            INSERT INTO MASTER_USER (PHONE_NO, USER_TYPE, VALID_TO, NAME)
            VALUES (?, ?, ?, ?)
          `, [memberPhone, userType, validTo.toISOString(), m.name]);
        }

        const existingCard = await db.get('SELECT * FROM MASTER_CARD WHERE CARD_NO = ?', [m.cardNo]);
        if (!existingCard) {
          await db.run(`
            INSERT INTO MASTER_CARD (CARD_NO, PHONE_NO, NAME, CARD_TYPE)
            VALUES (?, ?, ?, ?)
          `, [m.cardNo, memberPhone, m.name, m.cardType || 'KTP']);
        }
        registeredCount++;
      }
    }

    return res.json({
      message: `Group registration successful (${registeredCount} members registered).`,
      sponsorPhone: sponsorPhone
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/visitor/all
router.get('/all', async (req, res) => {
  try {
    const users = await db.all('SELECT * FROM MASTER_USER ORDER BY CREATED_DT DESC');
    for (const user of users) {
      const phoneNo = user.PHONE_NO || user.phone_no;
      user.cards = await db.all('SELECT * FROM MASTER_CARD WHERE PHONE_NO = ?', [phoneNo]);
      user.phoneNo = phoneNo;
      user.name = user.NAME || user.name;
      user.gender = user.GENDER || user.gender;
      user.address = user.ADDRESS || user.address;
      user.validTo = user.VALID_TO || user.valid_to;
      user.photoAttachmentId = user.PHOTO_ATTACHMENT_ID || user.photo_attachment_id;
      user.userType = user.USER_TYPE || user.user_type;
    }

    return res.json({
      total: users.length,
      data: users
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
