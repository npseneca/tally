// Renders public/icon.svg into the PNG sizes the web app manifest and iOS need.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch()
const render = async (file, size, scale = 1) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  // Maskable icons get cropped to a circle on some platforms, so shrink the artwork.
  await page.setContent(
    `<body style="margin:0;background:#F6F0E6;display:grid;place-items:center;height:100vh">
       <div style="width:${size * scale}px;height:${size * scale}px">${svg}</div></body>`,
  )
  await page.screenshot({ path: `public/${file}` })
  await page.close()
}
await render('icon-192.png', 192)
await render('icon-512.png', 512)
await render('icon-maskable-512.png', 512, 0.8)
await render('apple-touch-icon.png', 180)
await browser.close()
