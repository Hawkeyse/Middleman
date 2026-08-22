import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const src = 'src/assets/middleman-logo-source.png'
const brandBlue = '#1c3fd6'

mkdirSync('public/icons', { recursive: true })

const transparentSizes = [16, 32, 48, 64, 96]
const solidSizes = { 'apple-touch-icon': 180, 'android-chrome-192x192': 192, 'android-chrome-512x512': 512 }

// Builds a modern (Vista+) .ico that embeds raw PNG frames directly — no extra deps needed.
function buildIco(pngBuffers) {
  const count = pngBuffers.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dirEntries = []
  const imageData = []
  let offset = 6 + count * 16

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    dirEntries.push(entry)
    imageData.push(buffer)
    offset += buffer.length
  }

  return Buffer.concat([header, ...dirEntries, ...imageData])
}

async function run() {
  for (const size of transparentSizes) {
    await sharp(src).resize(size, size).png().toFile(`public/icons/favicon-${size}x${size}.png`)
  }

  for (const [name, size] of Object.entries(solidSizes)) {
    await sharp(src)
      .resize(size, size)
      .flatten({ background: brandBlue })
      .png()
      .toFile(`public/icons/${name}.png`)
  }

  const icoSizes = [16, 32, 48]
  const pngBuffers = []
  for (const size of icoSizes) {
    const buffer = await sharp(src).resize(size, size).png().toBuffer()
    pngBuffers.push({ size, buffer })
  }
  writeFileSync('public/favicon.ico', buildIco(pngBuffers))

  await sharp(src).resize(512, 512).png({ compressionLevel: 9, palette: true }).toFile('public/middleman-logo.png')

  console.log('icons generated')
}

run()
