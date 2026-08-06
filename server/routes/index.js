import { Router } from 'express';
import authRouter from './auth.js';
import roomsRouter from './rooms.js';
import messagesRouter from './messages.js';
import studentsRouter from './students.js';
import usersRouter from './users.js';
import memosRouter from './memos.js';
import snippetsRouter from './snippets.js';
import summaryRouter from './summary.js';
import companyRouter from './company.js';
import aiSummaryRouter from './aiSummary.js';
import calendarRouter from './calendar.js';
import scheduleRequestsRouter from './scheduleRequests.js';
import mockCalendarRouter from './mockCalendar.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/rooms', roomsRouter);
// messages/memos は /rooms/:id/... と /messages|memos/:id の両方を持つため
// プレフィックスを固定せず、各ルーターファイル側でフルパスを定義する（api.md 参照）。
router.use('/', messagesRouter);
router.use('/', memosRouter);
router.use('/students', studentsRouter);
router.use('/users', usersRouter);
router.use('/snippets', snippetsRouter);
router.use('/summary', summaryRouter);
router.use('/company', companyRouter);
router.use('/ai/summary', aiSummaryRouter);
router.use('/calendar', calendarRouter);
router.use('/mock-calendar', mockCalendarRouter);
router.use('/', scheduleRequestsRouter);

export default router;
