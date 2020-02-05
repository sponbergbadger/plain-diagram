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

function expectError(diagram, lineNumber, message) {
  try {
    parseDiagram(diagram)
    expect(true).toBe(false);
  } catch (e) {
    expect(e.message).toMatch(message);
    expect(e.message).toMatch(`> ${lineNumber} |`)
  }
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

test('it should throw an error if an element is not defined', () => {
  expect(() => {
    parseDiagram('diagram21')
  }).toThrow();
})

test('it should throw an error if the layout section is not present', () => {
  expect(() => {
    parseDiagram('diagram22')
  }).toThrow();
})

test('it should throw an error if the spec section is defined', () => {
  expect(() => {
    parseDiagram('diagram23')
  }).toThrow();
})

test('it should throw an error when \' is used in style when there isn\'t one defined above it', () => {
  expect(() => {
    parseDiagram('diagram24')
  }).toThrow();
})

test('it should throw an error when fill is used on an unsupported type', () => {
  expect(() => {
    parseDiagram('diagram25')
  }).toThrow();
  expect(() => {
    parseDiagram('diagram26')
  }).toThrow();
})

test('it should throw an error when the diagram height is zero', () => {
  expect(() => {
    parseDiagram('diagram28')
  }).toThrow();
})

test('it should throw an error when the diagram width is zero', () => {
  expectError('diagram29', 6, 'Layer width must be > 0')
})

test('it should not throw an error when a layer dimension is zero', () => {
  expect(() => {
    parseDiagram('diagram78')
  }).not.toThrow();
})

test('when polygon coords are not a float, it should throw an error', () => {
  expectError('diagram42', 10, 'Invalid coords: 0,not-a-number')
})

test('when a parser is invalid, it should throw an error', () => {
  expectError('diagram43', 4, 'Unknown type: invalid')
})

test('when \' is used without a line above, it should throw an error', () => {
  expectError('diagram44', 5, 'May only use \' when there is a style line above')
})

test('when svg refers to an element that doesn\'t exist, it should throw an error', () => {
  expectError('diagram45', 5, 'Element not found: o2')
})

test('when a layout section is missing, it should throw an error', () => {
  expectError('diagram46', 1, 'Invalid specification: must provide a spec followed by a layout section')
})

test('when fill is used on an unsupported element, it should throw an error', () => {
  expectError('diagram47', 2, 'Fill is not supported on this element')
})

test('when a size is not fill or a number, it should throw an error', () => {
  expectError('diagram48', 2, 'Is not a number, or \'fill\': a')
})

test('when shape uses spec and does not provide a layout, it should throw an error', () => {
  expectError('diagram49', 11, 'Invalid specification: must provide a spec followed by a layout section')
})

test('when two layers have the same z-index, it should throw an error', () => {
  expectError('diagram50', 12, 'Layer at z-index 2 already exists')
})

test('when a layer does not use at or from/to, it should throw an error', () => {
  expectError('diagram51', 8, 'Invalid layer definition')
})

test('when a layer offset height is invalid, it should throw an error', () => {
  expectError('diagram52', 8, 'Invalid coords: 0,a')
})

test('when a layer offset width is invalid, it should throw an error', () => {
  expectError('diagram53', 8, 'Invalid coords: a,0')
})

test('when a layer anchor reference contains an unkown z-index, it should throw an error', () => {
  expectError('diagram55', 13, 'Unknown layer z-index: 3')
})

test('when a layer anchor reference contains an unkown element, it should throw an error', () => {
  expectError('diagram56', 8, 'Reference not found: z')
})

test('when a column has multiple elements in the same row, it should throw an error', () => {
  expectError('diagram57', 7, 'May not have more than one object per row in a column');
})

test('when an empty column has multiple continuations in the same row, it should throw an error', () => {
  expectError('diagram58', 7, 'Continuation must follow an element');
})

test('when a layer\'s fillWidth is invalid, it should throw an error', () => {
  expectError('diagram60', 8, 'Invalid fillWidth: $invalid');
})

test('when a layer\'s fillWidth is invalid, it should throw an error', () => {
  expectError('diagram61', 8, 'Invalid fillWidth: a');
})

test('when a layer\'s fillHeight is invalid, it should throw an error', () => {
  expectError('diagram62', 8, 'Invalid fillHeight: $invalid');
})

test('when a layer\'s fillHeight is invalid, it should throw an error', () => {
  expectError('diagram63', 8, 'Invalid fillHeight: a');
})

test('when an element returned from a parser does not have a renderer, it should throw an error', () => {
  expectError('diagram64', 5, 'No renderer for: funnybox');
})

test('when an anchor reference does not exist, it should throw an error', () => {
  expectError('diagram65', 11, 'Reference not found: t2');
})

test('when a parsed element does not have a height, it should throw an error', () => {
  expectError('diagram66', 5, 'Parsed element must have a height: t');
})

test('when the layout section has no content, it should throw an error', () => {
  expectError('diagram71', 6, 'Layout section must have content');
})

test('when fillHeight:$path is used while the mode is not box, it should throw an error', () => {
  expectError('diagram76', 13, 'fillHeight:$path may only be used with box mode');
})

test('when an invalid path mode is specified, it should throw an error', () => {
  expectError('diagram77', 13, 'Invalid path mode: invalid');
})
