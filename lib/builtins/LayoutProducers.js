const C = require('./Const')

registerLayoutProducer(C.ellipse, layoutEllipse)
registerLayoutProducer(C.line, layoutLine)
registerLayoutProducer(C.rect, layoutRect)
registerLayoutProducer(C.polygon, layoutPolygon)
registerLayoutProducer(C.text, layoutText)
registerLayoutProducer(C.path, layoutPath)
registerLayoutProducer(C.image, layoutImage)
registerLayoutProducer(C.shape, layoutShape)
registerLayoutProducer(C.svgFile, layoutSvgFile)

function layoutEllipse(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  let cx = colX + colWidth / 2
  let cy = rowY + rowHeight / 2

  return {
    cx,
    cy,
    width: obj.width,
    height: obj.height,

    rx: obj.width / 2,
    ry: obj.height / 2,
  }
}

function layoutLine(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  let x1 = colX + colWidth / 2 - obj.width / 2
  if (x1 < colX) {
    x1 = colX
  }

  let y1 = rowY + rowHeight / 2 - obj.height / 2
  if (y1 < rowY) {
    y1 = rowY
  }

  const vertical = (obj.height >= obj.width)

  let strokeWidth = 1

  let x2, y2
  if (vertical) {
    x1 = x1 + obj.width / 2
    x2 = x1
    y2 = y1 + obj.height
    strokeWidth = obj.width
  } else {
    y1 = y1 + obj.height / 2
    x2 = x1 + obj.width
    y2 = y1
    strokeWidth = obj.height
  }

  return {
    cx: x1 + obj.width / 2,
    cy: y1 + obj.height / 2,
    width: obj.width,
    height: obj.height,

    x1: x1,
    y1: y1,
    x2: x2,
    y2: y2,
    strokeWidth: strokeWidth,
  }
}

function layoutRect(obj, position) {
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

function layoutText(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const x = colX + colWidth / 2
  const y = rowY + rowHeight / 2

  return {
    cx: x,
    cy: y,
    width: obj.width,
    height: obj.height,
  }
}

function layoutPolygon(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  let points = []
  const xc = colX + colWidth / 2
  const yc = rowY + rowHeight / 2
  for (var coord of obj.points) {
    const x = xc + coord[0] - obj.width / 2
    const y = yc + coord[1] - obj.height / 2
    points.push({x, y})
  }

  return {
    cx: xc,
    cy: yc,
    width: null,
    height: null,
    points: points,
  }
}

function layoutPath(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const x1 = colX + colWidth / 2 - obj.width / 2
  const y1 = rowY + rowHeight / 2 - obj.height / 2

  return {
    cx: x1 + obj.width / 2,
    cy: y1 + obj.height / 2,
    width: obj.width,
    height: obj.height,
    x1,
    y1
  }
}

function layoutImage(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const x1 = colX + colWidth / 2 - obj.width / 2
  const y1 = rowY + rowHeight / 2 - obj.height / 2

  return {
    cx: x1 + obj.width / 2,
    cy: y1 + obj.height / 2,
    width: obj.width,
    height: obj.height,
    x1,
    y1,
  }
}

function layoutShape(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const {width, height} = obj.layout

  const scaleX = obj.width / width
  const scaleY = obj.height / height

  let transforms = []

  // This needs to happen after scaling, which means
  // it needs to be first on the list, as the svg
  // order of operations is right to left
  const x1 = colX + colWidth / 2 - width / 2
  const y1 = rowY + rowHeight / 2 - height / 2
  transforms.push({
    op: 'translate',
    dx: x1,
    dy: y1
  })

  if (scaleX !== 1 || scaleY !== 1) {
    // SVG chains transforms, right to left order of operations
    // For scaling:
    // 1. move the object center to 0,0
    // 2. scale it
    // 3. move the object back

    const dx = width / 2
    const dy = height / 2

    transforms.push({
      op: 'translate',
      dx,
      dy
    })
    transforms.push({
      op: 'scale',
      scaleX,
      scaleY
    })
    transforms.push({
      op: 'translate',
      dx: dx * -1,
      dy: dy * -1
    })
  }

  return {
    cx: x1 + width / 2,
    cy: y1 + height / 2,
    width,
    height,

    scaleX,
    scaleY,
    x1,
    y1,
    transforms
  }
}

function layoutSvgFile(obj, position) {
  const {colX, rowY, colWidth, rowHeight} = position

  const x1 = colX + colWidth / 2 - obj.width / 2
  const y1 = rowY + rowHeight / 2 - obj.height / 2

  return {
    cx: x1 + obj.width / 2,
    cy: y1 + obj.height / 2,
    width: obj.width,
    height: obj.height,

    x1,
    y1
  }
}
