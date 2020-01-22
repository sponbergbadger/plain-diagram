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
  let {cx, cy, width, height} = sizeAndPosition
  let rx = obj.width / 2
  let ry = obj.height / 2
  return `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" stroke="black"${styleBlock}${svgBlock}></ellipse>`
}

function renderLine(obj, sizeAndPosition, styleBlock, svgBlock) {
  const {cx, cy, strokeWidth, vertical} = sizeAndPosition

  let x1 = cx - obj.width / 2
  let y1 = cy - obj.height / 2

  let x2, y2
  if (vertical) {
    x1 = x1 + obj.width / 2
    x2 = x1
    y2 = y1 + obj.height
  } else {
    y1 = y1 + obj.height / 2
    x2 = x1 + obj.width
    y2 = y1
  }

  return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="black" stroke-width="${strokeWidth}" ${styleBlock}${svgBlock}></line>`
}

function renderRect(obj, sizeAndPosition, styleBlock, svgBlock) {
  let {cx, cy, width, height} = sizeAndPosition

  const x1 = cx - width / 2
  const y1 = cy - height / 2

  return `<rect x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" stroke-width="1" stroke="black"${styleBlock}${svgBlock}></rect>`
}

function renderText(obj, sizeAndPosition, styleBlock) {
  let {cx, cy, width, height} = sizeAndPosition

  let x = cx
  let y = cy
  if (sizeAndPosition.gridAlign.horizontal === 'left') {
    x -= width / 2
  } else if (sizeAndPosition.gridAlign.horizontal === 'right') {
    x += width / 2
  }
  if (sizeAndPosition.gridAlign.vertical === 'top') {
    y -= height / 2
  } else if (sizeAndPosition.gridAlign.vertical === 'bottom') {
    y += height / 2
  }

  let lineHeight = 1.2
  let dy = 0
  if (sizeAndPosition.gridAlign.vertical === 'middle') {
    dy = round(-1 * lineHeight / 2 * (obj.text.length - 1))
  } else if (sizeAndPosition.gridAlign.vertical === 'bottom') {
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
  const {cx, cy} = sizeAndPosition

  let points = []
  for (var coord of obj.points) {
    const x = cx + coord[0] - obj.width / 2
    const y = cy + coord[1] - obj.height / 2
    points.push({x, y})
  }

  let buf = ''
  for (var {x, y} of points) {
    buf += ` ${round(x)},${round(y)}`
  }
  buf = buf.substring(1)

  return `<polygon points="${buf}"${styleBlock}${svgBlock}></polygon>`
}

function renderPath(obj, sizeAndPosition, styleBlock, svgBlock, context) {
  const {cx, cy} = sizeAndPosition

  const x1 = cx - obj.width / 2
  const y1 = cy - obj.height / 2

  const pathSpec = `M ${round(x1)},${round(y1)} ${obj.path}`
  return `<path d="${pathSpec}"${styleBlock}${svgBlock}></path>`
}

function renderImage(obj, sizeAndPosition, styleBlock, svgBlock, context, styleData, outputPath = null) {
  const {cx, cy, width, height} = sizeAndPosition

  const x1 = cx - obj.width / 2
  const y1 = cy - obj.height / 2

  const url = Util.relativeAbsoluteOrRemoteUrl(obj.url, context.basePath, outputPath)
  return `<image x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" href="${url}"${styleBlock}${svgBlock}></image>`
}

function renderSvgFile(obj, sizeAndPosition, styleBlock, svgBlock, context) {
  const {cx, cy, width, height} = sizeAndPosition

  const x1 = cx - obj.width / 2
  const y1 = cy - obj.height / 2

  const url = path.resolve(context.basePath, obj.filepath)

  let insert = `x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" ${styleBlock}${svgBlock}`

  const svg = fs.readFileSync(url, 'utf-8')

  let match = svg.match(/(<svg [^>]*)>(.*)/)

  return `${match[1]} ${insert}>${match[2]}`
}
