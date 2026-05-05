import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import machinesRoutes from './routes/machines.js';
import filesRoutes from './routes/files.js';
import importRoutes from './routes/import.js';
import v1MachinesRoutes from './routes/v1-machines.js';
import v1CapacityRoutes from './routes/v1-capacity.js';
import capacityRoutes from './routes/capacity.js';
import imToolsRoutes from './routes/im-tools.js';
import imToolVolumesRoutes from './routes/im-tool-volumes.js';
import imClassCapacityRoutes from './routes/im-class-capacity.js';
import imScenariosRoutes from './routes/im-scenarios.js';
import { ssoAuth } from './middleware/sso-auth.js';
import { serviceAuth } from './middleware/service-auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: 'http://localhost', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth check endpoint (SSO middleware)
app.get('/api/auth/me', ssoAuth, (req: any, res) => {
  res.json({
    userId: req.user.userId,
    username: req.user.username,
    role: req.user.role,
  });
});

// External service API (service-to-service bearer auth, for RFQ2/PLM2/etc)
app.use('/v1', serviceAuth, v1MachinesRoutes);
app.use('/v1/capacity', serviceAuth, v1CapacityRoutes);

// Protected routes - require SSO authentication
app.use('/api/machines', ssoAuth, machinesRoutes);
app.use('/api/files', ssoAuth, filesRoutes);
app.use('/api/import', ssoAuth, importRoutes);
app.use('/api/capacity', ssoAuth, capacityRoutes);
app.use('/api/im-tools', ssoAuth, imToolsRoutes);
app.use('/api/im-tool-volumes', ssoAuth, imToolVolumesRoutes);
app.use('/api/im-class-capacity', ssoAuth, imClassCapacityRoutes);
app.use('/api/im-scenarios', ssoAuth, imScenariosRoutes);

// Auth routes (disabled - use admin panel)
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`✓ Backend server running on port ${PORT}`);
  console.log(`✓ Frontend CORS enabled for ${FRONTEND_URL}`);
});
