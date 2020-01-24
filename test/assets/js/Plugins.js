const C = {
  textbox: 'textbox'
}

registerParser(C.textbox, parserTextbox)
registerLayoutProducer(C.textbox, layoutTextbox)
registerRenderer(C.textbox, renderTextbox)

function parserTextbox(line, inputFile, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, inputFile, 3, variables, true)

  const params = {}

  let width = settings['text-width']
  let height = settings['text-height']
  if (tokens[0] !== undefined
      && tokens[1] !== undefined
      && (!isNaN(tokens[0]) || tokens[0] === 'fill')
      && (!isNaN(tokens[1]) || tokens[1] === 'fill')) {
    width = fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true)
    height = fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true)
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
    width: fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true),
    height: fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true),
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

  let buf = `<rect x="${round(x1)}" y="${round(y1)}" width="${round(width)}" height="${round(height)}" stroke-width="1" stroke="black"${styleBlock}${svgBlock}></rect>`
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
