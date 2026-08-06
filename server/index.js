import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
// 環境変数の検証を最初に走らせる（JWT_SECRET 未設定のまま起動させない）。
import { PORT, CLIENT_ORIGIN } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { registerSocketHandlers } from './sockets/index.js';
import db from './db/index.js';
import { recalculateAllUrgencies } from './services/urgencyCalculator.js';
import {
  emitRoomUpdated,
  emitScheduleRequestUpdated,
  emitSummaryUpdated,
} from './services/realtime.js';
import { expireWaitingScheduleRequests } from './services/scheduleRequests.js';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use('/api', routes);
app.use('/api', notFoundHandler);
app.use(errorHandler);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

app.set('io', io);
registerSocketHandlers(io);

const URGENCY_RECALC_INTERVAL_MS = 60_000;
const urgencyTimer = setInterval(async () => {
  try {
    const changedRoomIds = recalculateAllUrgencies(db);
    if (changedRoomIds.length === 0) return;

    await Promise.all(changedRoomIds.map((roomId) => emitRoomUpdated(io, db, roomId)));
    emitSummaryUpdated(io, db);
  } catch (error) {
    console.error('server: urgency recalculation failed', error.stack);
  }
}, URGENCY_RECALC_INTERVAL_MS);
urgencyTimer.unref();

const scheduleExpiryTimer = setInterval(async () => {
  try {
    const expired = expireWaitingScheduleRequests(db);
    if (expired.length === 0) return;
    const roomIds = [...new Set(expired.map((request) => request.roomId))];
    await Promise.all([
      ...expired.map((request) => emitScheduleRequestUpdated(io, request)),
      ...roomIds.map((roomId) => emitRoomUpdated(io, db, roomId)),
    ]);
  } catch (error) {
    console.error('server: schedule expiry update failed', error.stack);
  }
}, 60_000);
scheduleExpiryTimer.unref();

httpServer.listen(PORT, () => {
  console.log(`server: listening on port ${PORT}`);
});
