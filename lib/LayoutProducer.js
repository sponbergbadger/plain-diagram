const Util = require('./Util')

// 1 LayoutProducer per shape
// Calls layoutLayer one at a time in sequence
// 1 diagram has default layer plus n players
//    and can have n number of shapes. Each shape
//    will have its own LayoutProducer

module.exports = class LayoutProducer {

  constructor(diagramFactory) {
    this.diagramFactory = diagramFactory

    this.elementSizeAndPositions = {}  // [layerZIndex] [key] = [array of locations]
    this.layerTransformations = {}
    this.renderingLayerZIndex
    this.defaultLayerZIndex

    const locationMakers = {}
    locationMakers['at'] = this.locationMakerAt
    locationMakers['path'] = this.locationMakerPath
    this.locationMakers = locationMakers

    this.producers = diagramFactory.getProducers()
  }

  pathDistance(layerInfo) {
    const spec = layerInfo.location
    if (spec != null && spec.from != null) {
      let {x: fromX, y: fromY} = this.getAnchorPosition(spec.from)
      let {x: toX, y: toY} = this.getAnchorPosition(spec.to)
      return this.distance(fromX, fromY, toX, toY)
    } else {
      return null
    }
  }

  pathAngle(layerInfo) {
    const spec = layerInfo.location
    if (spec != null && spec.from != null) {
      let {x: fromX, y: fromY} = this.getAnchorPosition(spec.from)
      let {x: toX, y: toY} = this.getAnchorPosition(spec.to)
      return this.angle(fromX, fromY, toX, toY)
    } else {
      return 0
    }
  }

  layoutLayer(layer, margin, layerIndex, pathAngle) {
    this.renderingLayerZIndex = layer.zIndex
    if (layerIndex === 0) {
      this.defaultLayerZIndex = layer.zIndex
    }
    const {grid, rowHeights, colWidths} = layer

    const {x: colStart, y: rowStart, width, height, rotate, distance} = this.getLocationAndSize(layer, margin)
    this.layerTransformations[layer.zIndex] = {
      rotate
    }

    let transforms = []

    if (rotate != null) {
      const {angle, x, y} = rotate
      transforms.push({
        op: 'rotate',
        degrees: angle,
        x,
        y
      })
    }
    if (layer.userRotateTo != null) {
      // This needs to be the width and height of the original un-rotated layer
      const { width, height } = this.getLayerSize(layer)

      const x = colStart
      const y = rowStart
      const dx = width / 2
      const dy = height / 2

      let rotated = pathAngle
      const rotateBy = layer.userRotateTo - rotated

      transforms.push({
        op: 'translate',
        dx: dx,
        dy: dy,
        ignoreForSizing: true
      })
      transforms.push({
        op: 'rotate',
        degrees: rotateBy,
        x,
        y
      })
      transforms.push({
        op: 'translate',
        dx: dx * -1,
        dy: dy * -1,
        ignoreForSizing: true
      })
    }

    layer.rowStart = rowStart
    layer.colStart = colStart

    let rowY = rowStart

    for (var y = 0; y < rowHeights.length; y++) {
      let colX = colStart
      const rowHeight = rowHeights[y]
      for (var x = 0; x < colWidths.length; x++) {
        const colWidth = colWidths[x]
        const obj = grid[y][x]
        if (obj !== undefined && obj.object != null) {
          // Compute box width and height considering rowspan and colspan
          let rHeight = 0;
          let cWidth = 0;
          for (var r = y; r < y + obj.rowspan; r++) {
            rHeight += rowHeights[r]
          }
          for (var c = x; c < x + obj.colspan; c++) {
            cWidth += colWidths[c]
          }

          const gridAlign = layer.grid[y][x].gridAlign
          this.layoutObject(obj, colX, rowY, cWidth, rHeight, gridAlign)
        }
        colX += colWidth
      }
      rowY += rowHeight
    }

    return {
      transforms: transforms, // for this layer
    }
  }

  getLocationAndSize(layer, margin) {
    let location = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotate: null,
      distance: null
    }
    if (layer.layerLocation == null) {
      // Default layer
      location.x = margin.left
      location.y = margin.top
      const { width, height } = this.getLayerSize(layer)
      location.width = width
      location.height = height
    } else {
      const maker = this.locationMakers[layer.layerLocation.type]
      maker.bind(this)(location, layer)
    }
    return location
  }

  getLayerSize(layer, asProjectedIntoImage, angleInDegrees) {
    asProjectedIntoImage = asProjectedIntoImage == null ? false : asProjectedIntoImage
    angleInDegrees = angleInDegrees == null ? 0 : angleInDegrees
    const {rowHeights, colWidths} = layer

    let width = 0
    let height = 0
    for (var c of colWidths) {
      width += c
    }
    for (var h of rowHeights) {
      height += h
    }

    let x1 = 0
    let y1 = 0

    if (asProjectedIntoImage) {
      x1 = layer.colStart
      y1 = layer.rowStart

      for (var i = layer.transforms.length - 1; i >= 0; i--) {
        let transform = layer.transforms[i]
        if (transform.op === 'rotate') {
          ;({x: x1, y: y1, width, height} = this.getProjectedSizesRotatingOnPoint(layer.colStart, layer.rowStart, width, height, transform.x, transform.y, transform.degrees))
        } else if (transform.op === 'translate') {
          if (!transform.ignoreForSizing) {
            let arr = this.translate([
              {x: x1, y: y1},
            ], transform.dx, transform.dy)

            x1 = arr[0].x
            y1 = arr[0].y
          }
        }
      }
    } else if (angleInDegrees !== 0) {
      // true width and height
      ;({width, height} = this.getProjectedSizesRotatingOnPoint(x1, y1, width, height, x1, y1, angleInDegrees))
    }

    let x2 = x1 + width
    let y2 = y1 + height

    return {
      x1,
      y1,
      width: x2,
      height: y2
    }
  }

  getProjectedSizesRotatingOnPoint(x, y, width, height, rx, ry, angleInDegrees) {
    let angle = this.degreesToRadians(angleInDegrees)

    let maxWidth = 0
    let maxHeight = 0
    let minWidth = 0
    let minHeight = 0
    let pts = []

    pts.push({ x: x, y: y })
    pts.push({ x: x + width, y: y })
    pts.push({ x: x + width, y: y + height })
    pts.push({ x: x, y: y + height })
    this.translate(pts, -rx, -ry)
    for (var pt of pts) {
      let {x2, y2} = this.pointAfterRotation(pt.x, pt.y, angle)
      if (x2 > maxWidth) {
        maxWidth = x2
      }
      if (y2 > maxHeight) {
        maxHeight = y2
      }
      if (x2 < minWidth) {
        minWidth = x2
      }
      if (y2 < minHeight) {
        minHeight = y2
      }
    }
    maxWidth += rx
    maxHeight += ry
    minWidth += rx
    minHeight += ry

    return {x: minWidth, y: minHeight, width: maxWidth - minWidth, height: maxHeight - minHeight}
  }

  degreesToRadians(angleInDegrees) {
    return angleInDegrees * Math.PI / 180 // in radians
  }

  translate(pointsArr, dx, dy) {
    for (var pt of pointsArr) {
      pt.x += dx
      pt.y += dy
    }
    return pointsArr
  }

  pointAfterRotation(x, y, angle) {
    let x2 = x * Math.cos(angle) - y * Math.sin(angle)
    let y2 = x * Math.sin(angle) + y * Math.cos(angle)
    return { x2, y2 }
  }

  layoutObject(spec, colX, rowY, colWidth, rowHeight, gridAlign) {
    if (spec.object == null) {
      // spacer
      return
    }

    const producer = this.producers[spec.object.type]
    let sizeAndPosition = {}
    if (producer !== undefined) {
      const position = {
        colX, rowY, colWidth, rowHeight
      }
      sizeAndPosition = producer(spec.object, position)
    }
    // Defaults
    if (sizeAndPosition.cx == null) {
      sizeAndPosition.cx = colX + colWidth / 2
    }
    if (sizeAndPosition.cy == null) {
      sizeAndPosition.cy = rowY + rowHeight / 2
    }
    if (sizeAndPosition.width == null) {
      sizeAndPosition.width = spec.object.width
    }
    if (sizeAndPosition.height == null) {
      sizeAndPosition.height = spec.object.height
    }
    sizeAndPosition.gridAlign = gridAlign
    // sizeAndPosition will have cx, cy, width, height, and some elements
    //   may have other information such as circle radius

    if (gridAlign.horizontal === 'left') {
      sizeAndPosition.cx += (-colWidth / 2 + sizeAndPosition.width / 2)
    } else if (gridAlign.horizontal === 'right') {
      sizeAndPosition.cx += (colWidth / 2 - sizeAndPosition.width / 2)
    }
    if (gridAlign.vertical === 'top') {
      sizeAndPosition.cy += (-rowHeight / 2 + sizeAndPosition.height / 2)
    } else if (gridAlign.vertical === 'bottom') {
      sizeAndPosition.cy += (rowHeight / 2 - sizeAndPosition.height / 2)
    }

    // Special case for shape
    if (sizeAndPosition.transforms != null) {
      for (var t of sizeAndPosition.transforms) {
        if (t.gridAlignable) {
           if (gridAlign.horizontal === 'left') {
             t.dx += (-colWidth / 2 + sizeAndPosition.width / 2)
           } else if (gridAlign.horizontal === 'right') {
             t.dx += (colWidth / 2 - sizeAndPosition.width / 2)
           }
           if (gridAlign.vertical === 'top') {
             t.dy += (-rowHeight / 2 + sizeAndPosition.height / 2)
           } else if (gridAlign.vertical === 'bottom') {
             t.dy += (rowHeight / 2 - sizeAndPosition.height / 2)
           }
        }
      }
    }

    // Use this information in rendering the svg later
    this.captureSizeAndPosition(spec.object.key, sizeAndPosition)
  }

  captureSizeAndPosition(key, sizeAndPosition) {
    if (this.elementSizeAndPositions[this.renderingLayerZIndex] == null) {
      this.elementSizeAndPositions[this.renderingLayerZIndex] = {}
    }
    if (this.elementSizeAndPositions[this.renderingLayerZIndex][key] == null) {
      this.elementSizeAndPositions[this.renderingLayerZIndex][key] = []
    }
    this.elementSizeAndPositions[this.renderingLayerZIndex][key].push(sizeAndPosition)
  }

  locationMakerAt(location, layer) {
    const spec = layer.layerLocation
    let {x, y, rotate} = this.getAnchorPosition(spec.at)
    const { width, height } = this.getLayerSize(layer, false, location.rotateAngle)
    ;({x, y} = this.applyLayerAlignment(spec, x, y, width, height))
    location.x = x
    location.y = y
    location.width = width
    location.height = height
    location.rotate = rotate
  }

  locationMakerPath(location, layer) {
    const spec = layer.layerLocation
    let {x: fromX, y: fromY} = this.getAnchorPosition(spec.from)
    let {x: toX, y: toY} = this.getAnchorPosition(spec.to)
    let rotateAngle = this.angle(fromX, fromY, toX, toY)
    const { width: origWidth, height: origHeight } = this.getLayerSize(layer)
    const { width, height } = this.getLayerSize(layer, false, rotateAngle)
    location.width = width
    location.height = height

    let {x: layerX, y: layerY} = this.applyLayerAlignment(spec, fromX, fromY, origWidth, origHeight)

    let {x: pathX, y: pathY} = this.getPositionOnPath(spec, fromX, fromY, toX, toY)

    let translate = {
      dx: pathX - fromX,
      dy: pathY - fromY
    }

    if (rotateAngle !== 0) {
      location.rotate = {
        angle: rotateAngle,
        x: fromX + translate.dx,
        y: fromY + translate.dy
      }
    }

    location.x = layerX + translate.dx
    location.y = layerY + translate.dy
    location.distance = this.distance(fromX, fromY, toX, toY)
  }

  getPositionOnPath(spec, fromX, fromY, toX, toY) {
    let {pathPoint, pointOffset} = spec
    let pos = {
      x: fromX,
      y: fromY
    }
    if (pathPoint === 'end') {
      pos.x = toX
      pos.y = toY
    } else if (pathPoint === 'center') {
      pos.x = (toX - fromX) / 2 + fromX
      pos.y = (toY - fromY) / 2 + fromY
    }

    if (pointOffset != null) {
      pos.y += pointOffset.y
      pos.x += pointOffset.x
    }

    return pos
  }

  getAnchorPosition(locRef) {
    const loc = this.getAnchorLocation(locRef)
    let {rotate} = this.getAnchorTransforms(locRef)
    if (rotate != null && rotate.angle === 0) {
      rotate = null
    }

    this.validateLocRef(locRef, loc)

    let rowStart = loc.cy
    let colStart = loc.cx

    if (locRef.anchorHAlign === "right") {
      colStart += loc.width / 2
    } else if (locRef.anchorHAlign === "left") {
      colStart -= loc.width / 2
    }
    if (locRef.anchorVAlign === "top") {
      rowStart -= loc.height / 2
    } else if (locRef.anchorVAlign === "bottom") {
      rowStart += loc.height / 2
    }

    if (locRef.offset != null) {
      rowStart += locRef.offset.y
      colStart += locRef.offset.x
    }

    return {
      x: colStart,
      y: rowStart,
      rotate,
    }
  }

  applyLayerAlignment(locRef, x, y, width, height) {
    y -= height / 2
    x -= width / 2
    if (locRef.hAlign === "left") {
      x += width / 2
    } else if (locRef.hAlign === "right") {
      x -= width / 2
    }
    if (locRef.vAlign === "top") {
      y += height / 2
    } else if (locRef.vAlign === "bottom") {
      y -= height / 2
    }
    x += locRef.offset.x
    y += locRef.offset.y
    return {
      x,
      y
    }
  }

  angle(cx, cy, ex, ey) {
    var dy = ey - cy;
    var dx = ex - cx;
    var theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
    return theta;
  }

  distance(x1, y1, x2, y2) {
    var a = x1 - x2;
    var b = y1 - y2;
    return Math.hypot(a, b);
  }

  getAnchorLocation(locRef) {
    let anchorKey = locRef.anchor
    let anchorIndex = locRef.anchorIndex
    let layerZIndex = locRef.layerZIndex
    if (layerZIndex == null) {
      layerZIndex = this.defaultLayerZIndex
    }

    if (locRef.next != null) {
      const loc1 = this.elementSizeAndPositions[layerZIndex][anchorKey][anchorIndex]
      const next = locRef.next

      // Calculate new cx and cy, use the next ref width and height
      let cx = loc1.cx - loc1.width / 2 + next.cx
      let cy = loc1.cy - loc1.height / 2 + next.cy
      return {
        cx,
        cy,
        width: next.width,
        height: next.height
      }
    } else {
      return this.elementSizeAndPositions[layerZIndex][anchorKey][anchorIndex]
    }
  }

  getAnchorTransforms(locRef) {
    if (locRef.layerZIndex != null) {
      return this.layerTransformations[locRef.layerZIndex]
    } else {
      return {
        rotate: null
      }
    }
  }

  validateLocRef(locRef, loc) {
    if (locRef.anchorHAlign !== "center" && loc.width == null) {
      throw new Error(`HAlign not supported on anchor: ${locRef.anchor}`)
    }
    if (locRef.anchorVAlign !== "middle" && loc.height == null) {
      throw new Error(`VAlign not supported on anchor: ${locRef.anchor}`)
    }
  }

  getShapeSize(layers, margin) {
    let maxWidth = 0
    let maxHeight = 0
    let minX = margin.left
    let minY = margin.top
    for (var layer of layers) {
      const { x1, y1, width, height} = this.getLayerSize(layer, true)

      if (width > maxWidth) {
        maxWidth = width
      }
      if (height > maxHeight) {
        maxHeight = height
      }

      if (x1 < minX) {
        minX = x1
      }
      if (y1 < minY) {
        minY = y1
      }
    }

    // If the shape extends into negative space, relative to the left and top margin
    // adjust the width, height, and x1,y1 used by the viewbox
    let negSpaceX = 0
    let negSpaceY = 0
    if (minX < margin.left) {
      negSpaceX = (margin.left - minX)
    }
    if (minY < margin.top) {
      negSpaceY = (margin.top - minY)
    }

    return {
      // margin left and top already accounted for in layer width and height
      negSpaceX,
      negSpaceY,
      width: maxWidth + margin.right,
      height: maxHeight + margin.bottom,
      defaultLayerZIndex: this.defaultLayerZIndex
    }
  }

}
