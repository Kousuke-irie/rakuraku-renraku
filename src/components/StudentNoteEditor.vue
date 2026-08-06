<script setup>
// 学生の選考メモ（S-10・frontend.md §7-3）
//
// 学生が自分のためだけに書くメモ。ステップ別（詳細の右カラム）と
// 選考全体（フローの下の独立カード）で同じものを使い回す。違いは noteKey と見出しだけ。
//
// ★このコンポーネントを人事側の画面に置かないこと。本人にしか見えないことが前提の機能。
//
// 保存は自動。書きかけが消えることを学生に心配させないのが最優先なので、
//   ・入力が止まって 800ms
//   ・入力欄から離れたとき
//   ・ステップを切り替えたとき（切り替え「前」の本文を送る）
//   ・画面から外れるとき
// の4つで送る。失敗しても入力中の本文は消さない（トーストはストアが出す）。
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { STUDENT_NOTE_MAX_LENGTH } from "../constants/index.js"
import { useUiStore } from "../stores/ui.js"

const props = defineProps({
  /** STUDENT_NOTE_KEY_VALUES のいずれか。'overall' は選考全体のメモ */
  noteKey: { type: String, required: true },
  /** @type {{noteKey: string, body: string, updatedAt: string}|null} サーバから届いた保存済みの本文 */
  note: { type: Object, default: null },
  label: { type: String, required: true },
  placeholder: { type: String, default: "" },
  rows: { type: Number, default: 4 },
})

// #region constants
/** 入力が止まったと見なすまでの時間（ms）。打鍵のたびに送らないための間 */
const AUTOSAVE_DELAY_MS = 800
// #endregion

// #region global state
const ui = useUiStore()
// #endregion

// #region local state
const draft = ref(props.note?.body ?? "")

/** 保存後にサーバと一致しているか。一致していれば外から来た値で置き換えてよい */
const isDirty = ref(false)

/** @type {import('vue').Ref<'idle'|'saving'|'saved'|'error'>} */
const status = ref("idle")

/**
 * 最後にサーバへ送った本文。同じ内容を二度送らないための比較用。
 * 描画に使わないので ref にしない。
 */
let savedBody = props.note?.body ?? ""

let timer = null
// #endregion

// #region computed
const inputId = computed(() => `student-note-${props.noteKey}`)

const statusText = computed(
  () =>
    ({
      saving: "保存中…",
      saved: "保存しました",
      error: "保存できませんでした",
    })[status.value] ?? ""
)
// #endregion

// #region local methods
const clearTimer = () => {
  if (timer === null) return
  clearTimeout(timer)
  timer = null
}

/**
 * 保存。空文字はサーバ側で削除として扱われる。
 * @param {string} noteKey 送信対象。ステップ切り替え時は切り替え「前」のキーを渡す
 * @param {string} body
 */
const save = async (noteKey, body) => {
  const ok = await ui.saveStudentNote(noteKey, body)

  // 送信中にステップが切り替わっていたら、いまの入力欄の状態には触らない
  // （ストアの更新は saveStudentNote が noteKey 単位で済ませている）
  if (noteKey !== props.noteKey) return

  if (ok) {
    savedBody = body
    isDirty.value = false
    status.value = "saved"
  } else {
    status.value = "error"
  }
}

/** 待機中のぶんを今すぐ送る。中身が変わっていなければ何もしない */
const flush = () => {
  clearTimer()

  const body = draft.value.trim()
  if (body === savedBody) {
    isDirty.value = false
    return
  }

  status.value = "saving"
  save(props.noteKey, body)
}
// #endregion

// #region lifecycle
/**
 * ステップの切り替え。**切り替え前の本文を先に送ってから**入力欄を差し替える。
 * ここで送らないと、詳細を切り替えただけで書きかけが消える。
 *
 * 親が :key で作り直す使い方（SelectionStepDetail）では、この watch ではなく
 * unmount 側の保存が走る。どちらの経路でも消えないよう両方に置いてある。
 */
watch(
  () => props.noteKey,
  (nextKey, prevKey) => {
    clearTimer()

    const pending = draft.value.trim()
    if (isDirty.value && pending !== savedBody) save(prevKey, pending)

    draft.value = props.note?.body ?? ""
    savedBody = draft.value
    isDirty.value = false
    status.value = "idle"
  }
)

/**
 * サーバから届いた本文の反映。
 * ★入力中は上書きしない。保存の往復中に打った続きを打ち消してしまうため。
 */
watch(
  () => props.note,
  (note) => {
    const incoming = note?.body ?? ""
    if (isDirty.value || draft.value.trim() === incoming) return

    draft.value = incoming
    savedBody = incoming
  }
)

onBeforeUnmount(() => {
  clearTimer()

  const body = draft.value.trim()
  // 応答は待てないが、送りさえすれば保存される
  if (isDirty.value && body !== savedBody) ui.saveStudentNote(props.noteKey, body)
})
// #endregion

// #region browser event handler
const onInput = () => {
  isDirty.value = true
  status.value = "idle"

  clearTimer()
  timer = setTimeout(flush, AUTOSAVE_DELAY_MS)
}

const onBlur = () => {
  if (isDirty.value) flush()
}
// #endregion
</script>

<template>
  <section class="note">
    <header class="note__head">
      <label
        class="note__label"
        :for="inputId"
      >{{ label }}</label>

      <!-- 保存の状態は控えめに。書くことより先に目に入る必要はない -->
      <p
        class="note__status"
        :class="{ 'note__status--error': status === 'error' }"
        aria-live="polite"
      >
        {{ statusText }}
      </p>
    </header>

    <textarea
      :id="inputId"
      v-model="draft"
      class="note__input"
      :rows="rows"
      :maxlength="STUDENT_NOTE_MAX_LENGTH"
      :placeholder="placeholder"
      @input="onInput"
      @blur="onBlur"
    />
  </section>
</template>

<style scoped>
/* 企業からのFB（クリームの面＋オレンジの帯）に対して、こちらは白い面のままにする。
   会社から届いたものと自分が書いたものが、色で見分けられるようにするため */
.note {
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background-color: var(--color-canvas);
  transition: border-color 120ms ease;
}

.note:focus-within {
  border-color: var(--color-primary);
}

.note__head {
  display: flex;
  gap: var(--space-sm);
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg) 0;
}

.note__label {
  color: var(--color-ink-mute);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.note__status {
  margin: 0;
  color: var(--color-ink-mute);
  font-size: 11px;
}

.note__status--error {
  color: var(--color-error);
}

/* 枠は外側のカードが持つ。入力欄そのものは紙の面に見せる */
.note__input {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-lg) var(--space-md);
  border: 0;
  background: none;
  color: var(--color-ink);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.85;
  resize: vertical;
}

.note__input:focus {
  outline: none;
}

.note__input::placeholder {
  color: color-mix(in srgb, var(--color-ink-mute) 65%, var(--color-canvas));
}

@media (prefers-reduced-motion: reduce) {
  .note {
    transition: none;
  }
}
</style>
