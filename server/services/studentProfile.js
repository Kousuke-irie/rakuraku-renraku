// P2-4: 学生プロフィール（選考ステータス・次回面接・会議室・面接官・日程調整進捗）の取得と更新。
// ルーム一覧の room.student と同じ形を返し、クライアント側が浅いマージで差し替えられるようにする。

const STUDENT_SELECT_SQL = `
  SELECT
    u.id                   AS userId,
    u.display_name         AS displayName,
    u.avatar_color         AS avatarColor,
    st.university,
    st.faculty,
    st.grad_year           AS gradYear,
    st.selection_status    AS selectionStatus,
    st.next_interview_at   AS nextInterviewAt,
    st.next_interview_room AS nextInterviewRoom,
    st.interviewer,
    st.schedule_state      AS scheduleState
  FROM students st
  JOIN users u ON u.id = st.user_id
  WHERE st.user_id = ?
`;

/** 更新を許可するカラム。ここに無いキーはリクエストに含まれていても無視する */
const UPDATABLE_COLUMNS = Object.freeze({
  selectionStatus: 'selection_status',
  nextInterviewAt: 'next_interview_at',
  nextInterviewRoom: 'next_interview_room',
  interviewer: 'interviewer',
  scheduleState: 'schedule_state',
});

export function findStudent(db, userId) {
  return db.prepare(STUDENT_SELECT_SQL).get(userId) ?? null;
}

/**
 * 学生が所属する DM ルームのID。認可（その人事がルームのメンバーか）の判定に使う。
 * @returns {number|null}
 */
export function findRoomIdByStudent(db, userId) {
  const row = db.prepare('SELECT id FROM rooms WHERE student_user_id = ?').get(userId);
  return row?.id ?? null;
}

/**
 * プロフィールを部分更新する。patch に含まれるキーだけを更新する。
 * カラム名は UPDATABLE_COLUMNS 経由でしか組み立てないため、SQL に外部入力は入らない
 * （値は常にプレースホルダ）。
 * @param {object} patch 検証済みの値。undefined のキーは更新しない
 * @returns {object} 更新後の学生
 */
export function updateStudent(db, userId, patch) {
  const entries = Object.entries(UPDATABLE_COLUMNS).filter(
    ([key]) => patch[key] !== undefined
  );

  if (entries.length > 0) {
    const assignments = entries.map(([, column]) => `${column} = ?`).join(', ');
    const values = entries.map(([key]) => patch[key]);

    db.prepare(`UPDATE students SET ${assignments}, updated_at = ? WHERE user_id = ?`).run(
      ...values,
      new Date().toISOString(),
      userId
    );
  }

  return findStudent(db, userId);
}
