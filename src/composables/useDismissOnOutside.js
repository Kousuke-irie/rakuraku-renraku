import { onBeforeUnmount, watch } from 'vue'

/**
 * ポップアップを「外側クリック」と Escape で閉じる共通処理。
 *
 * 開いている間だけ document へ購読するので、閉じているメニューが
 * 画面中のクリックを拾い続けることがない。
 *
 * ポップアップ側は**ルート要素で click の伝播を止める**こと。
 * 止めないと、開いた直後に自分自身のクリックで閉じてしまう。
 *
 *   const isMenuOpen = computed(() => openMenuKey.value === props.filterKey)
 *   useDismissOnOutside(isMenuOpen, closeMenu)
 *
 * @param {import('vue').Ref<boolean>|import('vue').ComputedRef<boolean>} isOpen 開閉状態
 * @param {() => void} dismiss 閉じる処理
 */
export function useDismissOnOutside(isOpen, dismiss) {
  const onClick = () => dismiss()
  const onKeydown = (event) => {
    if (event.key === 'Escape') dismiss()
  }

  const unbind = () => {
    document.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onKeydown)
  }

  watch(isOpen, (open) => {
    if (!open) {
      unbind()
      return
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(unbind)
}

export default useDismissOnOutside
