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
import { detectSlaBreaches } from './services/slaMonitor.js';
import {
  detectInterviewRoomGaps,
  resolveStaleInterviewRoomAlerts,
} from './services/interviewRoomMonitor.js';
import { findAlertForUser } from './services/alertView.js';
import {
  emitAlertNew,
  emitAlertsResolved,
  emitRoomUpdated,
  emitSummaryUpdated,
} from './services/realtime.js';

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

// 緊急度の再計算（P1-6）と SLA 監視（P4-1）は同じ周期で回す。
// **タイマーを増やさないこと。** 監視系の処理はここに相乗りさせる。
const MONITOR_INTERVAL_MS = 60_000;
const monitorTimer = setInterval(async () => {
  try {
    const changedRoomIds = recalculateAllUrgencies(db);
    if (changedRoomIds.length > 0) {
      await Promise.all(changedRoomIds.map((roomId) => emitRoomUpdated(io, db, roomId)));
      emitSummaryUpdated(io, db);
    }
  } catch (error) {
    console.error('server: urgency recalculation failed', error.stack);
  }

  // 緊急度の更新に失敗しても SLA 監視は独立して動かす（try を分ける）
  try {
    // 新規に作られた通知だけが返る。既に通知済みのものは含まない
    for (const created of detectSlaBreaches(db)) {
      const alert = findAlertForUser(db, created.targetUserId, created.id);
      emitAlertNew(io, created.targetUserId, alert);
    }
  } catch (error) {
    console.error('server: SLA monitoring failed', error.stack);
  }

  // 面接会議室の未設定監視（P4-5）。SLA と独立して動かす
  try {
    // 先に掃除する。日程が変わった通知を閉じてから新しい日時のぶんを立てる
    emitAlertsResolved(io, db, resolveStaleInterviewRoomAlerts(db));

    for (const created of detectInterviewRoomGaps(db)) {
      const alert = findAlertForUser(db, created.targetUserId, created.id);
      emitAlertNew(io, created.targetUserId, alert);
    }
  } catch (error) {
    console.error('server: interview room monitoring failed', error.stack);
  }
}, MONITOR_INTERVAL_MS);
monitorTimer.unref();

httpServer.listen(PORT, () => {
  console.log(`server: listening on port ${PORT}`);
});
