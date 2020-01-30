const C = {
  textbox: 'textbox',
  funnybox: 'funnybox',
  nosize: 'nosize',
  nowidth: 'nowidth',
  notificationSpecParsed: 'notificationSpecParsed',
  rightAngleLine: 'right-angle-line',
}

registerParser(C.textbox, parserTextbox)
registerLayoutProducer(C.textbox, layoutTextbox)
registerRenderer(C.textbox, renderTextbox)

registerParser(C.funnybox, parserFunnybox)

registerParser(C.nosize, parserNosize)
registerRenderer(C.nosize, renderNosize)

registerParser(C.nowidth, parserNowidth)

registerParser(C.rightAngleLine, parserRightAngleLine)
registerLayoutProducer(C.rightAngleLine, layoutRightAngleLine)
registerRenderer(C.rightAngleLine, renderRightAngleLine)

addListener(C.notificationSpecParsed, specParsed)

function parserTextbox(line, inputFile, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, inputFile, 3, variables, true)

  const params = {}

  let width = settings['text-width']
  let height = settings['text-height']
  if (tokens[0] !== undefined
      && tokens[1] !== undefined
      && (!isNaN(tokens[0]) || tokens[0] === 'fill')
      && (!isNaN(tokens[1]) || tokens[1] === 'fill')) {
    width = fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), inputFile, true)
    height = fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), inputFile, true)
    let firstLineArr = contentLines[0].split(' ')
    let count = 0
    while (true) {
      // Remove the size tokens from contentLines
      let token = firstLineArr.shift()
      if (token != '') {
        count++
      }
      if (count === 2) {
        break
      }
    }
    contentLines[0] = firstLineArr.join(' ')
  }

  return {
    key,
    type: C.textbox,
    width: fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), inputFile, true),
    height: fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), inputFile, true),
    params,
    text: contentLines,
  }
}

function layoutTextbox(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const x1 = colX + colWidth / 2 - obj.width / 2
  const y1 = rowY + rowHeight / 2 - obj.height / 2

  return {
    cx: x1 + obj.width / 2,
    cy: y1 + obj.height / 2,
    width: obj.width,
    height: obj.height,

    x1: x1,
    y1: y1,
  }
}

function renderTextbox(obj, sizeAndPosition, styleBlock, svgBlock) {
  let {x1, y1, width, height} = sizeAndPosition

  let buf = `<rect x="${round(x1, 4)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" stroke-width="1" stroke="black"${styleBlock}${svgBlock}></rect>`
  buf += renderText(obj, sizeAndPosition, styleBlock, svgBlock)

  return buf
}

function renderText(obj, sizeAndPosition, styleBlock, svgBlock, context, styleData) {
  let {cx, cy, width, height} = sizeAndPosition

  const reAlignRight = /text-anchor:\s*end/
  if (reAlignRight.test(styleData)) {
    cx += width / 2
  }
  const reAlignLeft = /text-anchor:\s*start/
  if (reAlignLeft.test(styleData)) {
    cx -= width / 2
  }

  const reAlignBottom = /dominant-baseline:\s*alphabetic/
  if (reAlignBottom.test(styleData)) {
    cy += width / 2
  }
  const reAlignTop = /dominant-baseline:\s*hanging/
  if (reAlignTop.test(styleData)) {
    cy -= width / 2
  }

  // Any styles defined will override default class
  let buf = `<text x="${round(cx)}" y="${round(cy)}" ${styleBlock}>`
  const lineHeight = 1.2
  let dy = -1 * lineHeight / 2 * (obj.text.length - 1)
  for (var line of obj.text) {
    const safe = Util.htmlEntities(line.trim())
    buf += `<tspan x="${round(cx)}" dy="${dy}em">${safe}</tspan>`
    dy = lineHeight
  }
  buf += `</text>`

  return buf
}

function parserFunnybox(line, inputFile, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, inputFile, 3, variables, true)

  return {
    key,
    type: C.funnybox,
  }
}

function parserNosize(line, inputFile, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, inputFile, 3, variables, true)

  return {
    key,
    width: 1,
    type: C.nosize,
  }
}

function renderNosize(obj, sizeAndPosition, styleBlock, svgBlock) {
  let {x1, y1, width, height} = sizeAndPosition

  let buf = `<rect x="30" y="30" width="30" height="30" stroke-width="2" stroke="black"${styleBlock}${svgBlock}></rect>`

  return buf
}

function parserNowidth(line, inputFile, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, inputFile, 3, variables, true)

  return {
    key,
    height: 1,
    type: C.nosize,
  }
}


function parserRightAngleLine(line, inputFile, variables) {
  const {key, tokens} = parseKeyContent(line, inputFile, 2, variables, true)
  const params = {
    fillWidth: [0, 1],
    fillHeight: [0, 1],
  }
  return {
    key,
    type: C.rightAngleLine,
    width: 'fill',
    height: 'fill',
    params
  }
}

function layoutRightAngleLine(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const pathHeadUp = 'l 5 0 l -5 -15 l -5 15 z'
  const pathHeadDown = 'l 5 0 l -5 15 l -5 -15 z'
  const pathHeadLeft = 'l 0 5 l -15 -5 l 15 -5 z'
  const pathHeadRight = 'l 0 5 l 15 -5 l -15 -5 z'

  let pathHead

  let x1 = position.box.from.x
  let y1 = position.box.from.y
  let x2 = position.box.to.x
  let y2 = position.box.to.y

  let dx1 = 0
  let dy1 = 0
  let dx2 = 0
  let dy2 = 0

  if (position.box.to.handleV === 'bottom') {
    y2 += 16
    pathHead = pathHeadUp

    dx1 = x2 - x1
    dy2 = y2 - y1
  } else if (position.box.to.handleV === 'top') {
    y2 -= 16
    pathHead = pathHeadDown

    dx1 = x2 - x1
    dy2 = y2 - y1
  } else if (position.box.to.handleH === 'left') {
    x2 -= 16
    pathHead = pathHeadRight

    dy1 = y2 - y1
    dx2 = x2 - x1
  } else if (position.box.to.handleH === 'right') {
    x2 += 16
    pathHead = pathHeadLeft

    dy1 = y2 - y1
    dx2 = x2 - x1
  }

  let path = `m ${x1} ${y1} l ${dx1} ${dy1} l ${dx2} ${dy2}`

  pathHead = `m ${x2} ${y2} ${pathHead}`

  return {
    path,
    pathHead,
  }
}

function renderRightAngleLine(obj, sizeAndPosition, styleBlock, svgBlock) {
  const {cx, cy} = sizeAndPosition

  const x1 = cx - obj.width / 2
  const y1 = cy - obj.height / 2

  let pathHeadStyle = ` class="${obj.key}-head"`

  const pathSpec = `M ${round(x1)},${round(y1)} ${sizeAndPosition.path}`
  let buf = `<path d="${pathSpec}"${styleBlock}${svgBlock}></path>`
  const headPathSpec = `M ${round(x1)},${round(y1)} ${sizeAndPosition.pathHead}`
  buf += `<path d="${headPathSpec}"${pathHeadStyle}></path>`
  return buf
}

function specParsed(spec) {
  spec.globalStyles['.test-spec-parsed'] = `text-anchor: start;`
}
