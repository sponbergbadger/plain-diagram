const path = require('path')
const fs = require('fs')
const XmlJS = require('xml-js');

if (!fs.existsSync(path.resolve(__dirname, 'assets/output'))) {
  fs.mkdirSync(path.resolve(__dirname, 'assets/output'))
}

const SvgDiagramFactory = require('../lib/SvgDiagramFactory');

const basePath = path.resolve(__dirname, 'assets')
const pluginPaths = [
  path.resolve(__dirname, 'assets/js/Plugins.js'),
]
const diagramFactory = new SvgDiagramFactory(basePath, pluginPaths)

const cache = {}

function parseDiagram(filename, saveToFile = false) {
  if (cache[filename] !== undefined && !saveToFile) {
    return cache[filename]
  }
  const input = path.resolve(basePath, filename + '.txt')
  let output
  if (saveToFile) {
    output = path.resolve(basePath, 'output', filename + '.svg')
  }
  const xml = diagramFactory.renderDiagram(input, output)
  const js = XmlJS.xml2js(xml, {compact: true})
  cache[filename] = js.svg
  return js.svg
}

test('when an error is thrown, there should be a > pointing at the invalid line', () => {
  try {
    parseDiagram('diagram42')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('Invalid coords: 0,not-a-number');
    expect(e.message).toMatch('> 10 |    p: 0,not-a-number');
  }
})

test('when an error is thrown, the message should contain the line number', () => {
  try {
    parseDiagram('diagram42')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('diagram42.txt:10');
    expect(e.message).toMatch('Invalid coords: 0,not-a-number');
    expect(e.message).toMatch('7 |   l2: 1 fill(-10 30)');
    expect(e.message).toMatch('> 10 |    p: 0,not-a-number');
    expect(e.message).toMatch('13 | ');
  }
})

test('when an error is thrown, the message should plus and minus 3 lines', () => {
  try {
    parseDiagram('diagram42')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('diagram42.txt:10');
    expect(e.message).toMatch('Invalid coords: 0,not-a-number');
    expect(e.message).toMatch('7 |   l2: 1 fill(-10 30)');
    expect(e.message).toMatch('> 10 |    p: 0,not-a-number');
    expect(e.message).toMatch('13 | ');
  }
})

test('when polygon coords are not a float, it should throw an error', () => {
  try {
    parseDiagram('diagram42')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('Invalid coords: 0,not-a-number');
  }
})

test('when a parser is invalid, it should throw an error', () => {
  try {
    parseDiagram('diagram43')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('> 4 | invalid:');
  }
})

test('when \' is used without a line above, it should throw an error', () => {
  try {
    parseDiagram('diagram44')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('May only use \' when there is a style line above');
    expect(e.message).toMatch('> 5 |   o: ')
  }
})

test('when svg refers to an element that doesn\'t exist, it should throw an error', () => {
  try {
    parseDiagram('diagram45')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('Element not found: o2');
    expect(e.message).toMatch('> 5 |   o2:')
  }
})

test('when a layout section is missing, it should throw an error', () => {
  try {
    parseDiagram('diagram46')
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch('Invalid specification: must provide a spec followed by a layout section');
  }
})
