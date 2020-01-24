const path = require('path')
const fs = require('fs')

const DiagramParser = require('./DiagramParser')
const LayoutProducer = require('./LayoutProducer')
const ParsersProducersRenderers = require('./ParsersProducersRenderers')
const SvgDiagramRenderer = require('./SvgDiagramRenderer')
const SvgShapeRenderer = require('./SvgShapeRenderer')
const Util = require('./Util')

module.exports = class SvgDiagramFactory {

  constructor(basePath, pluginPathArray) {
    this.basePath = basePath
    this.parsersProducersRenderers = new ParsersProducersRenderers(pluginPathArray)
  }

  getParsers() {
    return this.parsersProducersRenderers.parsers
  }

  getProducers() {
    return this.parsersProducersRenderers.producers
  }

  getRenderers() {
    return this.parsersProducersRenderers.renderers
  }

  newDiagramRenderer() {
    return new SvgDiagramRenderer(this)
  }

  newLayoutProducer() {
    return new LayoutProducer(this)
  }

  newDiagramParser() {
    return new DiagramParser(this)
  }

  renderDiagram(input, output = null) {
    try {
      input = path.resolve(this.basePath, input)
      if (output != null) {
        output = path.resolve(this.basePath, output)
      }
      const diagramText = fs.readFileSync(input, 'utf-8')
      const diagram = this.newDiagramParser().parseDiagram(diagramText)
      diagram.outputPath = output
      const svg = this.newDiagramRenderer().renderDiagram(diagram)
      if (output != null) {
        fs.writeFileSync(output, svg)
      }
      return svg
    } catch (e) {
      let lineNumber = ''
      if (e.lineNumber) {
        lineNumber = ':' + e.lineNumber
      }
      const errorParsing = `${input}${lineNumber}`
      throw Util.addMessageToError(errorParsing, e)
    }
  }

  notifyListeners(notification, data) {
    this.parsersProducersRenderers.notifyListeners(notification, data)
  }

}
