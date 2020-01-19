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
      const diagramText = fs.readFileSync(input, 'utf-8')
      const diagram = this.newDiagramParser().parseDiagram(diagramText)
      diagram.outputPath = output
      const svg = this.newDiagramRenderer().renderDiagram(diagram)
      if (output != null) {
        fs.writeFileSync(output, svg)
      }
      return svg
    } catch (e) {
      throw Util.addMessageToError(`Error parsing: ${input}`, e)
    }
  }

}
