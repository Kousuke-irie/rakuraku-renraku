// 実効AI推奨度の SQL 断片（P3-1改訂 / business-logic.md §7）。
//
// AI が判定できたときは ai_priority、未判定・失敗・スキップのときは urgency に落とす。
// 受信箱の並び順（roomView.js）と個人ダッシュボードの構成比（personalDashboard.js）が
// **同じ式**を見るようにするための共有物。
// ★片方だけ直すと「受信箱では高なのにグラフでは通常」という食い違いが出る。
import { AI_ANALYSIS_STATUS } from '../../shared/constants.js';

/** ルームの別名は `r` で固定。呼び出し側の FROM/JOIN で合わせること */
export const EFFECTIVE_PRIORITY_SQL = `CASE
      WHEN r.ai_analysis_status = '${AI_ANALYSIS_STATUS.COMPLETED}' AND r.ai_priority IS NOT NULL
        THEN r.ai_priority
      ELSE r.urgency
    END`;

/** 上の式が AI 判定を採用した（＝urgency へ落ちなかった）行だけ 1 になる */
export const AI_RESOLVED_SQL = `CASE
      WHEN r.ai_analysis_status = '${AI_ANALYSIS_STATUS.COMPLETED}' AND r.ai_priority IS NOT NULL
        THEN 1
      ELSE 0
    END`;
