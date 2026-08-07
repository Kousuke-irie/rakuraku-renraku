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
import { clearComplianceRuleCache } from '../services/complianceChecker.js';
import { calculateUrgency } from '../services/urgencyCalculator.js';
import { notifySelectionAdvanced, notifyVisibleFeedbacks } from '../services/studentNotifier.js';
// 過去の監視イベント（P4-4 のダッシュボード用）を、本番と同じ文面・同じ宛先の決め方で作る
import { buildDetail as buildSlaDetail, findManagerIds } from '../services/slaMonitor.js';
import { ACK_NOTE } from '../services/complianceAlerts.js';
import {
  ALERT_KIND,
  ALERT_SEVERITY,
  COMPLIANCE_CATEGORY,
  COMPLIANCE_SOURCE,
  DASHBOARD_TREND_DAYS,
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

// monitoring.md §4 のコンプライアンス辞書（compliance_rules の投入元）。
//
// 出典は厚生労働省「公正な採用選考の基本」で**尋ねてはならない**とされる事項。
// 根拠が公的基準にあることがこの機能の説得力の源なので、独自解釈で増やさないこと。
//
// ★keywords / exclude は**正規表現**（P4-2b）。照合は正規化済み本文に対して行う
//   （NFKC・小文字化・空白除去）ので、パターン側に空白を書かないこと。
//   「本 籍」のような空白挿入による回避は正規化側で潰れる。
//
// exclude は誤検知対策。「本籍地はお伺いしません」のような**正しい**文が
// block になるとこの機能は信用を失う（monitoring.md §4）。
//
// 「尋ねている文」だけを拾うため、多くのルールで述語（何ですか・教えて 等）を
// パターンに含めている。単語の存在だけで判定すると
// 「弊社は労働組合と協議して…」のような説明文まで block になる。
const ASK = '(です|でしょう|ます|ますでしょう)?(か|かね)|教え|お聞かせ|聞かせ|伺(い|え)|お答え|記入|ご記載|書いて|何|どちら|どこ|いくつ|いくら|どんな|どのよう';
const FAMILY = '(ご|お)?(両親|父|母|父親|母親|お父様|お母様|ご尊父|ご母堂|家族|ご家族|保護者|兄弟|姉妹)';

const COMPLIANCE_RULES = [
  // --- 就職差別のおそれ（すべて block） ---
  {
    code: 'honseki', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 1,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '本籍',
      '(ご|お)?出身(地|は|を|について|地は)',
      '生まれ(はどこ|た場所|はどちら|はどの)',
      '(どこ|どちら)の(生まれ|ご出身)',
      '国籍',
    ],
    exclude: [
      'お伺いしません', '伺いません', '質問しません', 'お尋ねしません', '尋ねません',
      '不要です', '必要はありません', '記入不要', 'お答えいただく必要はありません',
    ],
    message: '本籍・出生地に関する質問は就職差別に当たるおそれがあります',
  },
  {
    code: 'family_job', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 2,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      `${FAMILY}.{0,12}(職業|お仕事|仕事|勤め|勤務先|会社|お勤め|職種)`,
      '(職業|お仕事|勤め先|勤務先).{0,8}(ご両親|父|母|ご家族|保護者)',
      `${FAMILY}(構成|は何人|の人数|は何名)`,
      '何人家族',
    ],
    exclude: ['変更があれば', '変更の際は', '扶養', '手続き'],
    message: '家族に関する質問は本人の適性・能力と関係がありません',
  },
  {
    code: 'family_edu', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 3,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [`${FAMILY}.{0,12}(学歴|出身校|出身大学|卒業)`],
    exclude: null,
    message: '家族の学歴に関する質問は就職差別に当たるおそれがあります',
  },
  {
    code: 'housing', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 4,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '(持ち家|持家|マイホーム)',
      '間取り',
      '(家賃|住宅).{0,8}(いくら|どのくらい|どれくらい|何万)',
      '(お住まい|住まい|ご自宅).{0,10}(広さ|何平米|賃貸|持ち家|一戸建て)',
    ],
    exclude: null,
    message: '住宅状況に関する質問は就職差別に当たるおそれがあります',
  },
  {
    code: 'assets', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 5,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '(ご家庭|ご家族|世帯|ご両親).{0,10}(収入|年収|所得|資産|預貯金)',
      '(世帯年収|世帯収入|家庭の事情|生活水準)',
    ],
    exclude: null,
    message: '生活環境・家庭環境に関する質問は避けてください',
  },
  {
    code: 'religion', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 6,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [`(宗教|信仰|宗派|信心).{0,10}(${ASK})`, '(宗教|信仰)は(何|どちら|お持ち)'],
    exclude: ['宗教学', '宗教史', '宗教法人'],
    message: '信条・宗教に関する質問は思想信条の自由を侵すおそれがあります',
  },
  {
    code: 'politics', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 7,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '支持(政党|する政党)',
      `(政党|政治).{0,10}(${ASK})`,
      '(選挙|投票).{0,8}(どちら|どこ|誰|だれ)(に|へ)',
    ],
    exclude: ['政治学', '政治経済'],
    message: '支持政党に関する質問は就職差別に当たるおそれがあります',
  },
  {
    code: 'thought', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 8,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '尊敬する(人物|人|方)',
      `(人生観|信条|座右の銘|思想).{0,10}(${ASK})`,
    ],
    exclude: ['弊社の信条', '当社の信条', '会社の信条'],
    message: '思想信条に関する質問は避けてください',
  },
  {
    code: 'union', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 9,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      `(労働組合|労組|学生運動|社会運動|デモ).{0,12}(${ASK})`,
      '(労働組合|学生運動|社会運動).{0,8}(参加|所属|加入)',
    ],
    exclude: ['弊社の労働組合', '当社の労働組合', '労働組合と協議', '労働組合との協議'],
    message: '労働組合・学生運動に関する質問は就職差別に当たるおそれがあります',
  },
  {
    code: 'newspaper', category: COMPLIANCE_CATEGORY.DISCRIMINATION, priority: 10,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: ['購読(新聞|紙|されている新聞)', '愛読(書|している本)', `(新聞|雑誌).{0,10}(購読|とって(いま|おら))`],
    exclude: null,
    message: '購読紙・愛読書に関する質問は思想信条の把握につながります',
  },

  // --- オワハラのおそれ ---
  {
    code: 'withdraw_others', category: COMPLIANCE_CATEGORY.OWAHARA, priority: 20,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '(他社|よそ|同業他社|他の会社|ほかの会社).{0,14}(辞退|お断り|断って|止めて|やめて|中止)',
      '(就活|就職活動).{0,10}(終わ|終了|やめ|止め|終え)',
      '(弊社|当社|うち).{0,6}(一本|1本|だけ).{0,10}(絞|して)',
      '(内定承諾|承諾書).{0,10}(今すぐ|即日|本日中)',
    ],
    exclude: null,
    message: '他社選考の辞退を条件にすることはオワハラに当たります',
  },
  {
    code: 'decide_now', category: COMPLIANCE_CATEGORY.OWAHARA, priority: 21,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: [
      '(今|いま)(この場|ここ|すぐ).{0,8}(決め|ご決断|ご返答|返事|回答)',
      'この場で(返事|回答|決め|ご決断)',
      '即答(いただ|して|を)',
    ],
    exclude: null,
    message: 'その場での意思決定の強要はオワハラに当たります',
  },
  {
    code: 'offer_condition', category: COMPLIANCE_CATEGORY.OWAHARA, priority: 22,
    severity: ALERT_SEVERITY.BLOCK,
    keywords: ['内定.{0,10}(代わりに|条件と|引き換え|ひきかえ)', '(条件|交換条件)として.{0,8}内定'],
    exclude: null,
    message: '内定を交換条件にすることは避けてください',
  },
  {
    code: 'deadline_today', category: COMPLIANCE_CATEGORY.OWAHARA, priority: 23,
    severity: ALERT_SEVERITY.WARN,
    keywords: [
      '(返事|ご返答|回答|ご連絡|お返事).{0,8}(は|を)?(本日|今日)中',
      '(本日|今日)中.{0,10}(返事|ご返答|回答|決め|ご判断|お返事)',
      '(明日|あす)(まで|中).{0,10}(決め|ご判断|ご返答)',
    ],
    exclude: null,
    message: '極端に短い回答期限は圧力と受け取られます',
  },
  {
    code: 'pressure_soft', category: COMPLIANCE_CATEGORY.OWAHARA, priority: 24,
    severity: ALERT_SEVERITY.WARN,
    keywords: [
      '(早め|早急|至急|なるべく早く).{0,10}(返事|ご返答|ご判断|決め|ご決断|お返事)',
      'すぐに(決め|ご判断|ご決断)',
    ],
    exclude: null,
    message: '判断を急がせる表現になっていないか確認してください',
  },
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

/**
 * ルームの折り返しの速さ。学生1人（＝1ルーム）に1つ割り当てる。
 *
 * ★固定間隔（もとは一律3時間）にしないこと。
 *   全ルームが同じ間隔だと「返信にかかった時間の分布」（P4-8）が1本の棒になり、
 *   速い担当と遅い担当の差も、24時間を超えた案件も見えない。
 */
const REPLY_PACES = Object.freeze([
  { key: 'fast', minHours: 0.4, maxHours: 3 },
  { key: 'normal', minHours: 2, maxHours: 8 },
  { key: 'slow', minHours: 5, maxHours: 18 },
  { key: 'stalled', minHours: 16, maxHours: 40 },
]);

/**
 * 本題の前にあるやり取り。人事と学生が交互に並ぶ。
 * 間隔は pace のぶんだけばらつかせ、**新しいほうから古いほうへ**積む
 * （間隔が変わっても最新メッセージの位置がずれないようにするため）。
 */
function buildFillerMessages(count, earliestHoursAgo, pace, random) {
  const messages = [];
  let hoursAgo = earliestHoursAgo;

  for (let i = count - 1; i >= 0; i -= 1) {
    hoursAgo += randomFloat(random, pace.minHours, pace.maxHours);
    const sender = i % 2 === 0 ? 'hr' : 'student';
    const lines = FILLER_LINES[sender];
    messages.push({ sender, hoursAgo, body: lines[i % lines.length] });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// 送信時刻のリズム
//
// ★hoursAgo をそのまま時刻にすると、シードを流した時刻しだいで人事が深夜3時に
//   返信していることになる。ダッシュボードの「時間帯別の送信タイミング」（P4-8）が
//   意味を持たなくなるうえ、単純に運用としておかしい。
// ---------------------------------------------------------------------------

/** 人事の営業時間（ローカル時刻）。9:00〜21:00。この範囲外の人事送信は作らない */
const BUSINESS_HOURS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => 9 + index),
);

/** 人事は営業時間を必ず守る。何時間さかのぼってでも範囲内に収める */
const HR_MAX_SHIFT_HOURS = 30;

/**
 * 学生の生活リズム。学生1人に1つ割り当て、その学生の送信をこの時間帯に寄せる。
 *
 * ★学生ごとに違う型を持たせるのが要点。全員を同じ時間帯にすると
 *   グラフが1本の山になり、「人事と学生でタイミングがずれている」ことが見えない。
 * ★深夜（2〜6時）はどの型にも入れない。夜型でも1時までに留める。
 */
const STUDENT_RHYTHMS = Object.freeze([
  /** 通学前後にこまめに返す */
  { key: 'commute', hours: [7, 8, 12, 13, 18, 19, 20, 21] },
  /** 夜にまとめて返す */
  { key: 'evening', hours: [17, 18, 19, 20, 21, 22, 23] },
  /** 日中に返せる（授業が少ない・在宅） */
  { key: 'daytime', hours: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
  /** 夜更かし型 */
  { key: 'late', hours: [20, 21, 22, 23, 0, 1] },
]);

/**
 * 学生のずらし幅の上限。これを超えるなら**元の時刻のまま残す**。
 * リズムを厳密に強制すると、受信箱のデモで作り込んだ経過時間（緊急度・返信遅れの
 * 閾値まわり）が動いてしまう。たまに時間外の送信が混ざるのは実態としても自然。
 */
const STUDENT_MAX_SHIFT_HOURS = 4;

/**
 * メッセージ間の最小間隔（分）。同じ時刻に2通並ばないようにする。
 * ★固定値にしないこと。時間外から寄せたぶんがすべてこの間隔に張り付いて、
 *   「返信にかかった時間」が最小値ちょうどの山になる。
 */
const MIN_GAP_MINUTES = [25, 90];

/**
 * 時間外から寄せるとき、許可時間帯の中でさらにさかのぼる最大時間。
 * 大きくすると時間帯の頭に寄り、0 にすると終わりの1時間に固まる。
 */
const MAX_SPREAD_HOURS = 3;

/**
 * その時刻を、許可された「時」に収まるまで**過去方向に**戻す。
 * `maxShiftHours` 以内に収まらなければ元の時刻を返す。
 */
function snapBackToHour(date, allowedHours, maxShiftHours, random) {
  const allowed = new Set(allowedHours);
  const result = new Date(date);

  for (let shift = 0; shift <= maxShiftHours; shift += 1) {
    if (allowed.has(result.getHours())) {
      if (shift > 0) {
        // ★時間帯の境界に固まらせない。
        //   単純に「最初に見つかった許可時刻」へ寄せると、時間外に落ちたぶんが
        //   すべて営業終了間際（20時台）に積み上がって、実態と違う山ができる。
        //   見つかった位置からさらに、許可された時間帯の中だけを randomly さかのぼる。
        for (let extra = randomInt(random, 0, MAX_SPREAD_HOURS); extra > 0; extra -= 1) {
          const candidate = new Date(result);
          candidate.setHours(candidate.getHours() - 1);
          if (!allowed.has(candidate.getHours())) break;
          result.setTime(candidate.getTime());
        }

        // 戻したぶんは分を散らす。毎時ちょうどに揃うと機械的に見える
        result.setMinutes(randomInt(random, 5, 55), 0, 0);
      }
      return result;
    }
    result.setHours(result.getHours() - 1);
  }

  return new Date(date);
}

/** 営業時間に収めた「N時間前」。人事が送ったことにするメッセージで使う */
function businessHoursIso(hoursAgo) {
  return snapBackToHour(
    new Date(NOW - hoursAgo * 3_600_000),
    BUSINESS_HOURS,
    HR_MAX_SHIFT_HOURS,
    timeRandom,
  ).toISOString();
}

/**
 * メッセージ列（古い順）に実時刻を割り当てる。
 *
 * ★**新しいほうから後ろ向きに決める。** 調整は必ず過去方向へ動かすので、
 *   1つ前のメッセージは必ずそれより古くなり、並び順が崩れない。
 *   前から決めて未来方向に押すと、最新メッセージが「今」を追い越しうる。
 *
 * 学生の発言→人事の返信の間隔は、営業時間をまたぐと自然に伸びる。
 * これがダッシュボードの「返信にかかった時間の分布」（P4-8）の山を作る。
 */
function buildMessageTimes(messages, rhythm, random) {
  const times = new Array(messages.length);
  let nextAt = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    let wanted = NOW - message.hoursAgo * 3_600_000;
    if (nextAt !== null) {
      wanted = Math.min(wanted, nextAt - randomInt(random, ...MIN_GAP_MINUTES) * 60_000);
    }

    const isHr = message.sender === 'hr';
    const at = snapBackToHour(
      new Date(wanted),
      isHr ? BUSINESS_HOURS : rhythm.hours,
      isHr ? HR_MAX_SHIFT_HOURS : STUDENT_MAX_SHIFT_HOURS,
      random,
    );

    times[index] = at;
    nextAt = at.getTime();
  }

  return times;
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
  // ★P4-1 のデモ用。48時間を超えて上長エスカレーションが立つ唯一のルーム。
  //   担当は hr1（admin1 にすると「上長が自分自身へ」の絵になり意図が伝わらない）。
  //   閾値を短縮しないデモでも、シード直後からエスカレーション済みで見せられる。
  {
    loginId: 'student11', displayName: '長谷川 遥', avatarColor: '#BF8C7C',
    university: '名古屋大学', faculty: '法学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_3,
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 72, body: '三次面接の結果は追ってご連絡いたします。' },
      { sender: 'student', hoursAgo: 50, body: '先日の面接の結果はいつ頃わかりますでしょうか。他社の選考もあり、ご連絡をお待ちしています。' },
    ],
  },
  // ★P4-5 のデモ用。面接日程は決まっているのに会議室が空欄のルーム。
  //   担当は hr1。シード直後から「会議室未設定」の通知が hr1 宛に立つ。
  //   会議室をプロフィールパネルに入力すると、その場で通知が消えるのを見せる。
  {
    loginId: 'student12', displayName: '富田 澪', avatarColor: '#7C9CBF',
    university: '横浜国立大学', faculty: '都市科学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_2,
    assignee: 'hr1', handlingStatus: HANDLING_STATUS.WAITING_STUDENT,
    scheduleState: SCHEDULE_STATE.ROOM_PENDING,
    nextInterviewAt: hoursAheadIso(26),
    nextInterviewRoom: null,
    interviewer: '松本 圭',
    fillerCount: 4,
    thread: [
      { sender: 'hr', hoursAgo: 30, body: '二次面接は明後日13時で確定いたしました。会場は追ってご連絡します。' },
      { sender: 'student', hoursAgo: 28, body: '承知しました。会場が決まりましたら教えてください。' },
    ],
  },
  {
    loginId: 'student2', displayName: '佐藤 花子', avatarColor: '#BFB27C',
    university: '早稲田大学', faculty: '商学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_2,
    assignee: 'hr2', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '候補日は8/10, 8/12, 8/14です。' },
      { sender: 'student', hoursAgo: 13, body: '8/12でお願いしたいのですが、日程を変更できますか。急に都合が悪くなってしまいました。' },
    ],
  },
  // ★P4-5 の「未アサインなら上長へ直行」を見せるルーム。学生自身が会場を尋ねているのに
  //   会議室が空欄で、担当者も付いていない＝最も取りこぼしやすい形。
  {
    loginId: 'student3', displayName: '鈴木 一郎', avatarColor: '#7CA8BF',
    university: '慶應義塾大学', faculty: '経済学部', gradYear: 2028, selectionStatus: SELECTION_STATUS.ENTRY,
    assignee: null, handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    scheduleState: SCHEDULE_STATE.ROOM_PENDING,
    nextInterviewAt: hoursAheadIso(40),
    nextInterviewRoom: null,
    fillerCount: 6,
    thread: [
      { sender: 'hr', hoursAgo: 6, body: '面接会場は本社ビル3階になります。' },
      { sender: 'student', hoursAgo: 2, body: '面接会場までの行き方を教えていただけますでしょうか？' },
    ],
  },
  {
    loginId: 'student4', displayName: '高橋 美咲', avatarColor: '#BF7C9C',
    university: '一橋大学', faculty: '社会学部', gradYear: 2027, selectionStatus: SELECTION_STATUS.INTERVIEW_3,
    assignee: 'admin1', handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    fillerCount: 8,
    thread: [
      { sender: 'hr', hoursAgo: 20, body: '最終面接の結果について確認中です。' },
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
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_3],
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
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_3, SELECTION_STATUS.OFFER],
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
    selectionStatuses: [SELECTION_STATUS.INTERVIEW_2, SELECTION_STATUS.INTERVIEW_3],
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

/**
 * 選考フローの初期設定（P2-11）。学生のマイページ（S-09）に並ぶステップ。
 * 四次・五次面接は使わない設定にして「取捨選択できる」ことがデモで分かるようにする。
 */
const SELECTION_STEPS = [
  {
    statusKey: SELECTION_STATUS.ENTRY, isEnabled: 1, label: null,
    description: 'エントリーの受付が完了した段階です。マイページから選考の進み方を確認できます。',
    points: '登録内容に誤りがないかご確認ください。ご不明点はチャットからお問い合わせいただけます。',
  },
  {
    statusKey: SELECTION_STATUS.DOCUMENT, isEnabled: 1, label: '書類選考',
    description: 'ご提出いただいたエントリーシートと履歴書を、採用担当と現場社員が拝見します。所要期間は5営業日ほどです。',
    points: '「学生時代に力を入れたこと」は、結果よりも過程での判断や工夫を具体的に書いていただけると伝わりやすいです。',
  },
  {
    statusKey: SELECTION_STATUS.APTITUDE, isEnabled: 1, label: null,
    description: 'SPI形式の適性検査です。所要時間は約60分、ご自宅のPCから受検いただけます。',
    points: '合否だけで判断する材料ではありません。落ち着いて取り組める時間帯を選んでください。',
  },
  {
    statusKey: SELECTION_STATUS.INTERVIEW_1, isEnabled: 1, label: null,
    description: '現場社員2名との面接です（約45分・オンライン可）。相互理解の場と考えています。',
    points: '入社後に関わる社員が担当します。仕事の実態について遠慮なく質問してください。',
  },
  {
    statusKey: SELECTION_STATUS.INTERVIEW_2, isEnabled: 1, label: null,
    description: '部門責任者との面接です（約60分・対面）。これまでの経験と当社での志向の重なりを伺います。',
    points: 'ご自身が何を大切に働きたいかを、率直にお話しいただけると擦り合わせがしやすくなります。',
  },
  {
    statusKey: SELECTION_STATUS.INTERVIEW_3, isEnabled: 1, label: '最終面接',
    description: '役員との最終面接です（約45分・対面）。相互の意思確認の場です。',
    points: '評価というより、入社後の期待値をすり合わせる時間です。迷っている点があればその場でお伝えください。',
  },
  { statusKey: SELECTION_STATUS.INTERVIEW_4, isEnabled: 0, label: null, description: null, points: null },
  { statusKey: SELECTION_STATUS.INTERVIEW_5, isEnabled: 0, label: null, description: null, points: null },
  {
    statusKey: SELECTION_STATUS.OFFER, isEnabled: 1, label: null,
    description: '内定のご連絡です。承諾の期限や入社までの流れは、担当より個別にご案内します。',
    points: '迷いがある場合は遠慮なくご相談ください。社員との面談の場を追加で設定できます。',
  },
];

/**
 * 選考フィードバック（P2-11）のデモ。
 * 学生のマイページでは**完了済みステップのぶんだけ**が見える。
 * student1 は一次面接中なので、書類・適性検査ぶんが本人に見える状態になる。
 */
const SELECTION_FEEDBACKS = [
  {
    loginId: 'student1', statusKey: SELECTION_STATUS.DOCUMENT,
    body: '志望動機が具体的で、当社の事業理解が深いと感じました。研究内容を平易に説明できている点も高く評価しています。',
  },
  {
    loginId: 'student1', statusKey: SELECTION_STATUS.APTITUDE,
    body: '論理分野が特に高い水準でした。安心して次の面接に進んでいただけます。',
  },
  {
    loginId: 'student2', statusKey: SELECTION_STATUS.DOCUMENT,
    body: 'ゼミでの活動を通じた課題設定の視点が印象的でした。面接ではその背景を詳しくお聞かせください。',
  },
  {
    loginId: 'student4', statusKey: SELECTION_STATUS.INTERVIEW_1,
    body: 'チームでの立ち回りについて具体的なお話をいただけました。次回は中長期のキャリア観を伺えればと思います。',
  },
];

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

/**
 * 生活リズムは並び順で配る。**乱数で配らない。**
 * 4種類が均等に散り、学生を1人足しても他の学生のリズムが変わらない。
 */
const STUDENTS = [...SHOWCASE_STUDENTS, ...buildGeneratedStudents()].map((student, index) => ({
  ...student,
  rhythm: STUDENT_RHYTHMS[index % STUDENT_RHYTHMS.length],
  // 生活リズムと同じ周期にすると「夜型は必ず遅い」のような偽の相関が出るので、ずらして配る
  pace: REPLY_PACES[(index * 3 + 1) % REPLY_PACES.length],
}));

/** メッセージ時刻の分の散らしに使う。学生生成とは別系列にして、片方を変えても他方がずれないようにする */
const timeRandom = createRandom(RANDOM_SEED + 1);

// ---------------------------------------------------------------------------
// 投入
// ---------------------------------------------------------------------------

function clearExistingData() {
  // rooms.last_message_id が messages を参照する循環FKがあるため、先にNULL化してから削除する。
  db.prepare(`UPDATE rooms SET last_message_id = NULL, ai_analyzed_message_id = NULL`).run();
  const tables = [
    'alerts', 'read_receipts', 'memos', 'room_members', 'calendar_bookings', 'calendar_events',
    'messages', 'schedule_requests', 'selection_feedbacks', 'student_notes', 'rooms', 'students',
    'calendar_interviewers', 'users', 'tag_rules', 'compliance_rules', 'snippets',
    'company_info', 'selection_steps',
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

function insertSelectionSteps() {
  const now = new Date().toISOString();
  SELECTION_STEPS.forEach((step, index) => {
    db.prepare(
      `INSERT INTO selection_steps (status_key, is_enabled, sort_order, label, description, points, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(step.statusKey, step.isEnabled, index, step.label, step.description, step.points, now);
  });
}

/** 学生を全員入れ終わってから呼ぶ（student_user_id が users を参照するため） */
function insertSelectionFeedbacks(studentUserIds, authorId) {
  const now = new Date().toISOString();
  for (const feedback of SELECTION_FEEDBACKS) {
    const studentUserId = studentUserIds[feedback.loginId];
    if (!studentUserId) continue;

    db.prepare(
      `INSERT INTO selection_feedbacks (student_user_id, status_key, body, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(studentUserId, feedback.statusKey, feedback.body, authorId, now, now);
  }
}

/**
 * 学生向けのお知らせ（P4-7）。**通知を作るのは本番と同じサービス**に任せる。
 * 手書きで alerts に INSERT すると、可視条件（完了済みステップだけFBを見せる）が
 * シードと本番で食い違う。
 *
 * FB は SELECTION_FEEDBACKS のうち本人に見えているぶんだけが通知になる。
 * 選考の進行は student1（二次面接）に1件だけ用意して、
 * 学生でログインした直後からお知らせが並んでいる状態にする。
 */
function insertStudentAlerts(studentUserIds, actorUserId) {
  for (const [loginId, studentUserId] of Object.entries(studentUserIds)) {
    const roomId = db
      .prepare('SELECT id FROM rooms WHERE student_user_id = ?')
      .get(studentUserId)?.id;
    if (!roomId) continue;

    if (loginId === 'student1') {
      notifySelectionAdvanced(db, {
        roomId,
        studentUserId,
        actorUserId,
        previousStatus: SELECTION_STATUS.INTERVIEW_1,
        nextStatus: SELECTION_STATUS.INTERVIEW_2,
      });
    }

    notifyVisibleFeedbacks(db, { roomId, studentUserId, actorUserId });
  }
}

/**
 * 過去の監視イベント（P4-4 のダッシュボード用）。
 *
 * ★なぜ手で入れるのか。
 *   `detectSlaBreaches()` は**いまこの瞬間**の滞留しか作れないので、
 *   「返信遅れ通知の発生推移（直近14日）」は必ず今日1本の棒になる。
 *   コンプライアンス検知も、人事が実際に不適切な文面を送るまで0件のままで、
 *   内訳グラフが空のままデモに出ることになる。
 *   **過去の履歴だけはシードで用意する。**「いま」のぶんは本番と同じ監視サービスが作る。
 *
 * ★解消済み（resolved_at あり）を多めにする。
 *   全部が未解決だと「1件も返信していない会社」になってしまう。
 *   ダッシュボードの KPI は未解決だけを数えるので、履歴を足しても数字は荒れない。
 */
function insertHistoricalAlerts({ hrUserIds }) {
  const managerIds = findManagerIds(db);
  const random = createRandom(RANDOM_SEED + 2);

  // 履歴を載せる相手。返信済み（waiting_student / done）のルームを使う。
  // ★未返信のルームに過去の遅延履歴を足さない。いま監視サービスが立てる通知と
  //   trigger_message_id が衝突して INSERT OR IGNORE に落ちるうえ、
  //   「解消済みの遅延」と「未解決の遅延」が同じ起点メッセージに二重に付く。
  //
  // 起点メッセージは**1件につき1通ずつ使い切る**。
  // ★冪等キー（kind, room_id, trigger_message_id, target_user_id）が重複すると
  //   黙って捨てられるので、使い回さないこと。7件しか入らない、という形で効いてくる。
  // 起点メッセージの時刻と発生日時は揃えない。ここで作りたいのは
  // 「いつ何件あったか」という履歴で、推移グラフが読むのは created_at だけ。
  const pool = db
    .prepare(
      `SELECT m.id AS messageId, r.id AS roomId, r.assignee_user_id AS assigneeId,
              su.display_name AS studentName
         FROM messages m
         JOIN rooms r ON r.id = m.room_id
         JOIN users su ON su.id = r.student_user_id
        WHERE m.sender_id = r.student_user_id
          AND r.assignee_user_id IS NOT NULL
          AND r.handling_status IN (?, ?)
        ORDER BY r.id, m.id`,
    )
    .all(HANDLING_STATUS.WAITING_STUDENT, HANDLING_STATUS.DONE);

  if (pool.length === 0) return { sla: 0, compliance: 0 };

  let poolCursor = 0;
  const takeTrigger = () => pool[poolCursor++ % pool.length];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO alerts
       (kind, severity, room_id, target_user_id, actor_user_id, trigger_message_id,
        rule_code, source, detail, created_at, read_at, resolved_at)
     VALUES
       (@kind, @severity, @roomId, @targetUserId, @actorUserId, @triggerMessageId,
        @ruleCode, @source, @detail, @createdAt, @readAt, @resolvedAt)`,
  );

  // --- 返信遅れの履歴（直近14日・日別にばらす） ---
  //
  // 1日あたり0〜3件。曜日で偏らせず、件数の山と谷が出る程度に散らす。
  let slaCount = 0;

  for (let daysAgo = DASHBOARD_TREND_DAYS - 1; daysAgo >= 1; daysAgo -= 1) {
    const perDay = randomInt(random, 0, 3);

    for (let i = 0; i < perDay; i += 1) {
      const target = takeTrigger();

      // その日の営業時間内に気づいて、数時間後に返信して解消した、という履歴
      const createdAt = new Date(NOW - daysAgo * 86_400_000);
      createdAt.setHours(pick(random, BUSINESS_HOURS), randomInt(random, 0, 59), 0, 0);

      const elapsedHours = randomFloat(random, 24, 40);
      const resolvedAt = new Date(createdAt.getTime() + randomFloat(random, 1, 8) * 3_600_000);

      slaCount += insert.run({
        kind: ALERT_KIND.SLA_NOTIFY,
        severity: ALERT_SEVERITY.WARN,
        roomId: target.roomId,
        targetUserId: target.assigneeId,
        actorUserId: target.assigneeId,
        triggerMessageId: target.messageId,
        ruleCode: null,
        source: null,
        detail: buildSlaDetail({
          kind: ALERT_KIND.SLA_NOTIFY,
          studentName: target.studentName,
          elapsedHours,
        }),
        createdAt: createdAt.toISOString(),
        readAt: createdAt.toISOString(),
        resolvedAt: resolvedAt.toISOString(),
      }).changes;
    }
  }

  // 上長へのエスカレーションも履歴を1〜2件。**解消済み**にする。
  // 未解決のエスカレーションは student11 のぶんを監視サービスが立てるので、
  // ここで足すと「上長対応中」が水増しされる。
  for (const [offset, managerId] of managerIds.entries()) {
    const target = takeTrigger();
    const createdAt = new Date(NOW - (4 + offset * 3) * 86_400_000);
    createdAt.setHours(pick(random, BUSINESS_HOURS), randomInt(random, 0, 59), 0, 0);

    insert.run({
      kind: ALERT_KIND.SLA_ESCALATE,
      severity: ALERT_SEVERITY.WARN,
      roomId: target.roomId,
      targetUserId: managerId,
      actorUserId: target.assigneeId,
      triggerMessageId: target.messageId,
      ruleCode: null,
      source: null,
      detail: buildSlaDetail({
        kind: ALERT_KIND.SLA_ESCALATE,
        studentName: target.studentName,
        elapsedHours: randomFloat(random, 48, 72),
      }),
      createdAt: createdAt.toISOString(),
      readAt: createdAt.toISOString(),
      resolvedAt: new Date(createdAt.getTime() + 6 * 3_600_000).toISOString(),
    });
  }

  // --- コンプライアンス検知の履歴 ---
  //
  // ★これは「起きた事実の記録」なので resolved_at は常に NULL（monitoring.md §4）。
  // ★内訳グラフが1本にならないよう、複数のルールに散らす。
  // ★`source: 'ai'` を混ぜる。辞書では拾えなかったぶんを AI が拾った、という絵。
  // ★`ackNote` に ACKNOWLEDGED を混ぜる。「警告を無視して送信」の件数は
  //   この機能の価値そのもの（monitoring.md §6）なので、0件だと何も伝わらない。
  const complianceHistory = [
    { code: 'honseki', matched: 'ご出身はどちら', daysAgo: 1, acknowledged: true },
    { code: 'family_job', matched: 'お父様のお仕事', daysAgo: 2, acknowledged: false },
    { code: 'deadline_today', matched: 'お返事は本日中', daysAgo: 3, acknowledged: true },
    { code: 'pressure_soft', matched: 'なるべく早くご返答', daysAgo: 5, acknowledged: false },
    { code: 'withdraw_others', matched: '他社は辞退', daysAgo: 6, source: COMPLIANCE_SOURCE.AI },
    { code: 'honseki', matched: '国籍', daysAgo: 9, acknowledged: false },
    { code: 'decide_now', matched: 'この場でご返答', daysAgo: 11, source: COMPLIANCE_SOURCE.AI },
    { code: 'union', matched: '学生運動に参加', daysAgo: 12, acknowledged: false },
  ];

  const ruleByCode = new Map(COMPLIANCE_RULES.map((rule) => [rule.code, rule]));
  let complianceCount = 0;

  for (const item of complianceHistory) {
    const rule = ruleByCode.get(item.code);
    const target = takeTrigger();

    const createdAt = new Date(NOW - item.daysAgo * 86_400_000);
    createdAt.setHours(pick(random, BUSINESS_HOURS), randomInt(random, 0, 59), 0, 0);

    const ackNote = item.acknowledged ? ACK_NOTE.ACKNOWLEDGED : ACK_NOTE.MISMATCHED;

    complianceCount += insert.run({
      kind: ALERT_KIND.COMPLIANCE,
      severity: rule.severity,
      roomId: target.roomId,
      // コンプライアンスは本人へ即時ダイアログで伝えるので通知先は持たない
      targetUserId: null,
      actorUserId: target.assigneeId ?? hrUserIds.hr1,
      triggerMessageId: target.messageId,
      ruleCode: item.code,
      source: item.source ?? COMPLIANCE_SOURCE.DICTIONARY,
      // 本文全体は入れない。該当箇所だけ（CLAUDE.md §6-8）
      detail: `${rule.message}｜該当：${item.matched}｜${ackNote}`,
      createdAt: createdAt.toISOString(),
      readAt: null,
      resolvedAt: null,
    }).changes;
  }

  return { sla: slaCount, compliance: complianceCount };
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

function insertComplianceRules() {
  for (const rule of COMPLIANCE_RULES) {
    // tag_rules と同じく1行＝1キーワード。除外語はルール単位なので全行に同じ値を複写する
    // （カンマ区切り。checkCompliance が split して「いずれかを含めば検知しない」を判定する）。
    const excludeKeyword = rule.exclude ? rule.exclude.join(',') : null;
    for (const keyword of rule.keywords) {
      db.prepare(
        `INSERT INTO compliance_rules (code, category, keyword, exclude_keyword, severity, message, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(rule.code, rule.category, keyword, excludeKeyword, rule.severity, rule.message, rule.priority);
    }
  }
  clearComplianceRuleCache();
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

  // ★時刻はルームを作る前に確定させる。営業時間・生活リズムへの寄せで
  //   最古のメッセージが元の想定より過去へ動くため、ルームの作成日時をそこから決める
  //   （ルームより古いメッセージがある状態を作らない）。
  const earliestThreadHoursAgo = Math.max(...student.thread.map((m) => m.hoursAgo));
  const filler = buildFillerMessages(student.fillerCount, earliestThreadHoursAgo, student.pace, timeRandom);
  const allMessages = [...filler, ...student.thread].sort((a, b) => b.hoursAgo - a.hoursAgo);
  const messageTimes = buildMessageTimes(allMessages, student.rhythm, timeRandom);

  const roomCreatedAt = new Date(messageTimes[0].getTime() - 3_600_000).toISOString();

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

  let lastMessageId = null;
  let lastMessageAt = null;
  let lastStudentMessageAt = null;
  let lastStudentTopicTag = null;

  for (const [index, msg] of allMessages.entries()) {
    const senderId = msg.sender === 'student' ? studentUserId : assigneeUserId || allHrIds[0];
    const createdAt = messageTimes[index].toISOString();
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
      // 人事の送信なので営業時間に収める（ここだけ深夜に残ると時間帯グラフに嘘が出る）
      businessHoursIso(2),
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
    insertComplianceRules();
    insertSnippets();
    insertCompanyInfo();
    insertSelectionSteps();

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
    const studentUserIds = Object.fromEntries(
      Object.entries(studentRefs).map(([loginId, ref]) => [loginId, ref.studentUserId]),
    );
    insertSelectionFeedbacks(studentUserIds, hrUserIds.hr1);
    insertStudentAlerts(studentUserIds, hrUserIds.hr1);
    // 学生のお知らせより後。ルームとメッセージが揃っていないと起点が引けない
    insertHistoricalAlerts({ hrUserIds });
  });

  run();

  const counts = {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    rooms: db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c,
    messages: db.prepare('SELECT COUNT(*) AS c FROM messages').get().c,
    tagRules: db.prepare('SELECT COUNT(*) AS c FROM tag_rules').get().c,
    complianceRules: db.prepare('SELECT COUNT(*) AS c FROM compliance_rules').get().c,
    snippets: db.prepare('SELECT COUNT(*) AS c FROM snippets').get().c,
    scheduleRequests: db.prepare('SELECT COUNT(*) AS c FROM schedule_requests').get().c,
    alerts: db.prepare('SELECT COUNT(*) AS c FROM alerts').get().c,
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
