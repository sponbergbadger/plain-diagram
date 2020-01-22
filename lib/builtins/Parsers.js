const C = require('../Const')

registerParser(C.circle, parserCircle)
registerParser(C.ellipse, parserEllipse)
registerParser(C.line, parserLine)
registerParser(C.rect, parserRect)
registerParser(C.polygon, parserPolygon)
registerParser(C.text, parserText)
registerParser(C.path, parserPath)
registerParser(C.image, parserImage)
registerParser(C.shape, parserShape)

addListener(C.notificationSpecParsed, specParsed)

function parserCircle(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 1, variables)
  const r = fillOrFloat(tokens[0])
  return {
    key: key,
    type: C.ellipse,
    width: r * 2,
    height: r * 2,
  }
}

function parserEllipse(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 2, variables)
  const params = {}
  const rx = fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true)
  let width
  if (rx === 'fill') {
    width = 'fill'
  } else {
    width = rx * 2
  }
  const ry = fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true)
  let height
  if (ry === 'fill') {
    height = 'fill'
  } else {
    height = ry * 2
  }
  return {
    key,
    type: C.ellipse,
    width,
    height,
    params,
  }
}

function parserLine(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 2, variables, true)
  const params = {}
  return {
    key,
    type: C.line,
    width: fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true),
    height: fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true),
    params
  }
}

function parserRect(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 2, variables, true)
  const params = {}
  return {
    key,
    type: C.rect,
    width: fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true),
    height: fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true),
    params
  }
}

function parserText(line, rem, variables, settings) {
  const {key, tokens, contentLines, content} = parseKeyContent(line, rem, 3, variables)

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
    type: C.text,
    width: width,
    height: height,
    params,
    text: contentLines,
  }
}

function parserPolygon(line, rem, variables) {
  const {key, tokens, content} = parseKeyContent(line, rem, 0, variables)

  let points = []
  let maxX = 0
  let maxY = 0
  for (var coord of content.split(/[ \t]+/)) {
    let ca = coord.split(',')
    ca[0] = parseFloat(ca[0])
    ca[1] = parseFloat(ca[1])
    if (isNaN(ca[0]) || isNaN(ca[1])) {
      throw new Error(`Invalid coords for: ${line}`)
    }
    points.push(ca)
    if (ca[0] > maxX) {
      maxX = ca[0]
    }
    if (ca[1] > maxY) {
      maxY = ca[1]
    }
  }

  const width = maxX
  const height = maxY

  return {
    key,
    type: C.polygon,
    width,
    height,
    points,
  }
}

function parserPath(line, rem, variables) {
  const {key, tokens, content} = parseKeyContent(line, rem, 2, variables)

  const params = {}
  const width = fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true)
  const height = fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true)

  return {
    key,
    type: C.path,
    width,
    height,
    path: content,
    params
  }
}

function parserImage(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 3, variables)
  const params = {}
  return {
    key,
    type: C.image,
    width: fillOrFloat(Util.extractParams(tokens[0], params, 'fillWidth'), true),
    height: fillOrFloat(Util.extractParams(tokens[1], params, 'fillHeight'), true),
    url: tokens[2],
    params
  }
}

function parserShape(line, rem, variables) {
  const {key, tokens} = parseKeyContent(line, rem, 3, variables, true)
  const params = {}
  const shape = Util.extractParams(tokens[0], params, 'shape')
  return {
    key,
    type: C.shape,
    shape: shape,
    width: fillOrFloat(Util.extractParams(tokens[1], params, 'fillWidth'), true, null),
    height: fillOrFloat(Util.extractParams(tokens[2], params, 'fillHeight'), true, null),
    params,
    layout: null, // Will be filled in by the ShapeParser
  }
}

function specParsed(spec) {
  // Text align is controlled by the style
  //   text-anchor for left, center, right
  //   dominant-baseline for top, middle, bottom
  // Style might not be parsed until after the first pass on parsing element types
  const {elements, styles, defaultStyles} = spec
  for (var key of Object.keys(elements)) {
    let ele = elements[key]
    if (ele.type === C.text) {
      setTextAlign(ele, styles, defaultStyles)
    }
  }
}

function setTextAlign(text, styles, defaultStyles) {
  let style = styles[text.key]

  let styleData = ''
  if (style != null) {
    if (style.val == null) {
      styleData = styles[style.name].val + '; ' + style.plus
    } else {
      styleData = style.val
    }
  }

  let verticalAlign = 'middle'
  let horizontalAlign = 'center'

  if (styleData.indexOf('dominant-baseline:') === -1) {
    // Element's style doesn't provide dominant-baseline, take the default
    const reHAlign = /dominant-baseline:\s*([a-zA-Z]+)[^a-zA-Z]*/
    const hMatch = defaultStyles.text.match(reHAlign)
    if (hMatch != null) {
      styleData += '; dominant-baseline: ' + hMatch[1]
    }
  }

  if (styleData.indexOf('text-anchor:') === -1) {
    // Element's style doesn't provide text-anchor, take the default
    const reHAlign = /text-anchor:\s*([a-zA-Z]+)[^a-zA-Z]*/
    const hMatch = defaultStyles.text.match(reHAlign)
    if (hMatch != null) {
      styleData += '; text-anchor: ' + hMatch[1]
    }
  }

  const reAlignRight = /text-anchor:\s*end/
  if (reAlignRight.test(styleData)) {
    horizontalAlign = 'right'
  }
  const reAlignLeft = /text-anchor:\s*start/
  if (reAlignLeft.test(styleData)) {
    horizontalAlign = 'left'
  }

  let valign = 'middle'
  const reAlignBottom = /dominant-baseline:\s*alphabetic/
  if (reAlignBottom.test(styleData)) {
    verticalAlign = 'bottom'
  }
  const reAlignTop = /dominant-baseline:\s*hanging/
  if (reAlignTop.test(styleData)) {
    verticalAlign = 'top'
  }

  text.horizontalAlign = horizontalAlign
  text.verticalAlign = verticalAlign
}
