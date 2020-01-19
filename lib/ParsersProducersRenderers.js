const path = require('path')

const Util = require('./Util')

const parsersPath = path.resolve(__dirname, 'builtins/Parsers.js')
const producersPath = path.resolve(__dirname, 'builtins/LayoutProducers.js')
const renderersPath = path.resolve(__dirname, 'builtins/Renderers.js')

let parsers, producers, renderers

module.exports = class ParsersProducersRenderers {

  constructor(pluginPaths) {
    this.parsers = {}
    this.producers = {}
    this.renderers = {}

    const builtins = [
      parsersPath,
      producersPath,
      renderersPath
    ]
    this.loadPPR(builtins)
    this.loadPPR(pluginPaths)
  }

  loadPPR(paths) {
    parsers = this.parsers
    producers = this.producers
    renderers = this.renderers
    for (var p of paths) {
      loadParsersProducersRenderers(p)
    }
  }

}

function registerParser(elementType, parser) {
  parsers[elementType] = parser
}

function registerLayoutProducer(elementType, producer) {
  producers[elementType] = producer
}

function registerRenderer(elementType, renderer) {
  renderers[elementType] = renderer
}

function loadParsersProducersRenderers(customCodePath) {
  if (customCodePath == null) {
    return
  }

  const code = Util.loadCustomCode(customCodePath)
  scopedCode = `(function() {\
                  ${code}\
                })();`;
  eval(scopedCode);
}

function parseKeyContent(line, rem, numTokens, variables, extractParams) {
  return Util.parseKeyContent(line, rem, numTokens, variables, extractParams)
}

function fillOrFloat(token, fillSupported = false, defVal) {
  if (token === undefined && defVal !== undefined) {
    return defVal
  }
  if (token === 'fill') {
    if (!fillSupported) {
      throw new Error('Fill is not supported on this element')
    }
    return 'fill'
  } else {
    const val = parseFloat(token)
    if (Number.isNaN(val)) {
      throw new Error(`Is not a number, or 'fill': ${token}`)
    }
    return val
  }
}

function round(v) {
  return Math.round(v * 1000) / 1000
}
