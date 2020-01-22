const C = require('../Const')

registerLayoutProducer(C.line, layoutLine)
registerLayoutProducer(C.polygon, layoutPolygon)
registerLayoutProducer(C.text, layoutText)
registerLayoutProducer(C.shape, layoutShape)

function layoutLine(obj, position) {
  const vertical = (obj.height >= obj.width)

  let strokeWidth
  if (vertical) {
    strokeWidth = obj.width
  } else {
    strokeWidth = obj.height
  }

  return {
    strokeWidth,
    vertical,
  }
}

function layoutText(obj, position) {
  const {colWidth, rowHeight} = position

  return {
    width: colWidth,
    height: rowHeight,
    horizontalAlign: obj.horizontalAlign,
    verticalAlign: obj.verticalAlign,
  }
}

function layoutPolygon(obj, position) {
  const {colWidth, rowHeight} = position

  return {
    width: colWidth,
    height: rowHeight,
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
  let x1 = colX + colWidth / 2 - width / 2
  let y1 = rowY + rowHeight / 2 - height / 2
  transforms.push({
    op: 'translate',
    dx: x1,
    dy: y1,
    gridAlignable: true
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
    width,
    height,

    scaleX,
    scaleY,
    transforms
  }
}
