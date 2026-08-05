<script setup>
// 自分のプロフィール編集ダイアログ（ナビレールのアイコンから開く・B-5）
//
// ★このコンポーネントは**雛形**である。入力はローカル state に載るだけで、
//   保存は無効化してある。サーバ側の PUT /api/users/me（server/routes/users.js）が
//   まだ空で、authStore.updateProfile が必ず失敗するため。
//   B-5 が入ったら onSubmit で auth.updateProfile を呼び、hint を消す。
//
// ★アバター色の選択は入れていない。プリセット色は shared/constants.js に置くべきで、
//   あのファイルは単独 PR にする決まりのため（CLAUDE.md §8）。
//
// 画面中央に浮かせるため native <dialog> の showModal() を使う。
// backdrop・フォーカストラップ・top layer への昇格が標準で付くので、
// レール側の overflow: hidden に切られる心配もない。
//
// ★Esc は UA 既定に任せず自分で拾う。この画面では既定の close watcher が
//   働かず（Vuetify のグローバル keydown と競合していると見られる）閉じないため。
import { ref, watch } from "vue"
import { useAuthStore } from "../stores/auth.js"
import { useUiStore } from "../stores/ui.js"
import UserAvatar from "./UserAvatar.vue"

// #region global state
const auth = useAuthStore()
const ui = useUiStore()
// #endregion

// #region local variable
/** @type {import('vue').Ref<HTMLDialogElement|null>} */
const dialogEl = ref(null)

const displayName = ref("")
const statusMessage = ref("")
// #endregion

// #region local methods
/** 開くたびに現在のユーザー情報から入力欄を作り直す（前回の編集を持ち越さない） */
const resetForm = () => {
  displayName.value = auth.user?.displayName ?? ""
  statusMessage.value = auth.user?.statusMessage ?? ""
}
// #endregion

// #region lifecycle
watch(
  () => ui.profileDialogOpen,
  (open) => {
    const dialog = dialogEl.value
    if (!dialog) return

    if (open) {
      resetForm()
      dialog.showModal()
      return
    }
    dialog.close()
  }
)
// #endregion

// #region browser event handler
/** Esc・close() の両方から呼ばれるので、ストア側の状態をここで必ず閉じる */
const onClose = () => ui.closeProfileDialog()

/** backdrop のクリックは dialog 自身が target になる（中身のクリックでは閉じない） */
const onBackdropClick = (event) => {
  if (event.target === dialogEl.value) ui.closeProfileDialog()
}
// #endregion
</script>

<template>
  <dialog
    ref="dialogEl"
    class="dialog"
    aria-labelledby="profile-dialog-title"
    @close="onClose"
    @click="onBackdropClick"
    @keydown.escape.prevent="ui.closeProfileDialog()"
  >
    <div class="dialog__body">
      <h2
        id="profile-dialog-title"
        class="dialog__title"
      >
        プロフィールを編集
      </h2>

      <div class="dialog__identity">
        <UserAvatar
          :display-name="displayName"
          :color="auth.user?.avatarColor ?? ''"
          size="lg"
        />
        <p class="dialog__login-id">
          ログインID：{{ auth.user?.loginId }}
        </p>
      </div>

      <form
        class="dialog__form"
        @submit.prevent
      >
        <label
          class="dialog__label"
          for="profile-display-name"
        >表示名</label>
        <input
          id="profile-display-name"
          v-model="displayName"
          class="dialog__input"
          type="text"
          autocomplete="off"
        >

        <label
          class="dialog__label dialog__label--stacked"
          for="profile-status-message"
        >ステータスメッセージ</label>
        <input
          id="profile-status-message"
          v-model="statusMessage"
          class="dialog__input"
          type="text"
          placeholder="例：8/10まで出張中"
          autocomplete="off"
        >

        <p class="dialog__hint">
          ※ 保存は未実装です（B-5：PUT /api/users/me）
        </p>

        <div class="dialog__actions">
          <button
            type="button"
            class="button-normal"
            @click="ui.closeProfileDialog()"
          >
            キャンセル
          </button>
          <button
            type="submit"
            class="button-primary"
            disabled
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
/* 画面中央に浮かせる。margin: auto は dialog:modal の UA 既定だが、
   Vuetify のリセットが margin を潰すため明示的に指定し直す（無いと上端に張り付く） */
.dialog {
  width: min(420px, calc(100vw - var(--space-huge) * 2));
  margin: auto;
  padding: 0;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  box-shadow: var(--shadow-2);
}

.dialog::backdrop {
  background-color: rgb(29 29 29 / 32%);
}

.dialog__body {
  padding: var(--space-xxl);
}

.dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02px;
}

.dialog__identity {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  padding: var(--space-lg) 0;
  border-bottom: 1px solid var(--color-hairline);
  margin-bottom: var(--space-lg);
}

.dialog__login-id {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.dialog__form {
  display: flex;
  flex-direction: column;
}

.dialog__label {
  margin-bottom: var(--space-xs);
  font-size: 13px;
  font-weight: 700;
}

/* 2つ目以降の項目。1つ目は見出しとの間隔があるので付けない */
.dialog__label--stacked {
  margin-top: var(--space-lg);
}

.dialog__input {
  padding: 9px var(--space-md);
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-size: 15px;
}

.dialog__hint {
  margin: var(--space-md) 0 0;
  color: var(--color-ink-mute);
  font-size: 12px;
}

.dialog__actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: var(--space-xxl);
}
</style>
