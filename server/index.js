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

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`server: listening on port ${PORT}`);
});
