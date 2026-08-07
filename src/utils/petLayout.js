// らくす君（RakusuKunPet）の配置計算。
//
// らくす君本体と、その横に開く AI ToDo パネル（AiTodoPanel）の**両方**が
// 同じ寸法を知っている必要があるため、コンポーネントの中ではなくここに置く。

/** らくす君の当たり判定。しまっている間は丸ボタンだけになる */
export const PET_SIZE = Object.freeze({ width: 132, height: 174, minimized: 52 })

/** 画面端に貼り付かないための余白（px） */
export const VIEWPORT_MARGIN = 8

/** らくす君を隠している間に出る代替の円形ボタン（AiLauncherButton）の寸法 */
export const AI_FAB_SIZE = 56

/**
 * しまっているかどうかを踏まえた現在の寸法。
 * @param {boolean} minimized
 * @returns {{width: number, height: number}}
 */
export function petBoxSize(minimized) {
  return minimized
    ? { width: PET_SIZE.minimized, height: PET_SIZE.minimized }
    : { width: PET_SIZE.width, height: PET_SIZE.height }
}

/**
 * 座標を画面内へ収める。ウィンドウを縮めても画面外へ逃げないようにするため、
 * 位置を触るたびに必ず通す。
 * @param {{x: number, y: number}} position
 * @param {{width: number, height: number}} size
 * @param {{width: number, height: number}} viewport
 * @returns {{x: number, y: number}}
 */
export function clampToViewport(position, size, viewport) {
  // レイアウト前は innerWidth/innerHeight が 0 になることがある。そのまま計算すると
  // 保存した位置を左上へ潰してしまうので、寸法が取れるまでは触らない
  if (!(viewport.width > 0) || !(viewport.height > 0)) return { x: position.x, y: position.y }

  const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - size.width - VIEWPORT_MARGIN)
  const maxY = Math.max(VIEWPORT_MARGIN, viewport.height - size.height - VIEWPORT_MARGIN)
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, position.x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, position.y), maxY),
  }
}

/**
 * 初回の立ち位置。右下だがナビや画面端の真上には乗せない。
 * @param {{width: number, height: number}} viewport
 * @returns {{x: number, y: number}}
 */
export function defaultPetPosition(viewport) {
  return {
    x: viewport.width - PET_SIZE.width - 92,
    y: viewport.height - PET_SIZE.height - VIEWPORT_MARGIN,
  }
}
