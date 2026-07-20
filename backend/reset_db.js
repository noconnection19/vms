const db = require('./db');
const fs = require('fs');
const path = require('path');

async function resetDb() {
  try {
    console.log('Resetting all VMS database tables in PostgreSQL...');
    await db.run('TRUNCATE TABLE TRANSACTION_VISIT, MASTER_CARD, MASTER_USER, MASTER_ATTACHMENT, HIST_LOG RESTART IDENTITY CASCADE;');
    console.log('Database tables cleared successfully.');

    const uploadsDir = path.join(__dirname, 'Uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deletedCount = 0;
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(uploadsDir, file));
          deletedCount++;
        }
      }
      console.log(`Cleared ${deletedCount} files from Uploads directory.`);
    }

    console.log('SUCCESS: All VMS data has been completely reset!');
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    process.exit(0);
  }
}

resetDb();
