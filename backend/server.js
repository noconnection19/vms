const express = require('express');
const cors = require('cors');
const path = require('path');
const auditLogger = require('./middleware/auditLogger');
const authRoutes = require('./routes/authRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const gateRoutes = require('./routes/gateRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Express Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom Database Audit Logger Middleware (HIST_LOG)
app.use(auditLogger);

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/visitor', visitorRoutes);
app.use('/api/v1/gate', gateRoutes);
app.use('/api/v1/system', systemRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'VMS Node.js Core Backend' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 VMS Node.js Backend listening at http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
