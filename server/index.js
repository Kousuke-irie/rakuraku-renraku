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
  emitAlertsNew,
  emitAlertsResolved,
  emitRoomUpdated,
  emitScheduleRequestUpdated,
  emitSummaryUpdated,
} from './services/realtime.js';
import { expireWaitingScheduleRequests } from './services/scheduleRequests.js';
import { detectSlaBreaches } from './services/slaMonitor.js';
import {
  detectInterviewRoomGaps,
  resolveStaleInterviewRoomAlerts,
} from './services/interviewRoomMonitor.js';

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
    emitAlertsNew(io, db, detectSlaBreaches(db));
  } catch (error) {
    console.error('server: SLA monitoring failed', error.stack);
  }

  // 面接会議室の未設定監視（P4-5）。SLA と独立して動かす
  try {
    // 先に掃除する。日程が変わった通知を閉じてから新しい日時のぶんを立てる
    emitAlertsResolved(io, db, resolveStaleInterviewRoomAlerts(db));
    emitAlertsNew(io, db, detectInterviewRoomGaps(db));
  } catch (error) {
    console.error('server: interview room monitoring failed', error.stack);
  }

  // 日程依頼の期限監視も同じ60秒ループに相乗りさせ、監視タイマーを増やさない。
  // ★ここで early return しないこと。この後ろに監視を足したときに黙って飛ばされる
  try {
    const expired = expireWaitingScheduleRequests(db);
    if (expired.length > 0) {
      const roomIds = [...new Set(expired.map((request) => request.roomId))];
      await Promise.all([
        ...expired.map((request) => emitScheduleRequestUpdated(io, request)),
        ...roomIds.map((roomId) => emitRoomUpdated(io, db, roomId)),
      ]);
    }
  } catch (error) {
    console.error('server: schedule expiry update failed', error.stack);
  }
}, MONITOR_INTERVAL_MS);
monitorTimer.unref();

httpServer.listen(PORT, () => {
  console.log(`server: listening on port ${PORT}`);
});
