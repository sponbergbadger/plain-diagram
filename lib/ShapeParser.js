const path = require('path')

const NumberedLines = require('./NumberedLines')
const Util = require('./Util')

const reLayerWidthMatch = /\$l:(\d+):width/
const reLayerHeightMatch = /\$l:(\d+):height/

const zeroMargin = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
}

module.exports = class ShapeParser {

  constructor(diagramParser, margin = zeroMargin) {
    this.diagramParser = diagramParser

    this.layers = []             // Keep track of layers as they are added in file
                                 // This order is important because later layers will reference positions
                                 // of earlier layers, but may be rendered at a lower z index
    this.layersByIndex = {}      // Specifically indexed layers
    this.layersByZIndex = {}     // Specifically indexed layers

    this.elements = diagramParser.elements
    this.shapeLayouts = diagramParser.shapeLayouts
    this.shapeRenderer = diagramParser.shapeRenderer
    this.styles = diagramParser.styles
    this.settings = diagramParser.settings
    this.gridAlign = diagramParser.gridAlign
    this.margin = margin

    this.layoutProducer = diagramParser.diagramFactory.newLayoutProducer()
  }

  parseLayout(inputFile, params = {}, settings = this.settings, fillToWidth = null, fillToHeight = null, parentPathAngle = 0) {
    const layersToParse = this.parseLayoutLines(inputFile)

    this.makeLayerIndexToZIndexMap(layersToParse)

    this.addLayers(layersToParse, params, settings, fillToWidth, fillToHeight, parentPathAngle)

    const {negSpaceX, negSpaceY, width, height, defaultLayerZIndex} = this.layoutProducer.getShapeSize(this.layers, this.margin)

    return {
      layers: this.layers,
      elementSizeAndPositions: this.layoutProducer.elementSizeAndPositions,
      negSpaceX,
      negSpaceY,
      width,
      height,
      defaultLayerZIndex
    }
  }

  parseLayoutLines(inputFile) {
    const layersToParse = []

    let layoutLineDesc = null
    let layoutLines = []
    let newLayer = true
    let line
    while ((line = inputFile.pop()) != null) {
      let skipThisLine = false
      if (newLayer && line.string.trim() === '') {
        skipThisLine = true
      }
      newLayer = false
      if (skipThisLine) {
        continue
      }

      if (line.string.trim().startsWith('*')) {
        // Close out the existing layer
        layersToParse.push({
          layoutLineDesc,
          layoutLines
        })

        // New layer
        layoutLines = []
        layoutLineDesc = line
        newLayer = true
      } else {
        layoutLines.push(line)
      }
    }
    if (layoutLines.length > 0) {
      // Close out the last layer
      layersToParse.push({
        layoutLineDesc,
        layoutLines
      })
    }

    return layersToParse
  }

  addLayers(layersToParse, params, settings, fillToWidth, fillToHeight, parentPathAngle) {
    let layerInfo = {
      zIndex: null,
      location: null
    }

    for (var i = 0; i < layersToParse.length; i++) {
      const {layoutLineDesc, layoutLines} = layersToParse[i]
      let layerInfo = this.parseLayerInfo(layoutLineDesc, params)
      layerInfo.index = i
      layerInfo.zIndex = this.layerIndexToZIndexMap[i]

      let pathDistance = this.layoutProducer.pathDistance(layerInfo)
      let pathAngle = this.layoutProducer.pathAngle(layerInfo)
      pathAngle += parentPathAngle

      let fillTo = {
        width: null,
        height: null
      }
      if (i === 0) {
        // Only the default layer can take the fillTo
        fillTo.width = fillToWidth
        fillTo.height = fillToHeight
      }
      this.addLayer(layoutLines, layerInfo, params, settings, pathDistance, pathAngle, fillTo)
    }
  }

  makeLayerIndexToZIndexMap(layersToParse) {
    // Layers without a zIndex
    //   - Will take available index in order starting from 1
    //   - Can't index into these layers
    //   - The first entry is the *default layer*
    //   - Referring to objects in unnamed layer goes to the default layer
    const layersWithoutZIndex = []
    const layerIndexToZIndexMap = {}
    const zIndexToLayerIndex = {}
    const reZ = /^\*:(\d+)\s/
    layersWithoutZIndex.push(0)
    for (var i = 1; i < layersToParse.length; i++) {
      const lineDesc = layersToParse[i].layoutLineDesc
      const lineDescString = lineDesc.string.trim()
      const match = lineDescString.match(reZ)
      if (match != null) {
        const zIndex = match[1]
        layerIndexToZIndexMap[i] = zIndex
        if (zIndexToLayerIndex[zIndex] != null) {
          lineDesc.userError(`Layer at z-index ${zIndex} already exists`)
        }
        zIndexToLayerIndex[zIndex] = i
      } else {
        layersWithoutZIndex.push(i)
      }
    }

    // Assign zIndex to non indexed layers
    var zIndex = 1 // File Z Index is 1 based
    for (var layerIndex of layersWithoutZIndex) {
      while (zIndexToLayerIndex[zIndex] !== undefined) {
        zIndex++
      }
      layerIndexToZIndexMap[layerIndex] = zIndex
      zIndex++
    }

    this.layerIndexToZIndexMap = layerIndexToZIndexMap
  }

  addLayer(layoutLines, layerInfo, params, settings, pathDistance, pathAngle, fillTo) {
    if (layoutLines[layoutLines.length - 1].string.trim().length === 0) {
      // Drop the last row, but not more. More rows equals more space
      layoutLines.pop()
    }
    this.trimPrecedingWhiteSpace(layoutLines)
    const colGraph = this.findColumnGraph(layoutLines)
    const layer = this.makeGrid(layoutLines, colGraph, params, settings, pathDistance, pathAngle, fillTo, layerInfo.userFillTo)
    this.layers.push(layer)

    if (layerInfo.index === 0) {
      // The author made an error if any of the colWidths or rowHeights are zero on the default layer
      this.assertNonZeroWidthAndHeight(layer.colWidths, layer.rowHeights, layoutLines)
    }

    layer.index = layerInfo.index
    layer.zIndex = layerInfo.zIndex
    layer.layerLocation = layerInfo.location
    layer.userFillTo = layerInfo.userFillTo
    layer.userRotateTo = layerInfo.userRotateTo
    layer.svg = layerInfo.svg

    this.layersByIndex[layer.index] = layer
    this.layersByZIndex[layer.zIndex] = layer

    let margin
    if (layer.index === 0) {
      // Default Layer gets the diagram margin
      margin = this.margin
    } else {
      margin = zeroMargin
    }

    const { transforms } = this.layoutProducer.layoutLayer(layer, margin, layer.index, pathAngle)
    layer.transforms = transforms
  }

  parseLayerInfo(line, params) {
    if (line == null) {
      return {
        location: null,
        userFillTo: {
          width: null,
          height: null
        }
      }
    }

    const layerInfo = {}

    let info = this.getLayerInfoUsingAt(line, params)
    if (info == null) {
      info = this.getLayerInfoUsingFromTo(line)
    }
    if (info == null) {
      line.userError(`Invalid layer definition`)
    }

    layerInfo.location = info.location
    layerInfo.userFillTo = info.userFillTo
    layerInfo.userRotateTo = info.userRotateTo
    layerInfo.svg = info.svg

    return layerInfo
  }

  getLayerInfoUsingAt(inputLine, params) {
    const {svg, rotateTo, fillTo} = parseOutSvgFillRotate(inputLine)

    const re = /at ((\S*?)( of ))*(\S+)( with my (\S*))*( plus (-*[\.\d\$a-zA-Z]+?,-*[\.\d$a-zA-Z]+))*/
    let match = inputLine.string.match(re)
    if (match == null) {
      return null
    }

    let layerInfo = {}

    let anchorAligns = []
    if (match[2] != null) {
      anchorAligns = match[2].split('-')
    }

    let layerAligns = []
    if (match[6] != null) {
      layerAligns = match[6].split('-')
    }

    const anchor = match[4]

    let offset = this.resolveOffset(match[8], params, inputLine)

    let {anchorKey, anchorIndex, layerZIndex, next} = this.resolveAnchorRef(match[4], params, inputLine)

    layerInfo.location = {
      type: 'at',
      at: {
        anchor: anchorKey,
        anchorIndex,
        layerZIndex,
        next,
        anchorVAlign: this.arrayIncludesDefaultOrOneOf(anchorAligns, 'middle', 'top', 'bottom'),
        anchorHAlign: this.arrayIncludesDefaultOrOneOf(anchorAligns, 'center', 'left', 'right'),
      },
      vAlign: this.arrayIncludesDefaultOrOneOf(layerAligns, 'middle', 'top', 'bottom'),
      hAlign: this.arrayIncludesDefaultOrOneOf(layerAligns, 'center', 'left', 'right'),
      offset
    }
    layerInfo.userFillTo = fillTo
    layerInfo.userRotateTo = rotateTo
    layerInfo.svg = svg

    return layerInfo
  }

  getLayerInfoUsingFromTo(inputLine, params) {
    const {svg, rotateTo, fillTo, mode} = parseOutSvgFillRotate(inputLine)

    const re = /from ((\S*?)( of ))*(\S+)( plus (-*[\.\d\$a-zA-Z]+?,-*[\.\d\$a-zA-Z]+))* to ((\S*?)( of ))*(\S+)( plus (-*[\.\d\$a-zA-Z]+?,-*[\.\d\$a-zA-Z]+))*( on (\S+) point)*( plus (-*[\.\d\$a-zA-Z]+?,-*[\.\d\$a-zA-Z]+))*( with my (\S*))*( plus (-*[\.\d\$a-zA-Z]+?,-*[\.\d\$a-zA-Z]+))*/

    let match = inputLine.string.match(re)
    if (match == null) {
      return null
    }

    let layerInfo = {}

    let fromAnchorAligns = []
    if (match[2] != null) {
      fromAnchorAligns = match[2].split('-')
    }

    let toAnchorAligns = []
    if (match[8] != null) {
      toAnchorAligns = match[8].split('-')
    }

    let layerAligns = []
    if (match[18] != null) {
      layerAligns = match[18].split('-')
    }

    let fromOffset = this.resolveOffset(match[6], params, inputLine)
    let toOffset = this.resolveOffset(match[12], params, inputLine)
    let pointOffset = this.resolveOffset(match[16], params, inputLine)
    let layerOffset = this.resolveOffset(match[20], params, inputLine)

    let pathPoint = match[14]

    let fromRef = this.resolveAnchorRef(match[4], null, inputLine)
    let toRef = this.resolveAnchorRef(match[10], null, inputLine)

    layerInfo.location = {
      type: 'path',
      mode: mode,
      from: {
        anchor: fromRef.anchorKey,
        anchorIndex: fromRef.anchorIndex,
        layerZIndex: fromRef.layerZIndex,
        next: fromRef.next,
        anchorVAlign: this.arrayIncludesDefaultOrOneOf(fromAnchorAligns, 'middle', 'top', 'bottom'),
        anchorHAlign: this.arrayIncludesDefaultOrOneOf(fromAnchorAligns, 'center', 'left', 'right'),
        offset: fromOffset,
      },
      to: {
        anchor: toRef.anchorKey,
        anchorIndex: toRef.anchorIndex,
        layerZIndex: toRef.layerZIndex,
        next: toRef.next,
        anchorVAlign: this.arrayIncludesDefaultOrOneOf(toAnchorAligns, 'middle', 'top', 'bottom'),
        anchorHAlign: this.arrayIncludesDefaultOrOneOf(toAnchorAligns, 'center', 'left', 'right'),
        offset: toOffset,
      },
      pathPoint: this.arrayIncludesDefaultOrOneOf(pathPoint, 'center', 'start', 'end'),
      pointOffset: pointOffset,
      vAlign: this.arrayIncludesDefaultOrOneOf(layerAligns, 'middle', 'top', 'bottom'),
      hAlign: this.arrayIncludesDefaultOrOneOf(layerAligns, 'center', 'left', 'right'),
      offset: layerOffset,
    }
    layerInfo.userFillTo = fillTo
    layerInfo.userRotateTo = rotateTo
    layerInfo.svg = svg

    return layerInfo
  }

  resolveOffset(str, params = {}, line) {
    let offset = {
      x: 0,
      y: 0
    }
    if (str != null) {
      let ca = str.split(',')
      if (ca[0].startsWith('$')) {
        ca[0] = params[ca[0].substring(1)]
      }
      ca[0] = parseFloat(ca[0])
      if (isNaN(ca[0])) {
        line.userError(`Invalid coords: ${str}`)
      }
      offset.x = ca[0]
      if (ca[1].startsWith('$')) {
        ca[1] = params[ca[1].substring(1)]
      }
      ca[1] = parseFloat(ca[1])
      if (isNaN(ca[1])) {
        line.userError(`Invalid coords: ${str}`)
      }
      offset.y = ca[1]
    }
    return offset
  }

  resolveAnchorRef(anchor, params = {}, inputLine) {
    let {layerZIndex, anchorKey, anchorIndex, nextAnchor} = this.splitAnchorKey(anchor)

    if (anchorKey.startsWith('$')) {
      const paramName = anchorKey.substring(1)
      anchorKey = params[paramName]
    }

    let next
    if (nextAnchor != null) {
      let refA
      if (layerZIndex == null) {
        // Search the default layer only
        refA = this.layersByIndex[0].layerObjectMap[anchorKey]
      } else {
        refA = this.layersByZIndex[layerZIndex].layerObjectMap[anchorKey]
      }

      let ref = refA[anchorIndex]
      let refRow = ref.row
      let refCol = ref.column

      // Can only do if it's a shape!
      let defaultLayerZIndex = this.layers[0].grid[refRow][refCol].object.layout.defaultLayerZIndex
      let nextAnchorIndex = nextAnchor.anchorIndex
      let renderedLayerI = nextAnchor.layerZIndex === null ? defaultLayerZIndex : nextAnchor.layerZIndex
      let anchorLocations = this.layers[0].grid[refRow][refCol].object.layout.elementSizeAndPositions[renderedLayerI]
      let anchorLoc = anchorLocations[nextAnchor.anchorKey][nextAnchorIndex]
      next = anchorLoc
    }

    let ref
    if (layerZIndex == null) {
      // Search the default layer only
      ref = this.layersByIndex[0].layerObjectMap[anchorKey]
    } else {
      if (this.layersByZIndex[layerZIndex] == null) {
        inputLine.userError(`Unknown layer z-index: ${layerZIndex}`)
      }
      ref = this.layersByZIndex[layerZIndex].layerObjectMap[anchorKey]
    }
    if (ref == null) {
      inputLine.userError(`Reference not found: ${anchor}`)
    }

    return {
      layerZIndex,
      anchorKey,
      anchorIndex,
      next
    }
  }

  splitAnchorKey(anchorKey) {
    let layerZIndex = null
    let nextAnchor
    if (anchorKey.startsWith('l:')) {
      const anchorKeyTokens = anchorKey.split(':')
      const tokens = anchorKeyTokens.slice(0, 3)
      layerZIndex = tokens[1]
      anchorKey = tokens[2]
      if (anchorKeyTokens.length > 3) {
        anchorKey += this.splitAnchorKey(anchorKeyTokens.slice(3).join(':'))
      }
    }
    let i = anchorKey.indexOf(':')
    if (i !== -1) {
      nextAnchor = this.splitAnchorKey(anchorKey.substring(i + 1))
      anchorKey = anchorKey.substring(0, i)
    }

    const reAnchor = /([^\s\[]+)(\[(\d+)\])*/
    let anchorMatch = anchorKey.match(reAnchor)
    let anchorIndex = 0
    if (anchorMatch[3] != null) {
      anchorIndex = parseInt(anchorMatch[3]) - 1 // index in file is 1 based
      anchorKey = anchorMatch[1]
    }

    return {
      anchorKey,
      anchorIndex,
      layerZIndex,
      nextAnchor
    }
  }

  arrayIncludesDefaultOrOneOf(arr = [], def, ...params) {
    for (var p of params) {
      if (arr.includes(p)) {
        return p
      }
    }
    return def
  }

  trimPrecedingWhiteSpace(lines) {
    let minI = -1
    for (var line of lines) {
      let i = line.string.search(/\S/)
      if (i !== -1 && minI === -1) {
        minI = i
      } else if (i !== -1 && i < minI) {
        minI = i
      }
    }
    for (var line of lines) {
      line.string = line.string.substring(minI)
    }
  }

  findColumnGraph(lines) {
    // Within the columns marked by true
    // Each line can only have one object

    let max = 0
    for (var line of lines) {
      if (line.string.length > max) {
        max = line.string.length
      }
    }
    const cols = []
    for (var i = 0; i < max; i++) {
      cols[i] = false
    }
    for (var line of lines) {
      for (var i = 0; i < line.string.length; i++) {
        var c = line.string.charAt(i);
        if (c !== ' ' && c !== '-' && c !== '.') {
          cols[i] = true
        }
      }
    }

    const colsBounds = []
    var start = 0
    var end = 0
    let on = false
    for (var i = 0; i < max; i++) {
      if (!on && cols[i] === true) {
        if (start !== i) {
          colsBounds.push({
            s: start,
            e: i,
            emptySpace: true
          })
        }
        start = i
        end = i + 1
        on = true
      } else if (on && cols[i] === true) {
        end = i + 1
      } else if (on && cols[i] === false) {
        colsBounds.push({
          s: start,
          e: end
        })
        on = false
        start = i
      } else if (!on && cols[i] == false) {
        colsBounds.push({
          s: start,
          e: i,
          emptySpace: true
        })
        start = i
        end = i + 1
      }
    }
    if (on) {
      colsBounds.push({
        s: start,
        e: end
      })
    } else if (start !== max) {
      colsBounds.push({
        s: start,
        e: end,
        emptySpace: true
      })
    }

    // Find columns with only one dot (or one space)
    //  They will be collapsed
    for (var col of colsBounds) {
      let hasDot = false
      let hasNonSpace = false
      for (var line of lines) {
        let s = line.string.substring(col.s, col.e)
        if (s === '.') {
          hasDot = true
        } else if (s !== ' ' && s !== '-' && s.length > 0) {
          hasNonSpace = true
          break;
        }
      }
      if (!hasNonSpace && hasDot) {
        col.noSpaceColumn = true
      }
    }

    return colsBounds
  }

  makeGrid(inputLines, colGraph, params = {}, settings, pathDistance, pathAngle, fillTo, userFillTo) {
    const grid = [] // [rows][columns]

    // [type] = [array of instances for this type containing x,y coordinate positions]
    const layerObjectMap = {}

    const {rowHeights, colWidths} = this.initializeColumnAndRowArraysWithSpacers(inputLines, colGraph, settings)

    const shapesToFill = []

    for (var y = 0; y < inputLines.length; y++) {
      const line = inputLines[y]
      grid[y] = []
      for (var x = 0; x < colGraph.length; x++) {
        const col = colGraph[x]
        if (!this.fillGridPosition(line, settings, params, col, grid, x, y, layerObjectMap, shapesToFill, pathAngle)) {
          // Nothing for this column
          break
        }
      }
    }

    this.initializeRowSpacers(inputLines, colGraph, grid, rowHeights, settings)

    const rows = inputLines.length
    const cols = colGraph.length

    // Discover and mark the colspans and rowspans
    this.setColSpans(grid, rows, cols)
    this.setRowSpans(grid, rows, cols)

    // Determine the actual column widths of the grid
    this.distributeWidths(grid, rows, cols, colWidths, pathDistance, fillTo.width, userFillTo.width)

    // Layout fillable shapes that have a fill width but not a fill height
    this.layoutFillableShapes(grid, shapesToFill, pathAngle)

    // Determine the actual column heights of the grid
    this.distributeHeights(grid, rows, cols, rowHeights, pathDistance, fillTo.height, userFillTo.height)

    // Layout remaining fillable shapes
    this.layoutFillableShapes(grid, shapesToFill, pathAngle, true)

    return {
      grid,
      rowHeights,
      colWidths,
      layerObjectMap
    }
  }

  initializeColumnAndRowArraysWithSpacers(lines, colGraph, settings) {
    const rowHeights = []
    const colWidths = []
    for (var y = 0; y < lines.length; y++) {
      rowHeights[y] = 0
      for (var x = 0; x < colGraph.length; x++) {
        const col = colGraph[x]
        if (col.noSpaceColumn) {
          colWidths[x] = {
            noSpaceColumn: true
          }
        } else if (col.emptySpace) {
          colWidths[x] = {
            spacer: settings['horizontal-spacer'] * (col.e - col.s)
          }
        } else {
          colWidths[x] = 0
        }
      }
    }
    return {
      rowHeights,
      colWidths
    }
  }

  initializeRowSpacers(lines, colGraph, grid, rowHeights, settings) {
    // If a row has nothing but empty space and pipes, set the minHeight to the spacer,
    // just like what we do for column minWidths
    for (var y = 0; y < lines.length; y++) {
      let emptyRow = true
      for (var x = 0; x < colGraph.length; x++) {
        if (grid[y][x] !== undefined && grid[y][x] !== '|') {
          if (grid[y][x].height === 'fill') {
            continue
          }
          emptyRow = false
          break
        }
      }
      if (emptyRow) {
        rowHeights[y] = {
          spacer: settings['vertical-spacer']
        }
      }
    }
  }

  fillGridPosition(inputLine, settings, params, col, grid, x, y, layerObjectMap, shapesToFill, pathAngle) {
    const line = inputLine.string
    if (/ -/.test(line)) {
      inputLine.userError('Continuation must follow an element')
    }
    if (!col.emptySpace) {
      if (line.trim().length === 0) {
        grid[y][x] = {
          object: null,
          width: 0,
          height: settings['vertical-spacer']
        }
        // Don't continue processing this column
        return false
      }
      let la = line.substring(col.s, col.e).trim().split(' ')
      if (la.length > 1) {
        inputLine.userError('May not have more than one object per row in a column')
      }
      if (/^[- ]+$/.test(la[0])) {
        la[0] = '-'
      } else {
        la[0] = la[0].replace(/-+/g, '')
      }
      if (la[0] === '|'
          || la[0] === '['
          || la[0] === ']'
          || la[0] === '('
          || la[0] === ')') {
        // continuation of object
        grid[y][x] = '|'
      } else if (la[0] === '-') {
        grid[y][x] = '-'
      } else if (la[0] !== '') {
        let elementName = la[0]
        if (elementName.startsWith('$')) {
          const paramName = elementName.substring(1)
          elementName = params[paramName]
        }
        const type = this.elements[elementName]
        if (type === undefined) {
          inputLine.userError("Unknown element: " + elementName)
        }
        if (type.type === 'shape') {
          // Special Case
          if (type.width === 'fill' || type.height === 'fill') {
            // Defer laying out the shape until we know the available space
            shapesToFill.push({
              y,
              x
            })
          } else {
            type.layout = this.layoutShapeWithParams(type.shape, type.params['shape'], type.width, type.height, pathAngle)
            if (type.width == null) {
              type.width = type.layout.width
            }
            if (type.height == null) {
              type.height = type.layout.height
            }
          }
        }
        grid[y][x] = {
          object: type,
          gridAlign: this.getGridAlign(type, settings),
          width: type.width,
          height: type.height
        }
        if (layerObjectMap[elementName] === undefined) {
          layerObjectMap[elementName] = []
        }
        layerObjectMap[elementName].push({
          row: y,
          column: x
        })
      }
    } else {
      // Empty space can have continuations
      let la = line.substring(col.s, col.e).trim().split(' ')
      if (/-+/.test(la[0])) {
        // Needed to figure out colspan
        grid[y][x] = '-'
      }
    }
    return true
  }

  getGridAlign(type, settings) {
    let align = {
      horizontal: settings['grid-align'],
      vertical: settings['grid-valign'],
    }
    if (this.gridAlign[type.key] != null) {
      align.horizontal = this.gridAlign[type.key].horizontal
      align.vertical = this.gridAlign[type.key].vertical
    }
    return align
  }

  layoutFillableShapes(grid, shapesToFill, pathAngle, readyForHeight = false) {
    // Width for each shape must be determined by the time this function is called
    for (var shapeToFill of shapesToFill) {
      const {y, x} = shapeToFill

      let object = grid[y][x].object

      if (object.height === 'fill' && !readyForHeight) {
        continue
      }
      if (shapeToFill.layedOut === true) {
        // layout has already happened for this shape
        continue
      }
      shapeToFill.layedOut = true

      object.layout = this.layoutShapeWithParams(object.shape, object.params['shape'], object.width, object.height, pathAngle)
      if (object.height == null) {
        object.height = object.layout.height
        grid[y][x].height = object.height
      }
    }
  }

  layoutShapeWithParams(shapeKey, params, width, height, pathAngle) {
    const shapeLayout = this.shapeLayouts[shapeKey]
    const keys = Object.keys(shapeLayout.params)
    const paramsFilled = {}
    for (var key of keys) {
      const paramIndex = shapeLayout.params[key]
      paramsFilled[key] = params[paramIndex]
    }

    const shapeParser = new ShapeParser(this.diagramParser)
    shapeLayout.inputFile.reset()
    const layout = shapeParser.parseLayout(shapeLayout.inputFile, paramsFilled, shapeLayout.settings, width, height, pathAngle)
    return layout
  }

  setRowSpans(grid, rows, cols) {
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          let rowspan = 1
          for (var y2 = y + 1; y2 < rows; y2++) {
            if (grid[y2][x] !== undefined && grid[y2][x] === '|') {
              rowspan++
            } else {
              break
            }
          }
          grid[y][x].rowspan = rowspan
        }
      }
    }
  }

  setColSpans(grid, rows, cols) {
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          let colspan = 1
          for (var x2 = x + 1; x2 < cols; x2++) {
            if (grid[y][x2] !== undefined && grid[y][x2] === '-') {
              colspan++
            } else {
              break
            }
          }
          grid[y][x].colspan = colspan
        }
      }
    }
  }

  distributeHeights(grid, rows, cols, rowHeights, pathDistance, fillToHeight, userFillToHeight) {
    if (fillToHeight == null) {
      // fillToHeight overrides userFillToHeight
      // fillToHeight is only used for the default layer, which can't have a userFillToHeight
      fillToHeight = 0
      if (pathDistance.height > 0 && userFillToHeight == null) {
        fillToHeight = pathDistance.height
      }

      if (typeof userFillToHeight === 'number') {
        fillToHeight = userFillToHeight
      } else if (userFillToHeight != null) {
        const layerHeightMatch = userFillToHeight.match(reLayerHeightMatch)
        if (userFillToHeight === '$height') {
          fillToHeight = this.layoutProducer.getLayerSize(this.layers[0]).height
        } else if (layerHeightMatch != null) {
          const layerZIndex = parseInt(layerHeightMatch[1])
          const layer = this.layersByZIndex[layerZIndex]
          fillToHeight = this.layoutProducer.getLayerSize(layer).height
        } else if (userFillToHeight === '$path') {
          fillToHeight = pathDistance.height
        } else if (userFillToHeight === '$rowspan') {
          fillToHeight = 0
        }
      }
    }

    // Set sizes for known rows with rowspan = 1
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          let height = grid[y][x].height
          let rowHeight = (rowHeights[y].spacer != null) ? rowHeights[y].spacer : rowHeights[y]
          if (grid[y][x].rowspan === 1 && height != 'fill') {
            if (height > rowHeight) {
              rowHeights[y] = height
            }
          }
        }
      }
    }

    // fillRemainingHeight starts with the fillToHeight
    //   and subtracts rows with known heights (those with rowspan == 1)
    //   and subtracts spacers
    let fillRemainingHeight = fillToHeight
    if (fillRemainingHeight > 0) {
      for (var y = 0; y < rows; y++) {
        if (rowHeights[y].spacer == null) {
          fillRemainingHeight -= rowHeights[y]
        } else if (rowHeights[y].spacer != null) {
          fillRemainingHeight -= rowHeights[y].spacer
        }
      }
    }

    // Distribute across rowspan
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          let remainingRows = 0
          let takenSoFar = 0
          let takenSoFarBySpacer = 0
          for (var s = 0; s < grid[y][x].rowspan; s++) {
            const rowI = y + s
            if (rowHeights[rowI].spacer != null) {
              remainingRows++
              takenSoFarBySpacer += rowHeights[rowI].spacer
            } else if (rowHeights[rowI] == 0) {
              remainingRows++
            } else {
              takenSoFar += rowHeights[rowI]
            }
          }

          if (grid[y][x].height === 'fill') {
            let fillHeight = takenSoFar + takenSoFarBySpacer + fillRemainingHeight

            // Subtract from the height if it was parameterized
            if (grid[y][x].object.params['fillHeight'] != null
                && grid[y][x].object.params['fillHeight'].length > 0) {
              fillHeight += parseFloat(grid[y][x].object.params['fillHeight'][0])
            }
            if (grid[y][x].object.params['fillHeight'] != null
                && grid[y][x].object.params['fillHeight'].length > 1) {
              let min = parseFloat(grid[y][x].object.params['fillHeight'][1])
              fillHeight = Math.max(min, fillHeight)
            }
            if (fillHeight < 0) {
              fillHeight = 0
            }

            grid[y][x].height = fillHeight
            let copy = JSON.parse(JSON.stringify(grid[y][x].object)) // copy since this is a template
            grid[y][x].object = copy
            grid[y][x].object.height = fillHeight
          }

          if (remainingRows === 0) {
            // All rows are filled already
            // It's ambiguous what we should do
            // So we decide to:
            //   If the space taken so far is more than this object's height, do nothing
            //   If the space taken so far is less than this object's height,
            //     use an equal distribution scheme to adjust each row.
            //     This might squish some rows and expand others
            let spaceToTake = takenSoFar + takenSoFarBySpacer
            let heightPerRow = grid[y][x].height / grid[y][x].rowspan
            if (spaceToTake < grid[y][x].height) {
              for (var s = 0; s < grid[y][x].rowspan; s++) {
                const rowI = y + s
                rowHeights[rowI] = heightPerRow
              }
            }
          } else {
            // Spread across flexible (zeroed) rows and space rows
            let heightPerRow = (grid[y][x].height - takenSoFar) / remainingRows
            for (var s = 0; s < grid[y][x].rowspan; s++) {
              const rowI = y + s
              if (rowHeights[rowI].spacer != null || rowHeights[rowI] == 0) {
                rowHeights[rowI] = heightPerRow
              }
            }
          }
        }
      }
    }

    // For space rows that haven't been set to a height,
    //   use the spacer size
    for (var y = 0; y < rows; y++) {
      if (rowHeights[y].spacer != null) {
        rowHeights[x] = rowHeights[x].spacer
      }
    }
  }

  distributeWidths(grid, rows, cols, colWidths, pathDistance, fillToWidth, userFillToWidth) {
    if (fillToWidth == null) {
      // fillToWidth overrides userFillToWidth
      // fillToWidth is only used for the default layer, which can't have a userFillToWidth
      fillToWidth = 0
      if (pathDistance.width > 0 && userFillToWidth == null) {
        fillToWidth = pathDistance.width
      }

      if (typeof userFillToWidth === 'number') {
        fillToWidth = userFillToWidth
      } else if (userFillToWidth != null) {
        const reLayerWidthMatch = /\$l:(\d+):width/
        const layerWidthMatch = userFillToWidth.match(reLayerWidthMatch)
        if (userFillToWidth === '$width') {
          fillToWidth = this.layoutProducer.getLayerSize(this.layers[0]).width
        } else if (layerWidthMatch != null) {
          const layerZIndex = parseInt(layerWidthMatch[1])
          const layer = this.layersByZIndex[layerZIndex]
          fillToWidth = this.layoutProducer.getLayerSize(layer).width
        } else if (userFillToWidth === '$path') {
          fillToWidth = pathDistance.width
        } else if (userFillToWidth === '$colspan') {
          fillToWidth = 0
        }
      }
    }

    // Set sizes for known cols with colspan = 1
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          // Should not get in here in a . column (no space column)
          let width = grid[y][x].width
          let colWidth = (colWidths[x].spacer != null) ? colWidths[x].spacer : colWidths[x]
          if (grid[y][x].colspan === 1 && width != 'fill') {
            if (width > colWidth) {
              colWidths[x] = width
            }
          }
        }
      }
    }

    // fillRemainingWidth starts with the fillToWidth
    //   and subtracts cols with known widths (those with colspan == 1)
    //   and subtracts spacers
    let fillRemainingWidth = fillToWidth
    if (fillRemainingWidth > 0) {
      for (var x = 0; x < cols; x++) {
        if (colWidths[x].spacer == null && !colWidths[x].noSpaceColumn) {
          fillRemainingWidth -= colWidths[x]
        } else if (colWidths[x].spacer != null) {
          fillRemainingWidth -= colWidths[x].spacer
        }
      }
    }

    // Distribute across colspan
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (grid[y][x] !== undefined && grid[y][x].object !== undefined) {
          // Will not get in here in a . column (no space column)
          let remainingCols = 0
          let takenSoFar = 0
          let takenSoFarBySpacer = 0
          for (var s = 0; s < grid[y][x].colspan; s++) {
            const colI = x + s
            if (colWidths[colI].spacer != null) {
              remainingCols++
              takenSoFarBySpacer += colWidths[colI].spacer
            } else if (colWidths[colI] == 0) {
              remainingCols++
            } else if (!colWidths[colI].noSpaceColumn) {
              takenSoFar += colWidths[colI]
            }
          }

          if (grid[y][x].width === 'fill') {
            let fillWidth = takenSoFar + takenSoFarBySpacer + fillRemainingWidth

            if (grid[y][x].object.params['fillWidth'] != null
                && grid[y][x].object.params['fillWidth'].length > 0) {
              fillWidth += parseFloat(grid[y][x].object.params['fillWidth'][0])
            }
            if (grid[y][x].object.params['fillWidth'] != null
                && grid[y][x].object.params['fillWidth'].length > 1) {
              let min = parseFloat(grid[y][x].object.params['fillWidth'][1])
              fillWidth = Math.max(min, fillWidth)
            }
            if (fillWidth < 0) {
              fillWidth = 0
            }

            grid[y][x].width = fillWidth
            let copy = JSON.parse(JSON.stringify(grid[y][x].object)) // copy since this is a template
            grid[y][x].object = copy
            grid[y][x].object.width = fillWidth
          }

          if (remainingCols === 0) {
            // All cols are filled already
            // It's ambiguous what we should do
            // So we decide to:
            //   If the space taken so far is more than this object's width, do nothing
            //   If the space taken so far is less than this object's width,
            //     use an equal distribution scheme to adjust each column.
            //     This might squish some cols and expand others
            let spaceToTake = takenSoFar + takenSoFarBySpacer
            let widthPerColumn = grid[y][x].width / grid[y][x].colspan
            if (spaceToTake < grid[y][x].width) {
              for (var s = 0; s < grid[y][x].colspan; s++) {
                const colI = x + s
                if (!colWidths[colI].noSpaceColumn) {
                  colWidths[colI] = widthPerColumn
                }
              }
            }
          } else {
            // Spread across flexible (zeroed) cols and space cols
            let widthPerColumn = (grid[y][x].width - takenSoFar) / remainingCols
            for (var s = 0; s < grid[y][x].colspan; s++) {
              const colI = x + s
              if (colWidths[colI].spacer != null || colWidths[colI] === 0) {
                colWidths[colI] = widthPerColumn
              }
            }
          }
        }
      }
    }

    // For space columns that haven't been set to a width,
    //   use the spacer size
    for (var x = 0; x < cols; x++) {
      if (colWidths[x].spacer != null) {
        colWidths[x] = colWidths[x].spacer
      } else if (colWidths[x].noSpaceColumn) {
        colWidths[x] = 0
      }
    }
  }

  assertNonZeroWidthAndHeight(colWidths, rowHeights, inputLines) {
    let width = 0
    for (var x = 0; x < colWidths.length; x++) {
      width += colWidths[x]
    }
    if (width === 0) {
      inputLines[0].userError('Layer width must be > 0', 0)
    }
    let height = 0
    for (var y = 0; y < rowHeights.length; y++) {
      height += rowHeights[y]
    }
    if (height === 0) {
      inputLines[0].userError('Layer height must be > 0', 0)
    }
  }

}

function parseOutSvgFillRotate(inputLine) {
  let line = inputLine.string
  let svg = null
  let rotateTo = null
  let fillTo = {
    width: null,
    height: null
  }
  let mode = 'path'

  const reSvg = /(.*?) svg:(.+)/
  let match = line.match(reSvg)
  if (match != null) {
    svg = match[2]
    line = match[1]
  }

  const reRotateTo = /(.*?) rotateTo:\s*([\S]+)(.*)/
  match = line.match(reRotateTo)
  if (match != null) {
    rotateTo = match[2]
    line = match[1]
    if (match[3] != null) {
      line += ' ' + match[3]
    }
  }

  const reFillWidth = /(.*?) fillWidth:\s*(\S+)(.*)/
  match = line.match(reFillWidth)
  if (match != null) {
    line = match[1] + match[3]

    fillTo.width = match[2]
    if (!fillTo.width.startsWith('$')) {
      fillTo.width = parseFloat(fillTo.width)
      if (isNaN(fillTo.width)) {
        inputLine.userError(`Invalid fillWidth: ${match[2]}`)
      }
    } else if (!fillTo.width.match(reLayerWidthMatch)
               && !['$width', '$colspan', '$path'].includes(fillTo.width)) {
      inputLine.userError(`Invalid fillWidth: ${fillTo.width}`)
    }
  }

  const reFillHeight = /(.*?) fillHeight:\s*(\S+)(.*)/
  match = line.match(reFillHeight)
  if (match != null) {
    line = match[1] + match[3]

    fillTo.height = match[2]
    if (!fillTo.height.startsWith('$')) {
      fillTo.height = parseFloat(fillTo.height)
      if (isNaN(fillTo.height)) {
        inputLine.userError(`Invalid fillHeight: ${match[2]}`)
      }
    } else if (!fillTo.height.match(reLayerHeightMatch)
               && !['$height', '$rowspan', '$path'].includes(fillTo.height)) {
      inputLine.userError(`Invalid fillHeight: ${fillTo.height}`)
    }
  }

  const reMode = /(.*?) mode:\s*(\S+)(.*)/
  match = line.match(reMode)
  if (match != null) {
    line = match[1] + match[3]
    mode = match[2]
    if (mode !== 'path' && mode !== 'box') {
      inputLine.userError(`Invalid path mode: ${mode}`)
    }
  }

  if (fillTo.height === '$path' && mode !== 'box') {
    inputLine.userError(`fillHeight:$path may only be used with box mode`)
  }

  return {
    line,
    svg,
    rotateTo,
    fillTo,
    mode
  }

}
