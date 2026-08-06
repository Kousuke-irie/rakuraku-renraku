// 会社情報の取得・更新（P2-10）。REST（routes/company.js）から呼ぶ問い合わせをここに集約する。
//
// database.md §3 のとおり company_info は **必ず1行**（id = 1 の CHECK 制約）。
// 行が無い状態（migrate だけして seed していない）でも学生のパネルが壊れないよう、
// 取得側は null を返し、更新側は UPSERT で1行目を作る。

const COMPANY_SELECT_SQL = `
  SELECT name, description, recruit_site_url AS recruitSiteUrl, updated_at AS updatedAt
  FROM company_info
  WHERE id = 1
`;

/**
 * @returns {{ name: string, description: string|null, recruitSiteUrl: string|null, updatedAt: string }|null}
 *          未設定なら null
 */
export function getCompanyInfo(db) {
  return db.prepare(COMPANY_SELECT_SQL).get() ?? null;
}

/**
 * 会社情報を1行だけ保存する（無ければ作る）。
 * 3項目すべてを受け取る全置換。部分更新にすると「紹介文を空にする」が表現できないため。
 *
 * @param {{ name: string, description: string|null, recruitSiteUrl: string|null }} input
 */
export function saveCompanyInfo(db, { name, description, recruitSiteUrl }) {
  db.prepare(
    `INSERT INTO company_info (id, name, description, recruit_site_url, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       recruit_site_url = excluded.recruit_site_url,
       updated_at = excluded.updated_at`
  ).run(name, description, recruitSiteUrl, new Date().toISOString());

  return getCompanyInfo(db);
}
