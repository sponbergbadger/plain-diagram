const C = require('./Const')
const InputFile = require('./InputFile')
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

    this.initializeParsers(diagramFactory)
  }

  initializeParserState() {
    this.elements = {}
    this.styles = {}
    this.lastStyleName = null
    this.lastGridAlignment = null
    this.globalStyles = {}
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

    this.diagramFactory.notifyListeners(C.notificationParserInitialized, this)
  }

  parseDiagram(text) {
    this.initializeParserState()

    const {spec, layout, shapes} = new InputFile(text).fileSections

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
      globalStyles: this.globalStyles,
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
    this.parsers['style'] = (line, inputFile) => { this.parserStyles(line, inputFile, this.variables) }
    this.parsers['default-style'] = (line) => { this.parserGlobalStyles(line, this.variables) }
    this.parsers['margin'] = (line) => { this.parserMargin(line, this.variables) }
    this.parsers['settings'] = (line, inputFile, variables, settings) => { this.parserSettings(line, variables, settings) }
    this.parsers['variable'] = (line, inputFile, variables) => { this.parserVariables(line, variables) }
    this.parsers['font'] = (line, inputFile) => { this.parserFont(line, inputFile, this.variables) }
    this.parsers['svg'] = (line, inputFile) => { this.parserSvg(line, inputFile, this.variables) }
    this.parsers['debug'] = (line, inputFile) => { this.parserDebug(line, inputFile, this.variables) }
    this.parsers['grid-align'] = (line, inputFile) => { this.parserGridAlign(line, inputFile, this.variables) }
  }

  parseSpec(inputFile, variables = this.variables, settings = this.settings) {
    let parser = null
    let line
    while ((line = inputFile.pop()) != null) {
      if (line.string.trim().length === 0) {
        continue
      }
      if (!/^\s+/.test(line.string)) {
        parser = null
      }
      if (parser === null) {
        parser = this.findParser(line)
        line = inputFile.pop()
      }
      const ele = parser(line.string, inputFile, variables, settings)
      if (ele != null) {
        if (ele.type !== 'shape') {
          if (this.diagramFactory.getRenderers()[ele.type] == null) {
            line.userError(`No renderer for: ${ele.type}`)
          } else if (ele.width == null) {
            line.userError(`Parsed element must have a width: ${ele.key}. The parser was:\n${parser}`)
          } else if (ele.height == null) {
            line.userError(`Parsed element must have a height: ${ele.key}. The parser was:\n${parser}`)
          }
        }
        if (ele.params === undefined) {
          ele.params = []
        }
        this.elements[ele.key] = ele
      }
    }
  }

  parseShapes(shapes) {
    for (var inputFile of shapes) {
      this.parseShape(inputFile)
    }
  }

  parseShape(inputFile) {
    let line = inputFile.pop().string
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

    const re = /^\S+:/gm
    let method = 'layoutOnly'
    for (var i = 0; i < inputFile.lines.length; i++) {
      // Only allow layout, variable, settings
      if (re.test(inputFile.lines[i].string)) {
        method = 'spec'
        break
      }
    }

    let settings = {
      'horizontal-spacer': this.settings['horizontal-spacer'],
      'vertical-spacer': this.settings['vertical-spacer'],
      'text-width': this.settings['text-width'],
      'text-height': this.settings['text-height'],
      'grid-align': this.settings['grid-align'],
      'grid-valign': this.settings['grid-valign'],
    }
    if (method === 'spec') {
      inputFile.pop()
      const {spec, layout} = new InputFile(null, inputFile).fileSections

      this.parseSpec(spec, this.variables, settings)

      inputFile = layout
    } else {
      inputFile.lockResetIndex()
    }

    this.shapeLayouts[key] = {
      inputFile,
      params,
      settings
    }
  }

  parseLayout(inputFile) {
    const shapeParser = new ShapeParser(this, this.margin)
    return shapeParser.parseLayout(inputFile)
  }

  findParser(line) {
    const match = line.string.match(/^(\S+?):/)
    let parser = null
    if (match != null) {
      parser = this.parsers[match[1].toLowerCase()]
      if (parser == null) {
        line.userError(`Unknown type: ${match[1]}`)
      }
    }
    return parser
  }

  parserStyles(line, inputFile, variables) {
    let {key, val} = parseKeyValue(line, variables)
    val = val.trim()
    if (val.startsWith("'")) {
      if (this.lastStyleName == null) {
        inputFile.userError(`May only use ' when there is a style line above`)
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

  parserGlobalStyles(line, variables) {
    let {key, val} = parseKeyValue(line)
    this.globalStyles[key] = val
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

  parserFont(line, inputFile, variables) {
    const {key, content} = Util.parseKeyContent(line, inputFile, 0, variables)
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

  parserSvg(line, inputFile, variables) {
    const {key, tokens, content} = Util.parseKeyContent(line, inputFile, 0, variables)

    const ele = this.elements[key]
    if (ele == null) {
      inputFile.userError(`Element not found: ${key}`)
    }
    ele.svg = content
  }

  parserDebug(line) {
    let {key, val} = parseKeyValue(line)
    this.debug[key] = Util.booleanOrString(val)
  }

  parserGridAlign(line, inputFile, variables) {
    const {key, tokens, content} = Util.parseKeyContent(line, inputFile, 2, variables)
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
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
