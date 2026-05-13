const OUTPUT_SIZE = 600
const JPEG_QUALITY = 0.9

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'))
    img.src = src
  })
}

export async function getCroppedImg(imageSrc, pixelCrop) {
  if (!imageSrc || !pixelCrop) throw new Error('Нет данных для обрезки')

  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas не поддерживается')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  )

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}
