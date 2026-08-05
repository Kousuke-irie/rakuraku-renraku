<script setup>
import { computed, ref, reactive, onMounted } from "vue"
import { useRouter } from "vue-router"
import socketManager from '../socketManager.js'
import { useAuthStore } from '../stores/auth.js'

// #region global state
const auth = useAuthStore()
const userName = computed(() => auth.user?.displayName ?? "")
// #endregion

// #region local variable
const router = useRouter()
const socket = socketManager.getInstance()
// #endregion

// #region reactive variable
const chatContent = ref("")
const chatList = reactive([])
// #endregion

// #region lifecycle
onMounted(() => {
  registerSocketEvent()
})
// #endregion

// #region browser event handler
// 投稿メッセージをサーバに送信する
const onPublish = () => {
  const content = chatContent.value.trim()

  if (!content) return

  socket.emit("publishEvent", {
    userName: userName.value,
    content,
  })
  // 入力欄を初期化
  chatContent.value = ""

}

// 退室メッセージをサーバに送信し、ログアウトする
const onExit = async () => {
  socket.emit("exitEvent", { userName: userName.value })
  await auth.logout()
  router.push({ name: "login" })
}

// メモを画面上に表示する
const onMemo = () => {
  // メモの内容を表示
  const content = chatContent.value.trim()

  if (!content) return

  chatList.unshift(`${userName.value} さんのメモ：${content}`)
  // 入力欄を初期化
  chatContent.value = ""

}
// #endregion

// #region socket event handler
// サーバから受信した入室メッセージ画面上に表示する
const onReceiveEnter = (data) => {
  chatList.unshift(`${data.userName} さんが入室しました`)
}

// サーバから受信した退室メッセージを受け取り画面上に表示する
const onReceiveExit = (data) => {
      chatList.unshift(`${data.userName} さんが退室しました`)
}

// サーバから受信した投稿メッセージを画面上に表示する
const onReceivePublish = (data) => {
  chatList.unshift(`${data.userName} さん：${data.content}`)
}
// #endregion

// #region local methods
// イベント登録をまとめる
const registerSocketEvent = () => {
  // 入室イベントを受け取ったら実行
  socket.on("enterEvent", onReceiveEnter)

  // 退室イベントを受け取ったら実行
  socket.on("exitEvent", onReceiveExit)

  // 投稿イベントを受け取ったら実行
  socket.on("publishEvent", onReceivePublish)
}
// #endregion
</script>

<template>
  <div class="mx-auto my-5 px-4">
    <h1 class="text-h3 font-weight-medium">Vue.js Chat チャットルーム</h1>
    <div class="mt-10">
      <p>ログインユーザ：{{ userName }}さん</p>
      <textarea 
        v-model="chatContent" variant="outlined" placeholder="投稿文を入力してください" rows="4" class="area"></textarea>
      <div class="mt-5">
        <button class="button-normal" @click="onPublish">投稿</button>
        <button class="button-normal util-ml-8px" @click="onMemo">メモ</button>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="item mt-4" v-for="(chat, i) in chatList" :key="i">{{ chat }}</li>
        </ul>
      </div>
    </div>
    <button type="button" class="button-normal button-exit" @click="onExit">退室する</button>
  </div>
</template>

<style scoped>
.area {
  width: 500px;
  border: 1px solid #000;
  margin-top: 8px;
}

.item {
  display: block;
}

.util-ml-8px {
  margin-left: 8px;
}

.button-exit {
  color: #000;
  margin-top: 8px;
}
</style>