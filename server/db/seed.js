// A-1残: デモ用シードデータ投入。
// 用件タグ判定(P1-5)・緊急度算出(P1-6)のサービスはまだ実装されていないため、
// business-logic.md のルールをこのファイル専用のミニ実装として複製する。
// 本実装（server/services/tagClassifier.js, urgencyCalculator.js）ができたら、
// このファイル内の classifyTag / calculateUrgency は削除してそちらに置き換えること。
import bcrypt from 'bcrypt';
import db from './index.js';
import { HANDLING_STATUS, ROLE, ROOM_TYPE, MESSAGE_TYPE } from '../../shared/constants.js';

const BCRYPT_COST = 10;
const NOW = Date.now();

function hoursAgoIso(hours) {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

// business-logic.md §1 のキーワード辞書（tag_rules投入データと完全一致させる）。
const TAG_RULES = [
  { tag: 'absence_late', priority: 1, keywords: ['欠席', '休み', '遅れ', '遅刻', '間に合', '行けな', '参加でき', '体調不良'] },
  { tag: 'scheduling', priority: 2, keywords: ['日程', '候補日', '変更', 'リスケ', '空いて', '都合', '日時'] },
  { tag: 'aptitude_test', priority: 3, keywords: ['適性検査', 'SPI', 'テスト', '受検'] },
  { tag: 'result_waiting', priority: 4, keywords: ['合否', '結果', '通過', '選考状況', 'いつ頃'] },
  { tag: 'question', priority: 5, keywords: ['？', '?', 'でしょうか', '教えて', '伺い'] },
];

// business-logic.md §1: priority昇順でkeywordを部分一致確認し、最初のマッチで確定。どれも一致しなければ'other'。
function classifyTag(body) {
  for (const rule of TAG_RULES) {
    if (rule.keywords.some((keyword) => body.includes(keyword))) {
      return rule.tag;
    }
  }
  return 'other';
}

// business-logic.md §2: 上から順に評価し、最初に該当したものを採用。
function calculateUrgency({ topicTag, elapsedHours, handlingStatus }) {
  if (handlingStatus === HANDLING_STATUS.DONE || handlingStatus === HANDLING_STATUS.ON_HOLD) return 'low';
  if (topicTag === 'absence_late') return 'high';
  if (elapsedHours >= 24 && [HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS].includes(handlingStatus)) return 'high';
  if (['scheduling', 'result_waiting'].includes(topicTag) && elapsedHours >= 12) return 'high';
  if (handlingStatus === HANDLING_STATUS.WAITING_STUDENT) return 'low';
  return 'normal';
}

const FILLER_LINES = {
  hr: [
    '選考プロセスについてご案内いたします。',
    'ご応募いただきありがとうございます。',
    'こちらで確認して折り返しご連絡いたします。',
    '引き続きよろしくお願いいたします。',
    '何かご不明点があればいつでもご連絡ください。',
  ],
  student: [
    '承知しました、よろしくお願いいたします。',
    'ありがとうございます。',
    '確認いたしました。',
    '引き続きよろしくお願いします。',
    '承知いたしました。',
  ],
};

function buildFillerMessages(count, earliestHoursAgo) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    const hoursAgo = earliestHoursAgo + (count - i) * 3;
    const sender = i % 2 === 0 ? 'hr' : 'student';
    const lines = FILLER_LINES[sender];
    messages.push({ sender, hoursAgo, body: lines[i % lines.length] });
  }
  return messages;
}

const HR_USERS = [
  { loginId: 'hr1', displayName: '大西 陽子', role: ROLE.HR, avatarColor: '#7C9CBF' },
  { loginId: 'hr2', displayName: '松本 圭', role: ROLE.HR, avatarColor: '#B37CBF' },
  { loginId: 'admin1', displayName: '木村 誠', role: ROLE.ADMIN, avatarColor: '#BF9C7C' },
];

const STUDENTS = [
  {
    loginId: 'student1', displayName: '田中 太郎', avatarColor: '#7CBF9C',
    university: '東京大学', faculty: '工学部', gradYear: 2027, selectionStatus: 'interview_2',
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY, isPinned: false,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 48, body: '明日14時からの一次面接、忘れずにご参加ください。' },
      { sender: 'student', hoursAgo: 26, body: '申し訳ございません、明日の面接ですが体調不良のため欠席させてください。' },
    ],
  },
  {
    loginId: 'student2', displayName: '佐藤 花子', avatarColor: '#BFB27C',
    university: '早稲田大学', faculty: '商学部', gradYear: 2027, selectionStatus: 'interview_4',
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.NEEDS_REPLY, isPinned: false,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '候補日は8/10, 8/12, 8/14です。' },
      { sender: 'student', hoursAgo: 13, body: '8/12でお願いしたいのですが、日程を変更できますか。急に都合が悪くなってしまいました。' },
    ],
  },
  {
    loginId: 'student3', displayName: '鈴木 一郎', avatarColor: '#7CA8BF',
    university: '慶應義塾大学', faculty: '経済学部', gradYear: 2028, selectionStatus: 'entry',
    assignee: null, handlingStatus: HANDLING_STATUS.NEEDS_REPLY, isPinned: false,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 6, body: '面接会場は本社ビル3階になります。' },
      { sender: 'student', hoursAgo: 2, body: '面接会場までの行き方を教えていただけますでしょうか？' },
    ],
  },
  {
    loginId: 'student4', displayName: '高橋 美咲', avatarColor: '#BF7C9C',
    university: '一橋大学', faculty: '社会学部', gradYear: 2027, selectionStatus: 'interview_5',
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY, isPinned: false,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '五次面接の結果について確認中です。' },
      { sender: 'student', hoursAgo: 15, body: '選考状況について、合否はいつ頃分かりますでしょうか。' },
    ],
  },
  {
    loginId: 'student5', displayName: '伊藤 健太', avatarColor: '#9CBF7C',
    university: '筑波大学', faculty: '情報学群', gradYear: 2027, selectionStatus: 'offer',
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.WAITING_STUDENT, isPinned: false,
    fillerCount: 6,
    thread: [
      { sender: 'student', hoursAgo: 76, body: '内定のご連絡ありがとうございます、承諾いたします。' },
      { sender: 'hr', hoursAgo: 74, body: '会議室の予約が完了しました。ご確認よろしくお願いします。' },
    ],
  },
  {
    loginId: 'student6', displayName: '渡辺 さくら', avatarColor: '#BF7C7C',
    university: '明治大学', faculty: '法学部', gradYear: 2027, selectionStatus: 'declined',
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.DONE, isPinned: false,
    fillerCount: 4,
    thread: [
      { sender: 'student', hoursAgo: 200, body: '今回は内定を辞退させていただきます。' },
      { sender: 'hr', hoursAgo: 198, body: '承知いたしました。今後のご活躍をお祈りしております。' },
    ],
  },
  {
    loginId: 'student7', displayName: '山本 直樹', avatarColor: '#7CBFBF',
    university: '大阪大学', faculty: '基礎工学部', gradYear: 2028, selectionStatus: 'document',
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.IN_PROGRESS, isPinned: false,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 24, body: '適性検査（SPI）の受検リンクをお送りします。' },
      { sender: 'student', hoursAgo: 5, body: '適性検査を受検しました。結果について教えてください。' },
    ],
  },
  {
    loginId: 'student8', displayName: '中村 陽菜', avatarColor: '#BFBF7C',
    university: '同志社大学', faculty: '文学部', gradYear: 2028, selectionStatus: 'aptitude',
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.ON_HOLD, isPinned: false,
    fillerCount: 4,
    thread: [
      { sender: 'student', hoursAgo: 100, body: '少し検討するお時間をいただけますでしょうか。' },
      { sender: 'hr', hoursAgo: 99, body: '承知しました。ご連絡お待ちしております。' },
    ],
  },
  {
    loginId: 'student9', displayName: '小林 蓮', avatarColor: '#9C7CBF',
    university: '立命館大学', faculty: '経営学部', gradYear: 2027, selectionStatus: 'interview_1',
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.NEEDS_REPLY, isPinned: true,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 10, body: '何かご不明点があればいつでもご連絡ください。' },
      { sender: 'student', hoursAgo: 1, body: 'ありがとうございます！引き続きよろしくお願いします。' },
    ],
  },
  {
    loginId: 'student10', displayName: '加藤 美月',
    avatarColor: '#BF9C7C',
    university: '関西学院大学', faculty: '総合政策学部', gradYear: 2028, selectionStatus: 'interview_3',
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.IN_PROGRESS, isPinned: false,
    fillerCount: 4,
    thread: [
      { sender: 'hr', hoursAgo: 3, body: '本日はご参加ありがとうございました。' },
      { sender: 'student', hoursAgo: 0.5, body: '次の選考ステップについて伺いたいのですが、よろしいでしょうか？' },
    ],
  },
];

const SNIPPETS = [
  {
    command: '/合格', title: '選考通過連絡', sortOrder: 1,
    body: '{学生名}様\n\n選考の結果、{選考段階}を通過されましたのでご連絡いたします。\n引き続きよろしくお願いいたします。\n\n{担当者名}',
  },
  {
    command: '/不合格', title: '選考結果連絡（見送り）', sortOrder: 2,
    body: '{学生名}様\n\n慎重に選考させていただきました結果、今回は誠に残念ながらご期待に添えない結果となりました。\nこれまでのご協力に感謝申し上げます。\n\n{担当者名}',
  },
  {
    command: '/督促', title: '返信の督促', sortOrder: 3,
    body: '{学生名}様\n\nその後いかがでしょうか。ご確認いただけましたらご返信をお願いいたします。\n\n{担当者名}',
  },
  {
    command: '/日程案内', title: '面接日程の案内', sortOrder: 4,
    body: '{学生名}様\n\n面接日程のご案内です。\n日時：{面接日時}\n会場：{会議室}\n\nご不明点があればお知らせください。\n\n{担当者名}',
  },
  {
    command: '/面接前日リマインド', title: '面接前日リマインド', sortOrder: 5,
    body: '{学生名}様\n\n明日はいよいよ面接です。\n日時：{面接日時}\n会場：{会議室}\n面接官：{面接官}\n\n体調にお気をつけてお越しください。\n\n{担当者名}',
  },
];

function clearExistingData() {
  // rooms.last_message_id が messages を参照する循環FKがあるため、先にNULL化してから削除する。
  db.prepare(`UPDATE rooms SET last_message_id = NULL`).run();
  const tables = ['read_receipts', 'memos', 'room_members', 'messages', 'rooms', 'students', 'users', 'tag_rules', 'snippets'];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function insertUser({ loginId, displayName, role, avatarColor }, passwordHash) {
  const now = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (login_id, password_hash, display_name, avatar_color, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(loginId, passwordHash, displayName, avatarColor, role, now, now);
  return lastInsertRowid;
}

function seed() {
  const passwordHash = bcrypt.hashSync('password123', BCRYPT_COST);

  const run = db.transaction(() => {
    clearExistingData();

    const hrUserIds = {};
    for (const hrUser of HR_USERS) {
      hrUserIds[hrUser.loginId] = insertUser(hrUser, passwordHash);
    }
    const allHrIds = Object.values(hrUserIds);

    for (const student of STUDENTS) {
      const studentUserId = insertUser(
        { loginId: student.loginId, displayName: student.displayName, role: ROLE.STUDENT, avatarColor: student.avatarColor },
        passwordHash,
      );

      db.prepare(
        `INSERT INTO students (user_id, university, faculty, grad_year, selection_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(studentUserId, student.university, student.faculty, student.gradYear, student.selectionStatus, new Date().toISOString());

      const assigneeUserId = student.assignee ? hrUserIds[student.assignee] : null;
      const roomCreatedAt = hoursAgoIso(Math.max(...student.thread.map((m) => m.hoursAgo)) + student.fillerCount * 3 + 3);

      const { lastInsertRowid: roomId } = db
        .prepare(
          `INSERT INTO rooms (type, student_user_id, handling_status, assignee_user_id, urgency, is_pinned, created_at)
           VALUES (?, ?, ?, ?, 'normal', ?, ?)`,
        )
        .run(ROOM_TYPE.DM, studentUserId, student.handlingStatus, assigneeUserId, student.isPinned ? 1 : 0, roomCreatedAt);

      // 受信箱は人事全員が共有する。担当者(assignee)は表示専用の別概念とし、閲覧・参加権限は全hr/adminに付与する。
      const memberIds = [studentUserId, ...allHrIds];
      const joinedAt = roomCreatedAt;
      for (const memberId of memberIds) {
        db.prepare(
          `INSERT INTO room_members (room_id, user_id, last_read_message_id, joined_at) VALUES (?, ?, 0, ?)`,
        ).run(roomId, memberId, joinedAt);
      }

      const earliestThreadHoursAgo = Math.max(...student.thread.map((m) => m.hoursAgo));
      const filler = buildFillerMessages(student.fillerCount, earliestThreadHoursAgo);
      const allMessages = [...filler, ...student.thread].sort((a, b) => b.hoursAgo - a.hoursAgo);

      let lastMessageId = null;
      let lastMessageAt = null;
      let lastStudentMessageAt = null;
      let lastStudentTopicTag = null;

      for (const msg of allMessages) {
        const senderId = msg.sender === 'student' ? studentUserId : assigneeUserId || allHrIds[0];
        const createdAt = hoursAgoIso(msg.hoursAgo);
        const topicTag = msg.sender === 'student' ? classifyTag(msg.body) : null;

        const { lastInsertRowid: messageId } = db
          .prepare(
            `INSERT INTO messages (room_id, sender_id, body, type, topic_tag, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(roomId, senderId, msg.body, MESSAGE_TYPE.TEXT, topicTag, createdAt);

        lastMessageId = messageId;
        lastMessageAt = createdAt;
        if (msg.sender === 'student') {
          lastStudentMessageAt = createdAt;
          lastStudentTopicTag = topicTag;
        }
      }

      const elapsedHours = (NOW - new Date(lastStudentMessageAt).getTime()) / 3_600_000;
      const urgency = calculateUrgency({
        topicTag: lastStudentTopicTag,
        elapsedHours,
        handlingStatus: student.handlingStatus,
      });

      db.prepare(
        `UPDATE rooms SET last_message_id = ?, last_message_at = ?, last_student_message_at = ?, urgency = ? WHERE id = ?`,
      ).run(lastMessageId, lastMessageAt, lastStudentMessageAt, urgency, roomId);
    }

    for (const rule of TAG_RULES) {
      for (const keyword of rule.keywords) {
        db.prepare(`INSERT INTO tag_rules (tag, keyword, priority) VALUES (?, ?, ?)`).run(rule.tag, keyword, rule.priority);
      }
    }

    for (const snippet of SNIPPETS) {
      db.prepare(`INSERT INTO snippets (command, title, body, sort_order) VALUES (?, ?, ?, ?)`).run(
        snippet.command,
        snippet.title,
        snippet.body,
        snippet.sortOrder,
      );
    }
  });

  run();

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    rooms: db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c,
    messages: db.prepare('SELECT COUNT(*) AS c FROM messages').get().c,
    tagRules: db.prepare('SELECT COUNT(*) AS c FROM tag_rules').get().c,
    snippets: db.prepare('SELECT COUNT(*) AS c FROM snippets').get().c,
  };
  console.log('seed: done', counts);
}

seed();
