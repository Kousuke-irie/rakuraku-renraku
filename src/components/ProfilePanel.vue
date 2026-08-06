<script setup>
// 学生プロフィールと対応ステータスのインライン編集（P1-2 / P2-4 / P2-9・frontend.md §9）
//
// 課題 C-4「担当者不在だと引き継げない」への回答の片割れ。
// 「担当外の人事がルームを開いても状況が1画面で把握できる」ことが受入条件なので、
// 値は常に表示し、そのまま編集できる（編集ボタンを挟まない）コントロールとして置く。
//
// **対応ステータスの変更口はここに一本化する（P1-2）。** 一覧行は表示のみ。
// 受信箱は3ペインが同一画面なので「一覧を離れず2クリック以内」は満たす
// （select を開く＝1クリック／選ぶ＝2クリック目）。
//
// 保存は各項目の change（select は選択時、input は確定・フォーカスアウト時）で即座に行う。
// 対応ステータスは rooms.updateHandlingStatus（socket 優先・楽観更新はストア側）、
// 担当人事は rooms.assign（PATCH /rooms/:id）、それ以外は rooms.updateStudent（PATCH /students/:userId）。
// 失敗時はストアがトーストを出し、ここでは表示値をサーバの値へ戻す。
import { computed, reactive, watch } from "vue"
import {
  HANDLING_STATUS_META,
  HANDLING_STATUS_VALUES,
  SELECTION_STATUS_META,
  SELECTION_STATUS_VALUES,
} from "../constants/index.js"
import { useRoomsStore } from "../stores/rooms.js"
import StudentFeedbackPanel from "./StudentFeedbackPanel.vue"

// #region constants
const UNASSIGNED_VALUE = ""
const UNASSIGNED_LABEL = "未割当"
// #endregion

const props = defineProps({
  /** rooms ストアの room（student を含む） */
  room: { type: Object, required: true },
})

// #region global state
const rooms = useRoomsStore()
// #endregion

// #region local state
/**
 * 入力中の値。room が socket で更新されたら syncFromRoom で上書きする。
 * 直接 room を v-model しないのは、保存に失敗した値を巻き戻せるようにするため。
 */
const draft = reactive({
  handlingStatus: "",
  assignee: UNASSIGNED_VALUE,
  selectionStatus: "",
  nextInterviewAt: "",
  nextInterviewRoom: "",
  interviewer: "",
})
// #endregion

// #region computed
const student = computed(() => props.room.student ?? {})

/** ラベルと入力を紐づける id。1画面に複数ルームは出ないが、念のためルームIDで一意にする */
const fieldId = computed(() => (name) => `profile-${props.room.id}-${name}`)

/** 未アサインは警告色で示す（P2-9） */
const isUnassigned = computed(() => draft.assignee === UNASSIGNED_VALUE)
// #endregion

// #region local methods
/** ISO8601(UTC) → `<input type="datetime-local">` の値（ローカル時刻） */
const toDateTimeLocal = (isoString) => {
  if (!isoString) return ""

  const date = new Date(isoString)
  const pad = (value) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `<input type="datetime-local">` の値（ローカル時刻）→ ISO8601(UTC)。空なら未設定 */
const toIsoUtc = (localValue) => (localValue ? new Date(localValue).toISOString() : null)

/** 表示値をサーバの値に合わせる。初期化と、保存失敗時の巻き戻しに使う */
const syncFromRoom = () => {
  draft.handlingStatus = props.room.handlingStatus ?? ""
  draft.assignee = props.room.assignee?.id ?? UNASSIGNED_VALUE
  draft.selectionStatus = student.value.selectionStatus ?? ""
  draft.nextInterviewAt = toDateTimeLocal(student.value.nextInterviewAt)
  draft.nextInterviewRoom = student.value.nextInterviewRoom ?? ""
  draft.interviewer = student.value.interviewer ?? ""
}

/**
 * 対応ステータス（P1-2）。楽観更新・ロールバック・トーストはすべてストアが持つ。
 * ロールバックされた場合は room の変化を watch が拾って draft も戻る。
 */
const saveHandlingStatus = () => rooms.updateHandlingStatus(props.room.id, draft.handlingStatus)

const saveAssignee = async () => {
  const assigneeUserId = draft.assignee === UNASSIGNED_VALUE ? null : Number(draft.assignee)
  if (assigneeUserId === (props.room.assignee?.id ?? null)) return

  const saved = await rooms.assign(props.room.id, assigneeUserId)
  if (!saved) syncFromRoom()
}

/**
 * 学生プロフィールの1項目を保存する。
 * @param {string} key patch のキー
 * @param {string|null} value 送信値
 * @param {string|null} current サーバ側の現在値（変化が無ければ送らない）
 */
const saveStudentField = async (key, value, current) => {
  if (value === (current ?? null)) return

  const saved = await rooms.updateStudent(student.value.userId, { [key]: value })
  if (!saved) syncFromRoom()
}

const saveSelectionStatus = () =>
  saveStudentField("selectionStatus", draft.selectionStatus, student.value.selectionStatus)

const saveNextInterviewAt = () =>
  saveStudentField(
    "nextInterviewAt",
    toIsoUtc(draft.nextInterviewAt),
    student.value.nextInterviewAt
  )

const saveNextInterviewRoom = () =>
  saveStudentField(
    "nextInterviewRoom",
    draft.nextInterviewRoom.trim() || null,
    student.value.nextInterviewRoom
  )

const saveInterviewer = () =>
  saveStudentField("interviewer", draft.interviewer.trim() || null, student.value.interviewer)
// #endregion

// #region lifecycle
// 担当者の選択肢（rooms.assignableUsers）は全ルーム共通なので InboxView が一度だけ取る。

// ルーム切替と、他の人事による変更（room:updated）の両方をここで拾う
watch(() => props.room, syncFromRoom, { immediate: true, deep: true })
// #endregion
</script>

<template>
  <div class="profile">
    <label
      class="profile__label"
      :for="fieldId('handling')"
    >対応ステータス</label>
    <select
      :id="fieldId('handling')"
      v-model="draft.handlingStatus"
      class="profile__control profile__control--handling"
      :style="{ color: HANDLING_STATUS_META[draft.handlingStatus]?.color }"
      @change="saveHandlingStatus"
    >
      <option
        v-for="status in HANDLING_STATUS_VALUES"
        :key="status"
        :value="status"
      >
        {{ HANDLING_STATUS_META[status].label }}
      </option>
    </select>

    <label
      class="profile__label"
      :for="fieldId('assignee')"
    >担当人事</label>
    <select
      :id="fieldId('assignee')"
      v-model="draft.assignee"
      class="profile__control"
      :class="{ 'profile__control--warn': isUnassigned }"
      @change="saveAssignee"
    >
      <option :value="UNASSIGNED_VALUE">
        {{ UNASSIGNED_LABEL }}
      </option>
      <option
        v-for="user in rooms.assignableUsers"
        :key="user.id"
        :value="user.id"
      >
        {{ user.displayName }}
      </option>
    </select>

    <label
      class="profile__label"
      :for="fieldId('selection')"
    >選考ステータス</label>
    <select
      :id="fieldId('selection')"
      v-model="draft.selectionStatus"
      class="profile__control"
      @change="saveSelectionStatus"
    >
      <option
        v-for="status in SELECTION_STATUS_VALUES"
        :key="status"
        :value="status"
      >
        {{ SELECTION_STATUS_META[status].label }}
      </option>
    </select>

    <label
      class="profile__label"
      :for="fieldId('interview-at')"
    >次回面接</label>
    <input
      :id="fieldId('interview-at')"
      v-model="draft.nextInterviewAt"
      type="datetime-local"
      class="profile__control"
      @change="saveNextInterviewAt"
      @keyup.esc="syncFromRoom"
    >

    <label
      class="profile__label"
      :for="fieldId('interview-room')"
    >会議室</label>
    <input
      :id="fieldId('interview-room')"
      v-model="draft.nextInterviewRoom"
      type="text"
      class="profile__control"
      placeholder="未設定"
      maxlength="100"
      @change="saveNextInterviewRoom"
      @keyup.esc="syncFromRoom"
    >

    <label
      class="profile__label"
      :for="fieldId('interviewer')"
    >担当面接官</label>
    <input
      :id="fieldId('interviewer')"
      v-model="draft.interviewer"
      type="text"
      class="profile__control"
      placeholder="未設定"
      maxlength="100"
      @change="saveInterviewer"
      @keyup.esc="syncFromRoom"
    >

    <!-- 選考フィードバック（P2-11）。面接直後にこの学生の文脈のまま書けるようここに置く -->
    <StudentFeedbackPanel
      v-if="student.userId"
      class="profile__feedback"
      :student-user-id="student.userId"
      :selection-status="student.selectionStatus"
    />
  </div>
</template>

<style scoped>
/* プロフィールは2カラムのグリッド。FBパネルは行全体を使う */
.profile__feedback {
  grid-column: 1 / -1;
  margin-top: var(--space-md);
}

.profile {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: var(--space-xs) var(--space-md);
  align-items: center;
  padding: var(--space-lg) 0;
  border-bottom: 1px solid var(--color-hairline);
}

.profile__label {
  color: var(--color-ink-mute);
  font-size: 11px;
  line-height: 1.5;
}

/* 既定は素の文字に見せ、hover・focus で編集できることを示す */
.profile__control {
  width: 100%;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--color-ink);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}

.profile__control:hover {
  border-color: var(--color-hairline);
  background-color: var(--color-orange-soft);
}

.profile__control:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

/* 対応ステータスは一覧のチップと同じ色を文字色で持たせる（色は inline style で指定）。
   一覧行から変更口が消えたぶん、右ペインで現在値が目に入るようにする（P1-2） */
.profile__control--handling {
  font-weight: 700;
}

/* 値が空のときの placeholder は「未設定」。色で薄く見せる */
.profile__control::placeholder {
  color: var(--color-ink-mute);
}

/* 未割当は警告色の枠＋「未割当」のテキストで示す（色だけに頼らない・CLAUDE.md §6-13） */
.profile__control--warn {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}
</style>
