import { http } from './client.js'

/** ホームのAI現況サマリー（P3-1a）。 */
export const aiSummaryApi = {
  /** キャッシュ済み要約を取得。未生成ならサーバ側で生成を開始する。 */
  get: () => http.get('/ai/summary'),
  /** キャッシュを破棄し、Geminiで再生成する。 */
  regenerate: () => http.post('/ai/summary'),
}

export default aiSummaryApi
