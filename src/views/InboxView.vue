<script setup>
// S-03/S-04 受信箱の3ペインレイアウト枠（P1-1・frontend.md §5）
// 各ペインの中身（RoomListItem一覧・トーク画面・ProfilePanel）は別タスクで実装する

defineProps({
  roomId: { type: String, default: null },
})
</script>

<template>
  <div class="inbox">
    <aside class="inbox__rooms">
      <!-- ルーム一覧（P1-1）: RoomListItem を並べる -->
    </aside>

    <section class="inbox__chat">
      <!-- トーク画面（B-2）: roomId で選択中のルームを表示する -->
    </section>

    <aside class="inbox__profile">
      <!-- 学生プロフィールパネル（P2-4） -->
    </aside>
  </div>
</template>

<style scoped>
.inbox {
  display: flex;
  height: 100vh;
  min-height: 0;
}

.inbox__rooms {
  flex: 0 0 360px;
  width: 360px;
  overflow-y: auto;
  border-right: 1px solid #e6e6e6;
}

.inbox__chat {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.inbox__profile {
  flex: 0 0 280px;
  width: 280px;
  overflow-y: auto;
  border-left: 1px solid #e6e6e6;
}
</style>
