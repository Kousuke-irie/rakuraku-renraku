// A-1残: デモ用シードデータ投入。
//
// 学生は2種類ある。
//  - SHOWCASE_STUDENTS: デモで必ず見せたいシナリオを手書きしたもの（student1〜student10）
//  - buildGeneratedStudents(): 受信箱に「量」を出すための生成分（student11〜）
//
// 用件タグ・緊急度は server/services の本実装をそのまま使う。
// シード専用の複製を置くと business-logic.md のルールが二重管理になるため。
// tag_rules は tagClassifier が参照するので、学生を作る前に投入すること。
import bcrypt from 'bcrypt';
import db from './index.js';
import { classifyTopicTag, clearTagRuleCache } from '../services/tagClassifier.js';
import { calculateUrgency } from '../services/urgencyCalculator.js';
import {
  HANDLING_STATUS,
  INTERVIEW_FORMAT,
  MESSAGE_TYPE,
  ROLE,
  ROOM_TYPE,
  SCHEDULE_STATE,
  SCHEDULE_REQUEST_STATUS,
  SELECTION_STATUS,
  URGENCY,
} from '../../shared/constants.js';

const BCRYPT_COST = 10;
const NOW = Date.now();

/** 人事1人あたりの担当学生数。ここを変えれば全体の規模が変わる */
const STUDENTS_PER_HR = 12;
/** どの人事の受信箱にも出ない「拾い上げ待ち」のルーム数 */
const UNASSIGNED_COUNT = 4;
/** 生成分を毎回同じ内容にするための乱数シード（デモの再現性のため固定する） */
const RANDOM_SEED = 20260806;

function hoursAgoIso(hours) {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function hoursAheadIso(hours) {
  return new Date(NOW + hours * 3_600_000).toISOString();
}

// business-logic.md §1 のキーワード辞書（tag_rules の投入元）。
const TAG_RULES = [
  { tag: 'absence_late', priority: 1, keywords: ['欠席', '休み', '遅れ', '遅刻', '間に合', '行けな', '参加でき', '体調不良'] },
  { tag: 'scheduling', priority: 2, keywords: ['日程', '候補日', '変更', 'リスケ', '空いて', '都合', '日時'] },
  { tag: 'aptitude_test', priority: 3, keywords: ['適性検査', 'SPI', 'テスト', '受検'] },
  { tag: 'result_waiting', priority: 4, keywords: ['合否', '結果', '通過', '選考状況', 'いつ頃'] },
  { tag: 'question', priority: 5, keywords: ['？', '?', 'でしょうか', '教えて', '伺い'] },
];

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

/** 担当を持てる人事のログインID（HR_USERS と揃える） */
const ASSIGNEE_LOGIN_IDS = HR_USERS.map((user) => user.loginId);

// ---------------------------------------------------------------------------
// 手書きシナリオ（デモの筋書き。内容を変えると受入確認の手順が変わるので注意）
// ---------------------------------------------------------------------------

const SHOWCASE_STUDENTS = [
  {
    loginId: 'student1', displayName: '田中 太郎', avatarColor: '#7CBF9C',
    university: '東京大学', faculty: '工学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_2,
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 48, body: '明日14時からの一次面接、忘れずにご参加ください。' },
      { sender: 'student', hoursAgo: 26, body: '申し訳ございません、明日の面接ですが体調不良のため欠席させてください。' },
    ],
  },
  {
    loginId: 'student2', displayName: '佐藤 花子', avatarColor: '#BFB27C',
    university: '早稲田大学', faculty: '商学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_4,
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '候補日は8/10, 8/12, 8/14です。' },
      { sender: 'student', hoursAgo: 13, body: '8/12でお願いしたいのですが、日程を変更できますか。急に都合が悪くなってしまいました。' },
    ],
  },
  {
    loginId: 'student3', displayName: '鈴木 一郎', avatarColor: '#7CA8BF',
    university: '慶應義塾大学', faculty: '経済学部', gradYear: 2028, selectionStatus: SELECTION_STATUS.ENTRY,
    assignee: null, handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 6, body: '面接会場は本社ビル3階になります。' },
      { sender: 'student', hoursAgo: 2, body: '面接会場までの行き方を教えていただけますでしょうか？' },
    ],
  },
  {
    loginId: 'student4', displayName: '高橋 美咲', avatarColor: '#BF7C9C',
    university: '一橋大学', faculty: '社会学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_5,
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '五次面接の結果について確認中です。' },
      { sender: 'student', hoursAgo: 15, body: '選考状況について、合否はいつ頃分かりますでしょうか。' },
    ],
  },
  {
    loginId: 'student5', displayName: '伊藤 健太', avatarColor: '#9CBF7C',
    university: '筑波大学', faculty: '情報学群', gradYear: 2027, selectionStatus: SELECTION_STATUS.OFFER,
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.WAITING_STUDENT,
    fillerCount: 6,
    thread: [
      { sender: 'student', hoursAgo: 76, body: '内定のご連絡ありがとうございます、承諾いたします。' },
      { sender: 'hr', hoursAgo: 74, body: '会議室の予約が完了しました。ご確認よろしくお願いします。' },
    ],
  },
  {
    loginId: 'student6', displayName: '渡辺 さくら', avatarColor: '#BF7C7C',
    university: '明治大学', faculty: '法学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.DECLINED,
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.DONE,
    fillerCount: 4,
    thread: [
      { sender: 'student', hoursAgo: 200, body: '今回は内定を辞退させていただきます。' },
      { sender: 'hr', hoursAgo: 198, body: '承知いたしました。今後のご活躍をお祈りしております。' },
    ],
  },
  {
    loginId: 'student7', displayName: '山本 直樹', avatarColor: '#7CBFBF',
    university: '大阪大学', faculty: '基礎工学部', gradYear: 2028, selectionStatus: SELECTION_STATUS.DOCUMENT,
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 24, body: '適性検査（SPI）の受検リンクをお送りします。' },
      { sender: 'student', hoursAgo: 5, body: '適性検査を受検しました。結果について教えてください。' },
    ],
  },
  {
    loginId: 'student8', displayName: '中村 陽菜', avatarColor: '#BFBF7C',
    university: '同志社大学', faculty: '文学部', gradYear: 2028, selectionStatus: SELECTION_STATUS.APTITUDE,
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.ON_HOLD,
    fillerCount: 4,
    thread: [
      { sender: 'student', hoursAgo: 100, body: '少し検討するお時間をいただけますでしょうか。' },
      { sender: 'hr', hoursAgo: 99, body: '承知しました。ご連絡お待ちしております。' },
    ],
  },
  {
    loginId: 'student9', displayName: '小林 蓮', avatarColor: '#9C7CBF',
    university: '立命館大学', faculty: '経営学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_1,
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 10, body: '何かご不明点があればいつでもご連絡ください。' },
      { sender: 'student', hoursAgo: 1, body: 'ありがとうございます！引き続きよろしくお願いします。' },
    ],
  },
  {
    loginId: 'student10', displayName: '加藤 美月',
    avatarColor: '#BF9C7C',
    university: '関西学院大学', faculty: '総合政策学部', gradYear: 2028, selectionStatus: SELECTION_STATUS.INTERVIEW_3,
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    fillerCount: 4,
    thread: [
      { sender: 'hr', hoursAgo: 3, body: '本日はご参加ありがとうございました。' },
      { sender: 'student', hoursAgo: 0.5, body: '次の選考ステップについて伺いたいのですが、よろしいでしょうか？' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 生成分の素材
// ---------------------------------------------------------------------------

const SURNAMES = [
  '井上', '木下', '斎藤', '藤田', '長谷川', '岡田', '森本', '村上',
  '石川', '前田', '西村', '大久保', '横山', '菅原', '三宅',
];

const GIVEN_NAMES = [
  '結衣', '悠斗', '玲奈', '大翔', '心春', '拓海', '莉子', '陽介',
  '彩花', '颯太', '芽依', '亮太', '真央', '海斗', '千尋',
];

const UNIVERSITIES = [
  { university: '北海道大学', faculties: ['農学部', '工学部'] },
  { university: '東北大学', faculties: ['理学部', '経済学部'] },
  { university: '名古屋大学', faculties: ['情報学部', '法学部'] },
  { university: '神戸大学', faculties: ['経営学部', '国際人間科学部'] },
  { university: '九州大学', faculties: ['工学部', '共創学部'] },
  { university: '上智大学', faculties: ['外国語学部', '総合人間科学部'] },
  { university: '青山学院大学', faculties: ['経済学部', '社会情報学部'] },
  { university: '立教大学', faculties: ['社会学部', '観光学部'] },
  { university: '法政大学', faculties: ['デザイン工学部', 'キャリアデザイン学部'] },
  { university: '中央大学', faculties: ['商学部', '国際経営学部'] },
  { university: '関西大学', faculties: ['社会学部', 'システム理工学部'] },
  { university: '千葉大学', faculties: ['園芸学部', '工学部'] },
  { university: '横浜国立大学', faculties: ['経済学部', '都市科学部'] },
  { university: '広島大学', faculties: ['教育学部', '情報科学部'] },
  { university: '津田塾大学', faculties: ['学芸学部', '総合政策学部'] },
];

const AVATAR_COLORS = [
  '#7CBF9C', '#BFB27C', '#7CA8BF', '#BF7C9C', '#9CBF7C',
  '#BF7C7C', '#7CBFBF', '#BFBF7C', '#9C7CBF', '#BF9C7C',
];

const GRAD_YEARS = [2027, 2028];

const INTERVIEWERS = ['大西 陽子', '松本 圭', '木村 誠', '藤原 慎一', '相馬 くるみ'];

const MEETING_ROOMS = [
  '本社 3F 会議室A',
  '本社 3F 会議室B',
  '本社 5F 大会議室',
  'オンライン（Zoom）',
];

/**
 * 生成分のシナリオ。
 * thread の `ago` は「そのスレッドの最新メッセージから何時間前か」を表す（最新は 0）。
 * 実際の hoursAgo は latestHoursAgo からランダムに選んだ値に足して決める。
 * 用件タグは最後の学生メッセージから tagClassifier が判定するので、
 * 本文には意図した用件タグのキーワードだけが入るようにしてある。
 */
const SCENARIOS = [
  {
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_1, SELECTION_STATUS.INTERVIEW_2],
    scheduleState: SCHEDULE_STATE.CONFIRMED,
    hasNextInterview: true,
    latestHoursAgo: [0.5, 5],
    thread: [
      { sender: 'hr', ago: 22, body: '本日13時からの面接、お待ちしております。' },
      { sender: 'student', ago: 0, body: '電車が止まってしまい、30分ほど遅れそうです。申し訳ありません。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_3],
    scheduleState: SCHEDULE_STATE.PROPOSED,
    hasNextInterview: false,
    latestHoursAgo: [14, 40],
    thread: [
      { sender: 'hr', ago: 30, body: '次回面接の候補日をお送りします。ご都合のよい日をお知らせください。' },
      { sender: 'student', ago: 0, body: 'いただいた候補日ですが、いずれも講義と重なっており、別の日程をご相談できますでしょうか。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_3, SELECTION_STATUS.INTERVIEW_4],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [13, 36],
    thread: [
      { sender: 'hr', ago: 26, body: '先日はご参加いただきありがとうございました。' },
      { sender: 'student', ago: 0, body: '先日の面接の結果について、いつ頃ご連絡いただけますでしょうか。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    selectionStatuses: [SELECTION_STATUS.APTITUDE, SELECTION_STATUS.DOCUMENT],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [2, 20],
    thread: [
      { sender: 'hr', ago: 40, body: '適性検査の受検URLをお送りしました。期限は今週末です。' },
      { sender: 'student', ago: 0, body: '適性検査の受検期限を過ぎてしまいました。再度URLをいただけますでしょうか。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    selectionStatuses: [SELECTION_STATUS.ENTRY, SELECTION_STATUS.DOCUMENT],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [1, 9],
    thread: [
      { sender: 'hr', ago: 18, body: '選考のご案内をお送りしました。ご確認ください。' },
      { sender: 'student', ago: 0, body: '当日の服装について伺いたいのですが、私服で問題ないでしょうか。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.WAITING_STUDENT,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_1, SELECTION_STATUS.INTERVIEW_2],
    scheduleState: SCHEDULE_STATE.PROPOSED,
    hasNextInterview: false,
    latestHoursAgo: [4, 30],
    thread: [
      { sender: 'student', ago: 6, body: 'ありがとうございます。承知しました。' },
      { sender: 'hr', ago: 0, body: '次回面接の候補日を3つお送りしました。ご返信お待ちしております。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_3],
    scheduleState: SCHEDULE_STATE.INTERVIEWER_CHECK,
    hasNextInterview: false,
    latestHoursAgo: [3, 16],
    thread: [
      { sender: 'hr', ago: 20, body: '次回面接のご希望をお聞かせください。' },
      { sender: 'student', ago: 0, body: '来週でしたら火曜と木曜の午後が空いております。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.DONE,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_4, SELECTION_STATUS.OFFER],
    scheduleState: SCHEDULE_STATE.CONFIRMED,
    hasNextInterview: true,
    latestHoursAgo: [30, 120],
    thread: [
      { sender: 'student', ago: 4, body: '選考通過のご連絡ありがとうございます。' },
      { sender: 'hr', ago: 0, body: '引き続きよろしくお願いいたします。次回のご案内は追ってお送りします。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.ON_HOLD,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_3, SELECTION_STATUS.INTERVIEW_4],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [60, 190],
    thread: [
      { sender: 'hr', ago: 8, body: '次のステップについてご相談させてください。' },
      { sender: 'student', ago: 0, body: '一度持ち帰って検討したく、少しだけお時間をいただけないでしょうか。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_1, SELECTION_STATUS.INTERVIEW_2],
    scheduleState: SCHEDULE_STATE.ROOM_PENDING,
    hasNextInterview: true,
    latestHoursAgo: [1, 10],
    thread: [
      { sender: 'hr', ago: 24, body: '面接の詳細をお送りします。' },
      { sender: 'student', ago: 0, body: '体調不良のため、明日の面接を欠席させてください。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    selectionStatuses: [SELECTION_STATUS.ENTRY, SELECTION_STATUS.DOCUMENT],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [26, 72],
    thread: [
      { sender: 'hr', ago: 12, body: '本日は会社説明会にご参加いただきありがとうございました。' },
      { sender: 'student', ago: 0, body: '本日はありがとうございました。引き続きよろしくお願いいたします。' },
    ],
  },
  {
    handlingStatus: HANDLING_STATUS.WAITING_STUDENT,
    selectionStatuses: [SELECTION_STATUS.APTITUDE],
    scheduleState: SCHEDULE_STATE.NONE,
    hasNextInterview: false,
    latestHoursAgo: [8, 44],
    thread: [
      { sender: 'student', ago: 3, body: '適性検査を受検しました。' },
      { sender: 'hr', ago: 0, body: '受検ありがとうございます。結果が出次第ご連絡いたします。' },
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

/** 会社情報（P2-10）。学生のトーク画面の会社情報パネルに出る初期値 */
const COMPANY_INFO = {
  name: '株式会社ラクラク',
  description:
    '「はたらく人の毎日を、少しだけ軽くする」をミッションに、業務コミュニケーションの プロダクトをつくっています。\n新卒採用では、入社1年目から企画・開発の意思決定に関わる機会を大切にしています。',
  recruitSiteUrl: 'https://example.com/recruit',
};

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

/** mulberry32。シードが同じなら毎回同じ列を返すので、シードの中身が実行ごとに変わらない */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function randomFloat(random, min, max) {
  return min + random() * (max - min);
}

/**
 * 目標人数に足りないぶんの担当割り当てを作る。
 * 手書き分ですでに埋まっている人数を差し引き、残りを順番に配る（null = 未割当）。
 */
function buildAssigneePlan() {
  const countOf = (loginId) =>
    SHOWCASE_STUDENTS.filter((student) => student.assignee === loginId).length;

  const deficits = [
    ...ASSIGNEE_LOGIN_IDS.map((loginId) => ({
      loginId,
      remaining: Math.max(0, STUDENTS_PER_HR - countOf(loginId)),
    })),
    { loginId: null, remaining: Math.max(0, UNASSIGNED_COUNT - countOf(null)) },
  ];

  const plan = [];
  while (deficits.some((deficit) => deficit.remaining > 0)) {
    for (const deficit of deficits) {
      if (deficit.remaining === 0) continue;
      plan.push(deficit.loginId);
      deficit.remaining -= 1;
    }
  }
  return plan;
}

/** 姓と名を別々の周期で組み合わせ、生成分どうしで氏名が重複しないようにする */
function buildDisplayName(index) {
  const surname = SURNAMES[index % SURNAMES.length];
  const givenName = GIVEN_NAMES[Math.floor(index / SURNAMES.length) % GIVEN_NAMES.length];
  return `${surname} ${givenName}`;
}

/** SHOWCASE_STUDENTS と同じ形の学生オブジェクトを作る（挿入処理を分岐させないため） */
function buildGeneratedStudents() {
  const random = createRandom(RANDOM_SEED);
  const plan = buildAssigneePlan();
  const offset = SHOWCASE_STUDENTS.length;

  return plan.map((assignee, index) => {
    const scenario = SCENARIOS[index % SCENARIOS.length];
    const school = pick(random, UNIVERSITIES);
    const latestHoursAgo = randomFloat(random, ...scenario.latestHoursAgo);

    return {
      loginId: `student${offset + index + 1}`,
      displayName: buildDisplayName(index),
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      university: school.university,
      faculty: pick(random, school.faculties),
      gradYear: pick(random, GRAD_YEARS),
      selectionStatus: pick(random, scenario.selectionStatuses),
      assignee,
      handlingStatus: scenario.handlingStatus,
      scheduleState: scenario.scheduleState,
      nextInterviewAt: scenario.hasNextInterview ? hoursAheadIso(randomInt(random, 12, 168)) : null,
      nextInterviewRoom: scenario.hasNextInterview ? pick(random, MEETING_ROOMS) : null,
      interviewer: scenario.hasNextInterview ? pick(random, INTERVIEWERS) : null,
      fillerCount: randomInt(random, 2, 4) * 2,
      thread: scenario.thread.map((message) => ({
        sender: message.sender,
        hoursAgo: latestHoursAgo + message.ago,
        body: message.body,
      })),
    };
  });
}

const STUDENTS = [...SHOWCASE_STUDENTS, ...buildGeneratedStudents()];

// ---------------------------------------------------------------------------
// 投入
// ---------------------------------------------------------------------------

function clearExistingData() {
  // rooms.last_message_id が messages を参照する循環FKがあるため、先にNULL化してから削除する。
  db.prepare(`UPDATE rooms SET last_message_id = NULL, ai_analyzed_message_id = NULL`).run();
  const tables = [
    'read_receipts', 'memos', 'room_members', 'calendar_bookings', 'calendar_events',
    'messages', 'schedule_requests', 'rooms', 'students', 'calendar_interviewers',
    'users', 'tag_rules', 'snippets', 'company_info',
  ];
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function insertCompanyInfo() {
  db.prepare(
    `INSERT INTO company_info (id, name, description, recruit_site_url, updated_at)
     VALUES (1, ?, ?, ?, ?)`,
  ).run(COMPANY_INFO.name, COMPANY_INFO.description, COMPANY_INFO.recruitSiteUrl, new Date().toISOString());
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

function insertTagRules() {
  for (const rule of TAG_RULES) {
    for (const keyword of rule.keywords) {
      db.prepare(`INSERT INTO tag_rules (tag, keyword, priority) VALUES (?, ?, ?)`).run(rule.tag, keyword, rule.priority);
    }
  }
  // 入れ直した辞書を tagClassifier に読み直させる（プロセス内キャッシュを持つため）
  clearTagRuleCache();
}

function insertSnippets() {
  for (const snippet of SNIPPETS) {
    db.prepare(`INSERT INTO snippets (command, title, body, sort_order) VALUES (?, ?, ?, ?)`).run(
      snippet.command,
      snippet.title,
      snippet.body,
      snippet.sortOrder,
    );
  }
}

function insertStudentRoom(student, { hrUserIds, allHrIds, passwordHash }) {
  const studentUserId = insertUser(
    { loginId: student.loginId, displayName: student.displayName, role: ROLE.STUDENT, avatarColor: student.avatarColor },
    passwordHash,
  );

  db.prepare(
    `INSERT INTO students (
       user_id, university, faculty, grad_year, selection_status,
       next_interview_at, next_interview_room, interviewer, schedule_state, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    studentUserId,
    student.university,
    student.faculty,
    student.gradYear,
    student.selectionStatus,
    student.nextInterviewAt ?? null,
    student.nextInterviewRoom ?? null,
    student.interviewer ?? null,
    student.scheduleState ?? SCHEDULE_STATE.NONE,
    new Date().toISOString(),
  );

  const assigneeUserId = student.assignee ? hrUserIds[student.assignee] : null;
  const roomCreatedAt = hoursAgoIso(Math.max(...student.thread.map((m) => m.hoursAgo)) + student.fillerCount * 3 + 3);

  const { lastInsertRowid: roomId } = db
    .prepare(
      `INSERT INTO rooms (type, student_user_id, handling_status, assignee_user_id, urgency, created_at)
       VALUES (?, ?, ?, ?, 'normal', ?)`,
    )
    .run(ROOM_TYPE.DM, studentUserId, student.handlingStatus, assigneeUserId, roomCreatedAt);

  // 受信箱は人事全員が共有する。担当者(assignee)は表示専用の別概念とし、閲覧・参加権限は全hr/adminに付与する。
  const memberIds = [studentUserId, ...allHrIds];
  for (const memberId of memberIds) {
    db.prepare(
      `INSERT INTO room_members (room_id, user_id, last_read_message_id, joined_at) VALUES (?, ?, 0, ?)`,
    ).run(roomId, memberId, roomCreatedAt);
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
    const topicTag = msg.sender === 'student' ? classifyTopicTag(db, msg.body) : null;

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

  return { roomId: Number(roomId), studentUserId: Number(studentUserId), assigneeUserId };
}

function localDateTimeIso(daysFromNow, hours, minutes = 0) {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysFromNow,
    hours,
    minutes,
    0,
    0,
  ).toISOString();
}

function seedInterviewScheduling({ hrUserIds, studentRefs }) {
  const now = new Date().toISOString();
  const interviewers = [
    { externalId: 'mock-sato', displayName: '佐藤 健', department: '開発部' },
    { externalId: 'mock-suzuki', displayName: '鈴木 彩', department: '事業企画部' },
    { externalId: 'mock-takahashi', displayName: '高橋 翔', department: '人事部' },
  ];
  const interviewerIds = {};
  for (const interviewer of interviewers) {
    const result = db.prepare(
      `INSERT INTO calendar_interviewers (
         external_id, display_name, department, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, 1, ?, ?)`,
    ).run(interviewer.externalId, interviewer.displayName, interviewer.department, now, now);
    interviewerIds[interviewer.externalId] = Number(result.lastInsertRowid);
  }

  // 既存予定を混ぜ、初回表示から ○ と × の両方が見えるようにする。
  for (const interviewerId of Object.values(interviewerIds)) {
    for (const event of [
      { day: 3, start: 11, end: 12 },
      { day: 4, start: 14, end: 15 },
      { day: 6, start: 10, end: 11 },
    ]) {
      db.prepare(
        `INSERT INTO calendar_events (interviewer_id, starts_at, ends_at, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(
        interviewerId,
        localDateTimeIso(event.day, event.start),
        localDateTimeIso(event.day, event.end),
        now,
      );
    }
  }

  const createDemoRequest = ({
    studentLoginId,
    interviewerExternalId,
    status,
    deadline,
    bookedStart = null,
  }) => {
    const student = studentRefs[studentLoginId];
    const interviewerId = interviewerIds[interviewerExternalId];
    const interviewerName = interviewers.find((item) => item.externalId === interviewerExternalId)?.displayName;
    const bookedEnd = bookedStart ? new Date(new Date(bookedStart).getTime() + 60 * 60_000).toISOString() : null;
    const bookedSlotId = bookedStart
      ? `interviewer-${interviewerId}-${bookedStart.replace(/[-:]/g, '').slice(0, 13)}Z`
      : null;
    const result = db.prepare(
      `INSERT INTO schedule_requests (
         room_id, student_user_id, interviewer_id, created_by_user_id,
         selection_stage, duration_minutes, available_from, available_until,
         daily_start_time, daily_end_time, response_deadline,
         interview_format, location_text, status,
         booked_slot_id, booked_starts_at, booked_ends_at, booked_at,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      student.roomId,
      student.studentUserId,
      interviewerId,
      hrUserIds.hr1,
      '一次面接',
      60,
      localDateTimeIso(2, 10),
      localDateTimeIso(8, 18),
      '10:00',
      '18:00',
      deadline,
      INTERVIEW_FORMAT.ONLINE,
      'URLは確定後に案内します',
      status,
      bookedSlotId,
      bookedStart,
      bookedEnd,
      bookedStart ? hoursAgoIso(1) : null,
      hoursAgoIso(2),
      now,
    );
    const requestId = Number(result.lastInsertRowid);
    const messageResult = db.prepare(
      `INSERT INTO messages (
         room_id, sender_id, body, type, schedule_request_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      student.roomId,
      hrUserIds.hr1,
      '一次面接の日程を選択してください',
      MESSAGE_TYPE.TEXT,
      requestId,
      hoursAgoIso(2),
    );

    if (status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT) {
      db.prepare(`UPDATE students SET schedule_state = ?, updated_at = ? WHERE user_id = ?`).run(
        SCHEDULE_STATE.PROPOSED,
        now,
        student.studentUserId,
      );
    }
    if (status === SCHEDULE_REQUEST_STATUS.BOOKED) {
      db.prepare(
        `INSERT INTO calendar_bookings (
           schedule_request_id, interviewer_id, external_slot_id,
           starts_at, ends_at, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(requestId, interviewerId, bookedSlotId, bookedStart, bookedEnd, status, now);
      db.prepare(
        `UPDATE students SET next_interview_at = ?, interviewer = ?, schedule_state = ?, updated_at = ?
         WHERE user_id = ?`,
      ).run(bookedStart, interviewerName, SCHEDULE_STATE.CONFIRMED, now, student.studentUserId);
    }

    // 待機中カードはチャット最下部へ置き、デモで見つけやすくする。
    if (status === SCHEDULE_REQUEST_STATUS.WAITING_STUDENT) {
      db.prepare(
        `UPDATE rooms SET last_message_id = ?, last_message_at = ?, handling_status = ?, urgency = ? WHERE id = ?`,
      ).run(
        Number(messageResult.lastInsertRowid),
        hoursAgoIso(2),
        HANDLING_STATUS.WAITING_STUDENT,
        URGENCY.LOW,
        student.roomId,
      );
    }
  };

  const futureDeadline = localDateTimeIso(1, 18);
  createDemoRequest({
    studentLoginId: 'student2',
    interviewerExternalId: 'mock-sato',
    status: SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
    deadline: futureDeadline,
  });
  // 同じ面接官を対象にして、student2 の予約で共通枠が ○→× になるデモ用。
  createDemoRequest({
    studentLoginId: 'student9',
    interviewerExternalId: 'mock-sato',
    status: SCHEDULE_REQUEST_STATUS.WAITING_STUDENT,
    deadline: futureDeadline,
  });
  createDemoRequest({
    studentLoginId: 'student5',
    interviewerExternalId: 'mock-suzuki',
    status: SCHEDULE_REQUEST_STATUS.BOOKED,
    deadline: futureDeadline,
    bookedStart: localDateTimeIso(3, 10),
  });
  createDemoRequest({
    studentLoginId: 'student4',
    interviewerExternalId: 'mock-takahashi',
    status: SCHEDULE_REQUEST_STATUS.EXPIRED,
    deadline: hoursAgoIso(24),
  });
}

function seed() {
  const passwordHash = bcrypt.hashSync('password123', BCRYPT_COST);

  const run = db.transaction(() => {
    clearExistingData();
    // 用件タグ判定が tag_rules を読むので、学生より先に投入する
    insertTagRules();
    insertSnippets();
    insertCompanyInfo();

    const hrUserIds = {};
    for (const hrUser of HR_USERS) {
      hrUserIds[hrUser.loginId] = insertUser(hrUser, passwordHash);
    }
    const allHrIds = Object.values(hrUserIds);

    const studentRefs = {};
    for (const student of STUDENTS) {
      studentRefs[student.loginId] = insertStudentRoom(student, { hrUserIds, allHrIds, passwordHash });
    }
    seedInterviewScheduling({ hrUserIds, studentRefs });
  });

  run();

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    rooms: db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c,
    messages: db.prepare('SELECT COUNT(*) AS c FROM messages').get().c,
    tagRules: db.prepare('SELECT COUNT(*) AS c FROM tag_rules').get().c,
    snippets: db.prepare('SELECT COUNT(*) AS c FROM snippets').get().c,
    scheduleRequests: db.prepare('SELECT COUNT(*) AS c FROM schedule_requests').get().c,
  };
  const perAssignee = db
    .prepare(
      `SELECT COALESCE(u.login_id, '(未割当)') AS assignee, COUNT(*) AS rooms
       FROM rooms r
       LEFT JOIN users u ON u.id = r.assignee_user_id
       GROUP BY r.assignee_user_id
       ORDER BY rooms DESC`,
    )
    .all();

  console.log('seed: done', counts);
  console.table(perAssignee);
}

seed();
