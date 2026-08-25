// Center-crops to a square and downsizes before it ever becomes a data URL —
// profile pictures get read constantly (sidebar, deal cards, public
// profile), and Firestore documents cap out at 1 MiB, so an unresized photo
// stored as-is would be both slow and risky. A compressed 256x256 JPEG is
// usually tens of KB, nowhere near that limit.
export function resizeImageToDataUrl(file, size = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
