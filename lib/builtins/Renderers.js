// path is available in scope from ParsesProducersRenderers
const fs = require('fs')

const C = require('../Const')
const Util = require('../Util')

registerRenderer(C.ellipse, renderEllipse)
registerRenderer(C.line, renderLine)
registerRenderer(C.rect, renderRect)
registerRenderer(C.polygon, renderPolygon)
registerRenderer(C.text, renderText)
registerRenderer(C.path, renderPath)
registerRenderer(C.image, renderImage)
registerRenderer(C.svgFile, renderSvgFile)
// shape is a special case and is rendered inside the SvgShapeRenderer class

function renderEllipse(obj, sizeAndPosition, styleBlock, svgBlock) {
  let {cx, cy, width, height, rx, ry} = sizeAndPosition
  return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" stroke="black"${styleBlock}${svgBlock}></ellipse>`
}

function renderLine(obj, sizeAndPosition, styleBlock, svgBlock) {
  const {x1, y1, x2, y2, strokeWidth} = sizeAndPosition
  return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="black" stroke-width="${strokeWidth}" ${styleBlock}${svgBlock}></line>`
}

function renderRect(obj, sizeAndPosition, styleBlock, svgBlock) {
  let {x1, y1, width, height} = sizeAndPosition

  return `<rect x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" stroke-width="1" stroke="black"${styleBlock}${svgBlock}></rect>`
}

function renderText(obj, sizeAndPosition, styleBlock) {
  let {x, y, verticalAlign} = sizeAndPosition

  let lineHeight = 1.2
  let dy = 0
  if (verticalAlign === 'middle') {
    dy = round(-1 * lineHeight / 2 * (obj.text.length - 1))
  } else if (verticalAlign === 'bottom') {
    dy = round(-1 * lineHeight * (obj.text.length - 1))
  }

  // Any styles defined will override default class
  let buf = `<text x="${round(x)}" y="${round(y)}"${styleBlock}>`
  for (var line of obj.text) {
    const safe = Util.htmlEntities(line.trim())
    buf += `<tspan x="${round(x)}" dy="${dy}em">${safe}</tspan>`
    dy = lineHeight
  }
  buf += `</text>`

  return buf
}

function renderPolygon(obj, sizeAndPosition, styleBlock, svgBlock) {
  const {points} = sizeAndPosition

  let buf = ''
  for (var {x, y} of points) {
    buf += ` ${round(x)},${round(y)}`
  }
  buf = buf.substring(1)

  return `<polygon points="${buf}"${styleBlock}${svgBlock}></polygon>`
}

function renderPath(obj, sizeAndPosition, styleBlock, svgBlock, context) {
  const {x1, y1} = sizeAndPosition
  const pathSpec = `M ${round(x1)},${round(y1)} ${obj.path}`
  return `<path d="${pathSpec}"${styleBlock}${svgBlock}></path>`
}

function renderImage(obj, sizeAndPosition, styleBlock, svgBlock, context, styleData, outputPath = null) {
  const {x1, y1, width, height} = sizeAndPosition
  const url = Util.relativeAbsoluteOrRemoteUrl(obj.url, context.basePath, outputPath)
  return `<image x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" href="${url}"${styleBlock}${svgBlock}></image>`
}

function renderSvgFile(obj, sizeAndPosition, styleBlock, svgBlock, context) {
  const {x1, y1, width, height} = sizeAndPosition

  const url = path.resolve(context.basePath, obj.filepath)

  let insert = `x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" ${styleBlock}${svgBlock}`

  const svg = fs.readFileSync(url, 'utf-8')

  let match = svg.match(/(<svg [^>]*)>(.*)/)

  return `${match[1]} ${insert}>${match[2]}`
}
