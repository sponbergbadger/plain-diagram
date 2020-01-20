const fs = require('fs')
const path = require('path')
const XmlJS = require('xml-js');

const SvgDiagramFactory = require('../lib/SvgDiagramFactory');

test('it should resolve relative file paths', () => {
  const basePath = 'assets'
  const pluginPaths = ['assets/js/Plugins.js']
  const filename = 'diagram19'

  process.chdir(__dirname);

  const outputPath = path.resolve(basePath, 'output', filename + '.svg')
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
  }

  const diagramFactory = new SvgDiagramFactory(basePath, pluginPaths)

  const input = filename + '.txt'
  const output = 'output/' + filename + '.svg'

  const xml = diagramFactory.renderDiagram(input, output)
  const svg = XmlJS.xml2js(xml, {compact: true}).svg

  expect(fs.existsSync(outputPath)).toBeTruthy()
  expect(svg.g.image._attributes.href).toBe('../images/image.svg')
})

test('it should resolve absolute file paths', () => {
  const basePath = path.resolve(__dirname, 'assets')
  const pluginPaths = [path.resolve(__dirname, 'assets/js/Plugins.js')]
  const filename = 'diagram19'

  const outputPath = path.resolve(basePath, 'output', filename + '.svg')
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
  }

  const diagramFactory = new SvgDiagramFactory(basePath, pluginPaths)

  const input = path.resolve(basePath, filename + '.txt')
  const output = path.resolve(basePath, 'output', filename + '.svg')

  const xml = diagramFactory.renderDiagram(input, output)
  const svg = XmlJS.xml2js(xml, {compact: true}).svg

  expect(fs.existsSync(outputPath)).toBeTruthy()
  expect(svg.g.image._attributes.href).toBe('../images/image.svg')
})
