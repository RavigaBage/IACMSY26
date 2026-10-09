const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/db');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const SocketService = require("./src/services/socketService");
const {registerAgentService} = require("./src/services/RegisterDevice");
const { initServices } = require("./src/services");
const createProtectedRoutes =require('./src/routes/protected');
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const corsOrigin = process.env.NODE_ENV === 'production' ? allowedOrigins : true;
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
    }
});
io.use((socket, next) => {
    const expectedToken = process.env.AGENT_TOKEN;
    if (process.env.NODE_ENV !== 'production' && !expectedToken) return next();

    const providedToken = socket.handshake.auth?.token;
    if (typeof expectedToken !== 'string' || typeof providedToken !== 'string') {
        return next(new Error('Agent authentication failed'));
    }

    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return next(new Error('Agent authentication failed'));
    }
    next();
});
app.set('io', io);
const socketService = new SocketService(io);
socketService.emitToDevice("LAB-PC-01", "cmd:test", {
    message: "Hello from server 🎯"
});

app.use(express.json());

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Trust loopback (localhost/Nginx), link-local, and RFC1918 private Docker subnets (172.16-31.x.x, 10.x.x.x, 192.168.x.x)
// This accurately extracts the real client IP from behind Nginx / Cloud Run / Docker while preventing client IP spoofing.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal');

// Global API rate limiter - protects against API flooding and scraping while accommodating normal dashboard usage
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000, // Generous ceiling for active dashboard usage and background polling (200 req/min)
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'API rate limit exceeded. Please slow down your requests.' },
    validate: { xForwardedForHeader: false },
});

app.use(cookieParser());
app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
const { commandService, dispatcher } = initServices(socketService);

app.use('/api', apiRateLimiter);
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/iac-mobile', require('./src/routes/urls/iacMobile'));
app.use('/api/summary', require('./src/routes/urls/summary'));
app.use('/api/public', require('./src/routes/public'));
app.use('/api', createProtectedRoutes(commandService));

// Ensure unhandled /api routes always return JSON, never HTML
app.use('/api', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `API endpoint ${req.method} ${req.originalUrl} not found`,
        error: `API endpoint ${req.method} ${req.originalUrl} not found`,
    });
});

const { protect } = require('./src/middleware/auth');
app.use('/uploads', protect, express.static(path.join(__dirname, 'uploads')));
app.use('/src/assets', express.static(path.join(__dirname, '../src/assets')));
app.use('/assets', express.static(path.join(__dirname, '../src/assets')));
const iacMobileAppDir = fs.existsSync(path.join(__dirname, '../iacmobile-app'))
    ? path.join(__dirname, '../iacmobile-app')
    : path.join(__dirname, '../IACMOBILE APP');
app.use('/IACMOBILE APP', express.static(path.join(__dirname, '../IACMOBILE APP')));
app.use('/iacmobile-app', express.static(iacMobileAppDir));
app.use('/attendanceForm', express.static(path.join(__dirname, '../attendanceForm')));
const distPath = path.join(__dirname, '../frontend/dist');
const indexPath = path.join(distPath, 'index.html');

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Any non-GET or API request that was not handled by previous routes should return JSON 404, never HTML
app.use((req, res, next) => {
    const isApi = req.path.startsWith('/api') || req.path.includes('/api/');
    if (req.method !== 'GET' || isApi) {
        return res.status(404).json({
            status: 'error',
            message: `Endpoint ${req.method} ${req.originalUrl} not found`,
            error: `Endpoint ${req.method} ${req.originalUrl} not found`,
        });
    }
    next();
});

app.get(/^(?!\/api).*/, (req, res) => {
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>IAC System — Setup Notice</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #1e293b; padding: 36px; border-radius: 12px; max-width: 580px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
          h2 { color: #38bdf8; margin-top: 0; font-size: 22px; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          code { background: #334155; padding: 3px 6px; border-radius: 4px; color: #f43f5e; font-size: 13px; font-family: Consolas, monospace; }
          .box { background: #090d16; padding: 14px 18px; border-radius: 8px; margin: 16px 0; border: 1px solid #1e293b; font-family: Consolas, monospace; font-size: 13px; color: #38bdf8; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Frontend Build Not Found (dist/index.html)</h2>
          <p>The backend server is running, but the frontend has not been compiled yet on your machine.</p>
          <p><strong>To run with pre-built frontend:</strong></p>
          <div class="box">npm run build<br>npm start</div>
          <p><strong>Or to run in development mode with live reload:</strong></p>
          <div class="box"># Terminal 1 (Backend):<br>cd backend &amp;&amp; npm run dev<br><br># Terminal 2 (Frontend):<br>cd frontend &amp;&amp; npm run dev</div>
        </div>
      </body>
      </html>
    `);
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    // Handle malformed JSON body from body-parser
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid JSON payload sent to server',
            error: 'Invalid JSON payload sent to server',
        });
    }
    console.error(err.stack || err.message);
    if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || err.message?.includes('buffering timed out')) {
        return res.status(503).json({
            status: 'error',
            message: 'Database service is unavailable',
        });
    }
    const isClientError = err.name === 'ValidationError' || err.name === 'CastError' || err.statusCode === 400 || (err.message && err.message.toLowerCase().includes('validation'));
    const statusCode = err.statusCode || (isClientError ? 400 : 500);
    res.status(statusCode).json({
        status: 'error',
        message: statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
        error: statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
    });
});



const PORT = (process.env.PORT && process.env.PORT !== '8080') ? process.env.PORT : (process.env.BACKEND_PORT || 3000);


io.on("connection", (socket) => {
    console.log("🟢 Agent connected:", socket.id);

    socket.on("disconnect", async () => {
        console.log("🔴 Agent disconnected:", socket.id, socket.deviceId);
        if (socket.deviceId) {
            socketService.unregisterDevice(socket.deviceId);
        }
        if (socket.deviceMongoId) {
            socketService.unregisterDevice(socket.deviceMongoId);
        }
        if (socket.deviceId || socket.deviceMongoId) {
            try {
                const { devices } = require('./src/models');
                const mongoose = require('mongoose');
                const disQuery = [];
                if (socket.deviceId) disQuery.push({ deviceId: socket.deviceId });
                if (socket.deviceMongoId && mongoose.Types.ObjectId.isValid(socket.deviceMongoId)) {
                    disQuery.push({ _id: socket.deviceMongoId });
                }
                if (disQuery.length > 0) {
                    await devices.findOneAndUpdate(
                        { $or: disQuery },
                        { $set: { "status.remoteAgent": "offline", "security.lastSeen": new Date() } }
                    );
                }
            } catch (err) {
                console.error("Error setting device offline on disconnect:", err.message);
            }
        }
    });

    socket.on("agent:register", async (data) => {
        socket.deviceId = data.deviceId;
        socket.join(`device:${data.deviceId}`);
        const regResult = await registerAgentService(data);
        if (regResult?.status !== "success" || !regResult.data_?._id) {
            console.error(`[Socket] Device registration failed for ${data.deviceId}: ${regResult?.message || "No device record returned"}`);
            socket.emit("agent:registered", {
                status: "error",
                deviceId: data.deviceId,
                message: regResult?.message || "Device registration failed",
            });
            return;
        }
        socket.deviceMongoId = regResult.data_._id.toString();
        socket.join(`device:${socket.deviceMongoId}`);
        socketService.registerDevice(socket.deviceMongoId, socket);
        socketService.registerDevice(data.deviceId, socket);

        if (dispatcher) {
            dispatcher.registerDeviceListeners(socket);
        }

        socket.emit("agent:registered", {
            status: "success",
            deviceId: data.deviceId,
            id: socket.deviceMongoId
        });
        console.log(`[Socket] Device registered: ${data.deviceId} (${socket.deviceMongoId || "new"})`);
    });

    socket.on("cmd:test", (payload) => {
        console.log("📨 Test command received:", payload);
        socket.emit("cmd:test:response", {
            message: "Agent received command successfully 🎯",
            time: Date.now()
        });
    });
});

app.get("/test", (req, res) => {
    io.emit("cmd:test", { message:''});
    res.send("Test command sent");
});

function validateProductionConfig() {
    if (process.env.NODE_ENV !== 'production') return;

    const required = [
        'MONGO_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'JWT_TICKET',
        'AGENT_TOKEN',
        'CORS_ORIGINS',
        'INITIAL_ADMIN_EMAIL',
        'INITIAL_ADMIN_PASSWORD',
        'INITIAL_ADMIN_NAME',
    ];
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length) {
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }
    if (process.env.USE_MEMORY_DB === 'true') {
        throw new Error('USE_MEMORY_DB must be false in production');
    }
    if (process.env.COOKIE_SECURE !== 'true') {
        throw new Error('COOKIE_SECURE must be true in production');
    }
    for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_TICKET', 'AGENT_TOKEN']) {
        if (process.env[name].length < 32 || /^(your_|replace_|dummy_)/i.test(process.env[name])) {
            throw new Error(`${name} must be a unique, non-placeholder value of at least 32 characters in production`);
        }
    }
    if (process.env.INITIAL_ADMIN_PASSWORD.length < 16 || /^(your_|replace_|dummy_)/i.test(process.env.INITIAL_ADMIN_PASSWORD)) {
        throw new Error('INITIAL_ADMIN_PASSWORD must be a non-placeholder value of at least 16 characters in production');
    }
    if (process.env.INITIAL_ADMIN_EMAIL.endsWith('@example.com')) {
        throw new Error('INITIAL_ADMIN_EMAIL must be a real administrator email in production');
    }
    if (new Set([process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET, process.env.JWT_TICKET, process.env.AGENT_TOKEN]).size !== 4) {
        throw new Error('JWT secrets and the agent token must be unique in production');
    }
    const origins = allowedOrigins.map((origin) => new URL(origin));
    if (!origins.length || origins.some((origin) => origin.protocol !== 'https:' || origin.hostname.endsWith('.example'))) {
        throw new Error('CORS_ORIGINS must contain real HTTPS origins in production');
    }
}

const startServer = async () => {
    validateProductionConfig();
    await connectDB();
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
};

startServer().catch((err) => {
    console.error(`❌ Server startup failed: ${err.message}`);
    process.exit(1);
});