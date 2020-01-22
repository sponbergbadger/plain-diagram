const C = require('./Const')
const ShapeParser = require('./ShapeParser')
const Util = require('./Util')

const defaultSettings = {
  'horizontal-spacer': 20,
  'vertical-spacer': 20,
  'text-width': 5,
  'text-height': 30,
  'grid-align': 'center',
  'grid-valign': 'middle',
}

module.exports = class DiagramParser {

  constructor(diagramFactory) {
    this.diagramFactory = diagramFactory
    this.renderer = diagramFactory.newDiagramRenderer()

    this.initializeParserState()

    this.initializeParsers(diagramFactory)
  }

  initializeParserState() {
    this.elements = {}
    this.styles = {}
    this.lastStyleName = null
    this.lastGridAlignment = null
    this.defaultStyles = {
      'text': 'font: 12px sans-serif;', // text-anchor and dominant-baseline will be added when grid alignment has been determined
      'rect': 'fill: none',
      'ellipse': 'fill: none',
    }
    this.margin = {
      left: 30,
      right: 30,
      top: 30,
      bottom: 30
    }
    this.settings = {
      'horizontal-spacer': defaultSettings['horizontal-spacer'],
      'vertical-spacer': defaultSettings['vertical-spacer'],
      'text-width': defaultSettings['text-width'],
      'text-height': defaultSettings['text-height'],
      'grid-align': defaultSettings['grid-align'],
      'grid-valign': defaultSettings['grid-valign'],
    }
    this.debug = {
      showGrid: false
    }
    this.gridAlign = {}
    this.variables = {}
    this.shapeLayouts = {}
    this.fonts = []
  }

  parseDiagram(text) {
    this.initializeParserState()

    const {spec, layout, shapes} = this.parsePartsIntoLines(text)

    this.parseSpec(spec)
    if (shapes != null) {
      this.parseShapes(shapes)
    }

    this.diagramFactory.notifyListeners(C.notificationSpecParsed, this)

    const {layers, elementSizeAndPositions, width, height, negSpaceX, negSpaceY} = this.parseLayout(layout)
    const diagram = {
      layers,
      elementSizeAndPositions,
      margin: this.margin,
      styles: this.styles,
      settings: this.settings,
      defaultStyles: this.defaultStyles,
      fonts: this.fonts,
      x1: -negSpaceX,
      y1: -negSpaceY,
      width: width + negSpaceX,
      height: height + negSpaceY,
      debug: this.debug,
    }
    return diagram
  }

  initializeParsers(diagramFactory) {
    this.parsers = diagramFactory.getParsers()

    // Git Svg special sections
    this.parsers['style'] = (line) => { this.parserStyles(line, this.variables) }
    this.parsers['default-style'] = (line) => { this.parserDefaultStyles(line, this.variables) }
    this.parsers['margin'] = (line) => { this.parserMargin(line, this.variables) }
    this.parsers['settings'] = (line, rem, variables, settings) => { this.parserSettings(line, variables, settings) }
    this.parsers['variable'] = (line, rem, variables) => { this.parserVariables(line, variables) }
    this.parsers['font'] = (line, rem) => { this.parserFont(line, rem, this.variables) }
    this.parsers['svg'] = (line, rem) => { this.parserSvg(line, rem, this.variables) }
    this.parsers['debug'] = (line, rem) => { this.parserDebug(line, rem, this.variables) }
    this.parsers['grid-align'] = (line, rem) => { this.parserGridAlign(line, rem, this.variables) }
  }

  parsePartsIntoLines(text) {
    let match = text.match(/([\s\S]+?)\nlayout:([\s\S]+)/m)
    if (match == null) {
      throw new Error('Invalid specification: must provide a spec followed by a layout section')
    }
    let spec = match[1].split('\n')
    let part2 = match[2]
    let layout
    let shapes

    match = part2.match(/([\s\S]+?)(\nshape:[\s\S]*)/m)
    if (match == null) {
      layout = part2.split('\n')
    } else {
      layout = match[1].split('\n')
      shapes = match[2].split(/\nshape:/m)
      shapes.shift() // first line is empty due to split
      for (var i = 0; i < shapes.length; i++) {
        shapes[i] = shapes[i].split('\n')
      }
    }

    spec = this.moveToTop(spec, 'settings')
    spec = this.moveToTop(spec, 'variable')
    spec = this.moveSvgToBottom(spec)

    return {
      spec,
      layout,
      shapes
    }
  }

  moveToTop(lines, type) {
    const newlines = []
    const variables = []
    let line
    let arr = newlines
    while ((line = lines.shift()) != null) {
      const commentI = Util.commentIndex(line)
      if (commentI != -1) {
       line = line.substring(0, commentI)
      }
      if (/^\S+/.test(line)) {
        if (line.startsWith(`${type}:`)) {
          arr =  variables
        } else {
          arr = newlines
        }
      }
      arr.push(line)
    }
    return [...variables, ...newlines]
  }

  moveSvgToBottom(lines) {
    const newlines = []
    const svg = []
    let line
    let arr = newlines
    while ((line = lines.shift()) != null) {
      const commentI = Util.commentIndex(line)
      if (commentI != -1) {
       line = line.substring(0, commentI)
      }
      if (/^\S+/.test(line)) {
        if (line.startsWith('svg:')) {
          arr =  svg
        } else {
          arr = newlines
        }
      }
      arr.push(line)
    }
    return [...newlines, ...svg]
  }

  parseSpec(lines, variables = this.variables, settings = this.settings) {
    let parser = null
    let line
    while ((line = lines.shift()) != null) {
      const commentI = Util.commentIndex(line)
      if (commentI != -1) {
       line = line.substring(0, commentI)
      }
      if (line.trim().length === 0) {
        continue
      }
      if (!/^\s+/.test(line)) {
        parser = null
      }
      if (parser === null) {
        parser = this.findParser(line)
        line = lines.shift()
      }
      const ele = parser(line, lines, variables, settings)
      if (ele != null) {
        if (ele.params === undefined) {
          ele.params = []
        }
        this.elements[ele.key] = ele
      }
    }
  }

  parseShapes(shapes) {
    for (var lines of shapes) {
      this.parseShape(lines)
    }
  }

  parseShape(lines) {
    let line = lines.shift()
    let match = line.match(/(.+?)\((.*)\)(.*)/)
    let shapeParameters = []
    if (match != null) {
       shapeParameters = match[2].split(/[,\s]+/)
       line = match[1] + match[3]
    }

    let tokens = line.split(' ')
    const key = tokens[0]
    let params = {}
    for (var i = 0; i < shapeParameters.length; i++) {
      params[shapeParameters[i]] = i
    }

    // Shape is described in one of two ways
    // 1. The layout, without a 'layout:' tag
    // 2. A spec section followed by a 'layout:' tag

    let method = 'layoutOnly'
    for (var i = 0; i < lines.length; i++) {
      // Only allow layout, variable, settings
      if (lines[i].startsWith('layout:')) {
        method = 'spec'
        break
      }
    }

    let settings = {
      'horizontal-spacer': defaultSettings['horizontal-spacer'],
      'vertical-spacer': defaultSettings['vertical-spacer'],
      'text-width': defaultSettings['text-width'],
      'text-height': defaultSettings['text-height'],
      'grid-align': defaultSettings['grid-align'],
      'grid-valign': defaultSettings['grid-valign'],
    }
    if (method === 'spec') {
      const {spec, layout} = this.parsePartsIntoLines(lines.join('\n'))
      this.parseSpec(spec, this.variables, settings)
      lines = layout
    }

    lines.unshift('') // Need one empty line on top for parser to eat before adding spacing

    this.shapeLayouts[key] = {
      lines,
      params,
      settings
    }
  }

  parseLayout(lines) {
    const shapeParser = new ShapeParser(this, this.margin)
    return shapeParser.parseLayout(lines)
  }

  findParser(line) {
    const match = line.match(/^(\S+?):/)
    let parser = null
    if (match != null) {
      parser = this.parsers[match[1].toLowerCase()]
      if (parser === undefined) {
        throw new Error(`Unknown type: ${match[1]}`)
      }
    }
    if (parser == null) {
      throw new Error(`Unexpected: ${line}`)
    }
    return parser
  }

  parserStyles(line, variables) {
    let {key, val} = parseKeyValue(line, variables)
    val = val.trim()
    if (val.startsWith("'")) {
      if (this.lastStyleName == null) {
        throw new Error(`May only use ' when there is a style line above`)
      }
      this.styles[key] = {
        name: this.lastStyleName,
        plus: val.substring(1).trim()
      }
    } else {
      let name = key
      const re = /^-?[_a-zA-Z]+[_-a-zA-Z0-9]*$/m // tests for valid css class
      if (!re.test(key)) {
        name = '-git-diagram-' + hashCode(key)
      }
      this.styles[key] = {
        name,
        val
      }
      this.lastStyleName = name
    }
  }

  parserDefaultStyles(line, variables) {
    let {key, val} = parseKeyValue(line)
    this.defaultStyles[key] = val
  }

  parserMargin(line, variables) {
    let {key, val} = parseKeyValue(line, variables)
    this.margin[key] = parseFloat(val)
  }

  parserSettings(line, variables, settings) {
    let {key, val} = parseKeyValue(line, variables)
    if (key === 'horizontal-spacer'
        || key === 'vertical-spacer'
        || key === 'text-width'
        || key === 'text-height') {
      val = parseFloat(val)
    }
    settings[key] = val
  }

  parserVariables(line, variables) {
    let {key, val} = parseKeyValue(line)
    variables[key] = val
  }

  parserFont(line, rem, variables) {
    const {key, content} = Util.parseKeyContent(line, rem, 0, variables)
    if (key.toLowerCase() === 'import') {
      this.fonts.push({
        imports: content.trim().split(/\s+/)
      })
    } else {
      this.fonts.push({
        family: key.trim(),
        src: content.trim(),
      })
    }
  }

  parserSvg(line, rem, variables) {
    const {key, tokens, content} = Util.parseKeyContent(line, rem, 0, variables)

    const ele = this.elements[key]
    if (ele == null) {
      throw new Error(`Element not found ${key} referred to by svg: ${line}`)
    }
    ele.svg = content
  }

  parserDebug(line) {
    let {key, val} = parseKeyValue(line)
    this.debug[key] = Util.booleanOrString(val)
  }

  parserGridAlign(line, rem, variables) {
    const {key, tokens, content} = Util.parseKeyContent(line, rem, 2, variables)
    if (tokens[0] === "'") {
      this.gridAlign[key] = this.lastGridAlignment
    } else {
      this.gridAlign[key] = {
        vertical: tokens[0],
        horizontal: tokens[1],
      }
      this.lastGridAlignment = this.gridAlign[key]
    }
  }

}

function parseKeyValue(line, variables = {}) {
  const match = line.match(/(.+?):(.+)/)
  const key = match[1].trim()
  let val = Util.varRep(match[2].trim(), variables)

  return {
    key,
    val,
  }
}

function hashCode(str) {
  var hash = 0, i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
