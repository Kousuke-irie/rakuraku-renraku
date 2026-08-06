<script setup>
// 会社情報の編集フォーム（設定画面・P2-10）
//
// ここで人事が入れた値が、そのまま学生のトーク画面の CompanyPanel に出る。
// 1行しかないマスタデータなので、一覧・追加・削除は持たず「読み込んで直して保存」だけ。
//
// 保存の成否のトーストは ui ストア側（saveCompany）が出すので、ここでは出さない。
import { computed, onMounted, ref, watch } from "vue"
import { useUiStore } from "../stores/ui.js"

// #region constants
/** サーバ側（routes/company.js）の上限と揃える。ずれると保存時だけ弾かれて理由が分からない */
const NAME_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 1000
const URL_MAX_LENGTH = 500
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
const name = ref("")
const description = ref("")
const recruitSiteUrl = ref("")
const saving = ref(false)
// #endregion

// #region local methods
/** ストアの値を下書きに写す。未設定（null）は空欄として扱う */
const resetDraft = (company) => {
  name.value = company?.name ?? ""
  description.value = company?.description ?? ""
  recruitSiteUrl.value = company?.recruitSiteUrl ?? ""
}
// #endregion

// #region computed
const canSave = computed(
  () =>
    !saving.value &&
    name.value.trim().length > 0 &&
    name.value.trim().length <= NAME_MAX_LENGTH &&
    description.value.length <= DESCRIPTION_MAX_LENGTH &&
    recruitSiteUrl.value.trim().length <= URL_MAX_LENGTH
)

const isDirty = computed(
  () =>
    name.value !== (ui.company?.name ?? "") ||
    description.value !== (ui.company?.description ?? "") ||
    recruitSiteUrl.value !== (ui.company?.recruitSiteUrl ?? "")
)
// #endregion

// #region lifecycle
onMounted(async () => {
  await ui.fetchCompany()
  resetDraft(ui.company)
})

// 別タブなどで保存された結果がストアに入ったら下書きも追従させる。
// ただし編集中の入力を消さないよう、変更が無いときだけ写す
watch(
  () => ui.company,
  (company) => {
    if (!isDirty.value) resetDraft(company)
  }
)
// #endregion

// #region browser event handler
const onSubmit = async () => {
  if (!canSave.value) return

  saving.value = true
  const saved = await ui.saveCompany({
    name: name.value.trim(),
    description: description.value.trim() || null,
    recruitSiteUrl: recruitSiteUrl.value.trim() || null,
  })
  saving.value = false

  if (saved) resetDraft(saved)
}
// #endregion
</script>

<template>
  <form
    class="company-settings"
    @submit.prevent="onSubmit"
  >
    <p class="company-settings__hint">
      学生のトーク画面の右側に表示されます。学生は閲覧のみで、編集はできません。
    </p>

    <label class="company-settings__field">
      <span class="company-settings__label">会社名</span>
      <input
        v-model="name"
        type="text"
        class="company-settings__input"
        :maxlength="NAME_MAX_LENGTH"
        placeholder="例：株式会社ラクラク"
        required
      >
    </label>

    <label class="company-settings__field">
      <span class="company-settings__label">
        紹介文
        <span class="company-settings__count">{{ description.length }} / {{ DESCRIPTION_MAX_LENGTH }}</span>
      </span>
      <textarea
        v-model="description"
        class="company-settings__body"
        rows="6"
        :maxlength="DESCRIPTION_MAX_LENGTH"
        placeholder="どんな会社か、新卒採用で何を大切にしているかを書いてください"
      />
    </label>

    <label class="company-settings__field">
      <span class="company-settings__label">採用サイトURL</span>
      <input
        v-model="recruitSiteUrl"
        type="url"
        class="company-settings__input"
        :maxlength="URL_MAX_LENGTH"
        placeholder="https://example.com/recruit"
      >
      <span class="company-settings__note">
        http:// または https:// から始まるURLのみ登録できます。空欄にするとリンクを出しません。
      </span>
    </label>

    <div class="company-settings__actions">
      <button
        type="button"
        class="button-normal"
        :disabled="!isDirty || saving"
        @click="resetDraft(ui.company)"
      >
        変更を破棄
      </button>
      <button
        type="submit"
        class="button-primary"
        :disabled="!canSave || !isDirty"
      >
        保存
      </button>
    </div>
  </form>
</template>

<style scoped>
.company-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.company-settings__hint {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
  line-height: 1.6;
}

.company-settings__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.company-settings__label {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  justify-content: space-between;
  color: var(--color-ink-mute);
  font-size: 12px;
  font-weight: 700;
}

.company-settings__count {
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.company-settings__note {
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.6;
}

/* 定型文の編集フォーム（SnippetEditor）と同じ入力欄の体裁に揃える */
.company-settings__input,
.company-settings__body {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 14px;
  font-family: inherit;
}

.company-settings__body {
  line-height: 1.6;
  resize: vertical;
}

.company-settings__input:focus-visible,
.company-settings__body:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.company-settings__actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
</style>
