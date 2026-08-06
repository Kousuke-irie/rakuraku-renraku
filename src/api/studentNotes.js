import { http } from "./client.js"

/**
 * 学生の選考メモ（S-10・api.md §2「学生の選考メモ」）
 *
 * note の形: `{ noteKey, body, updatedAt }`
 * `noteKey` は STUDENT_NOTE_KEY_VALUES（'overall' ＋ 選考ステップ）。
 *
 * **読み取りの関数は無い。** メモは GET /selection-flow/me に相乗りして届く
 * （マイページの往復を増やさないため）。
 *
 * 対象は常にサーバ側で認証済みの本人。userId を送る余地を作らない。
 */
export const studentNotesApi = {
  /**
   * PUT /api/student-notes/:noteKey → `{ note }`
   * 本文が空なら削除され、`note` は null で返る。
   * @param {string} noteKey
   * @param {string} body
   */
  save: (noteKey, body) => http.put(`/student-notes/${noteKey}`, { body }),
}

export default studentNotesApi
