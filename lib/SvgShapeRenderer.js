const path = require('path')

const Util = require('./Util')

const zeroMargin = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
}

const defaultDebug = {
  showGrid: false
}

module.exports = class SvgShapeRenderer {

  constructor(context, styles, outputPath) {
    this.context = context
    this.styles = styles
    this.outputPath = outputPath
    this.layerTransformations = {}
    this.renderingLayerZIndex
    this.defaultLayerZIndex
    this.debugGrid

    this.initRenderers(context.renderers)
    this.initLocationMakers()
  }

  renderShapeToSvg(shape, diagramShape = false, debug) {
    this.defaultLayerZIndex = shape.layers[0].zIndex
    let layerZIndexes = {}

    for (var layer of shape.layers) {
      const e = shape.elementSizeAndPositions[layer.zIndex]
      this.renderingLayerZIndex = layer.zIndex
      let {buf, transforms} = this.renderLayer(layer, shape.margin, this.context, diagramShape, e, debug)
      layerZIndexes[layer.zIndex] = {
        layer,
        buf,
        transforms
      }
    }

    let buf = ''

    if (this.debugGrid != null) {
      buf += `<g>${this.debugGrid}</g>`
    }

    const keys = Object.keys(layerZIndexes).sort(byInt)
    for (var key of keys) {
      const layerBuf = layerZIndexes[key].buf
      const transforms = layerZIndexes[key].transforms
      const svgBuf = this.svgWithVariablesFilled(layerZIndexes[key].layer)
      const svg = (svgBuf == null) ? '' : ' ' + svgBuf
      buf += `<g${transforms}${svg}>${layerBuf}</g>`
    }

    return {
      renderedData: buf,
    }
  }

  svgWithVariablesFilled(layer) {
    let svg = layer.svg
    if (svg == null) {
      return null
    }
    svg = svg.replace(/\$x/g, layer.colStart)
    svg = svg.replace(/\$y/g, layer.rowStart)
    return svg
  }

  renderLayer(layer, margin, context, diagramShape, e, debug = defaultDebug) {
    const {grid, rowHeights, colWidths} = layer
    const makeDebugGrid = debug.showGrid == true
                          && layer.index === 0
                          && diagramShape

    this.indexes = {}

    let buf = ''

    if (makeDebugGrid) {
      const {rowStart, colStart, rowHeights, colWidths} = layer
      this.debugGrid = makeTestGrid(rowStart, colStart, rowHeights, colWidths, diagramShape)
    }

    // HSTDBC iterate over e intead of grid
    for (var y = 0; y < rowHeights.length; y++) {
      for (var x = 0; x < colWidths.length; x++) {
        const obj = grid[y][x]
        if (obj !== undefined && obj.object !== undefined) {
          buf += this.renderObject(obj, context, e)
        }
      }
    }

    let transforms = makeSvgTransforms(layer.transforms)

    return {
      buf,
      transforms
    }
  }

  renderObject(spec, context, e) {
    if (spec.object == null) {
      // spacer
      return ''
    }
    const renderer = this.renderers[spec.object.type]
    if (renderer === undefined) {
      throw new Error(`Unknown renderer ${spec.object.type}`)
    }

    let index = this.indexes[spec.object.key]
    if (index == null) {
      index = -1
    }
    index++
    this.indexes[spec.object.key] = index

    const {styleBlock, styleData} = this.makeStyleBlock(spec.object)
    const svgBlock = this.makeSvgBlock(spec.object)
    const sizeAndPosition = e[spec.object.key][index]
    return renderer.bind(this)(spec.object,
      sizeAndPosition,
      styleBlock,
      svgBlock,
      context,
      styleData,
      this.outputPath)
  }

  makeStyleBlock(obj) {
    let styleBlock = ''
    let styleData = ''
    const style = this.styles[obj.key]
    if (style != null) {
      styleBlock = ` class="${style.name}"`
      styleData = this.getStyleDataForClass(style.name)
      if (style.plus != null && style.plus.length > 0) {
        styleBlock += ` style="${style.plus}"`
        styleData += '; ' + style.plus
      }
    }
    return {
      styleBlock,
      styleData
    }
  }

  getStyleDataForClass(c) {
    for (var key of Object.keys(this.styles)) {
      const i = this.styles[key]
      if (i.name === c && i.val != null) {
        return i.val
      }
    }
    return ''
  }

  makeSvgBlock(obj) {
    let block = ''
    if (obj.svg !== undefined) {
      block = ` ${obj.svg}`
    }
    return block
  }

  initRenderers(renderers) {
    this.renderers = renderers
    this.renderers['shape'] = this.renderShape
  }

  initLocationMakers() {
    this.locationMakers = {}
    this.locationMakers['at'] = this.locationMakerAt
    this.locationMakers['path'] = this.locationMakerPath
  }

  renderShape(obj, sizeAndPosition, styleBlock, svgBlock) {
    const {cx, cy, width, height, x1, y1, scaleX, scaleY, transforms} = sizeAndPosition

    const shapeRenderer = new SvgShapeRenderer(this.context, this.styles)
    const {renderedData} = shapeRenderer.renderShapeToSvg({
      layers: obj.layout.layers,
      elementSizeAndPositions: obj.layout.elementSizeAndPositions,
      margin: zeroMargin
    })

    let transformBuf = makeSvgTransforms(transforms)

    let buf = ''
    buf += `<g${transformBuf}>`
    buf += renderedData
    buf += '</g>'

    return buf
  }

}

function round(v) {
  return Math.round(v * 1000) / 1000
}

function makeSvgTransforms(transforms) {
  let buf = ''
  for (var t of transforms) {
    if (t.op === 'rotate') {
      buf += ` rotate(${round(t.degrees)} ${round(t.x)} ${round(t.y)})`
    } else if (t.op === 'translate') {
      buf += ` translate(${round(t.dx)} ${round(t.dy)})`
    } else if (t.op === 'scale') {
      buf += ` scale(${round(t.scaleX)} ${round(t.scaleY)})`
    } else {
      throw new Error(`Unsupported transform: ${t}`)
    }
  }
  buf = buf.trim()
  if (buf !== '') {
    buf = ` transform="${buf}"`
  }
  return buf
}

function byInt(a, b) {
  return parseInt(a) - parseInt(b)
}

function makeTestGrid(rowStart, colStart, rowHeights, colWidths, diagramShape) {
  let buf=''

  let rowY = rowStart

  let colors = ['white', 'lightblue']
  if (!diagramShape) {
    colors = ['lightgray', 'lightpink']
  }

  let color
  for (var y = 0; y < rowHeights.length; y++) {
    let colX = colStart
    const rowHeight = rowHeights[y]
    for (var x = 0; x < colWidths.length; x++) {
      const colWidth = colWidths[x]
      color = colors[(y + x) % 2]
      buf += `<rect style="fill: ${color};" x="${colX}" y="${rowY}" width="${colWidth}" height="${rowHeight}"></rect>`
      colX += colWidth
    }
    rowY += rowHeight
  }

  return buf
}
