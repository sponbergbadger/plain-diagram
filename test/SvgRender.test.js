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

function getElement(svg, elementType, index = 0, layerIndex = 0) {
  let layer
  if (Array.isArray(svg.g)) {
    layer = svg.g[layerIndex]
  } else if (layerIndex === 0) {
    layer = svg.g
  }
  if (Array.isArray(layer[elementType])) {
    return layer[elementType][index]
  } else if (index === 0) {
    return layer[elementType]
  }
}

function pf(v) {
  return parseFloat(v)
}

test('it should render a circle', () => {
  const svg = parseDiagram('diagram1')
  const att = getElement(svg, 'ellipse')._attributes
  expect(att.cx).toBe('45')
  expect(att.cy).toBe('45')
  expect(att.rx).toBe('15')
  expect(att.ry).toBe('15')
  expect(att.stroke).toBe('black')
})

test('it should render an ellipse', () => {
  const svg = parseDiagram('diagram2')
  const att = getElement(svg, 'ellipse', 1)._attributes
  expect(att.cx).toBe('160')
  expect(att.cy).toBe('50')
  expect(att.rx).toBe('10')
  expect(att.ry).toBe('20')
  expect(att.stroke).toBe('black')
})

test('it should render a line', () => {
  const svg = parseDiagram('diagram2')
  const att = getElement(svg, 'line')._attributes
  expect(att.x1).toBe('190')
  expect(att.y1).toBe('50')
  expect(att.x2).toBe('215')
  expect(att.y2).toBe('50')
  expect(att.stroke).toBe('black')
  expect(att['stroke-width']).toBe('2')
})

test('it should render a rect', () => {
  const svg = parseDiagram('diagram2')
  const att = getElement(svg, 'rect')._attributes
  expect(att.x).toBe('55')
  expect(att.y).toBe('72.5')
  expect(att.width).toBe('50')
  expect(att.height).toBe('25')
  expect(att.stroke).toBe('black')
  expect(att['stroke-width']).toBe('1')
})

test('it should render a polygon', () => {
  const svg = parseDiagram('diagram2')
  const att = getElement(svg, 'polygon')._attributes
  expect(att.points).toBe('152.5,80 167.5,85 152.5,90')
})

test('it should render text', () => {
  const svg = parseDiagram('diagram2')
  const {tspan, _attributes: att} = getElement(svg, 'text')
  expect(att.x).toBe('202.5')
  expect(att.y).toBe('85')
  expect(tspan._attributes.x).toBe('202.5')
  expect(tspan._attributes.dy).toBe('0em')
  expect(tspan._text).toBe('Hello, World!')
})

test('it should render multiline text', () => {
  const svg = parseDiagram('diagram2')
  const {tspan, _attributes: att} = getElement(svg, 'text', 1)

  expect(tspan[0]._text).toBe('Hello,')
  expect(tspan[1]._text).toBe('World!')

  expect(tspan[0]._attributes.dy).toBe('-0.6em')
  expect(tspan[1]._attributes.dy).toBe('1.2em')
  expect(tspan[0]._attributes.x).toBe(att.x)
  expect(tspan[1]._attributes.x).toBe(att.x)
})

test('it should left align text', () => {
  const svg = parseDiagram('diagram2')
  const t1 = getElement(svg, 'text', 0, 1)._attributes

  expect(t1.x).toBe('30')
})

test('it should right align text', () => {
  const svg = parseDiagram('diagram2')
  const t2 = getElement(svg, 'text', 1, 1)._attributes

  expect(t2.x).toBe('130')
})

test('it should top align text', () => {
  const svg = parseDiagram('diagram2')
  const t1 = getElement(svg, 'text', 0, 2)._attributes

  expect(t1.y).toBe('240')
})

test('it should bottom align text', () => {
  const svg = parseDiagram('diagram2')
  const t2 = getElement(svg, 'text', 1, 2)._attributes

  expect(t2.y).toBe('290')
})

test('it should render a path', () => {
  const svg = parseDiagram('diagram2')
  const att = getElement(svg, 'path')._attributes
  expect(att.d).toBe('M 30,120 m 0 0 h 100 v 100 h -100 l 0 -100')
})

test('it should render an image with a local file', () => {
  const svg = parseDiagram('diagram2', true)
  const att = getElement(svg, 'image')._attributes
  expect(att.x).toBe('155')
  expect(att.y).toBe('165')
  expect(att.width).toBe('10')
  expect(att.height).toBe('10')
  expect(att.href).toBe('../images/image.svg')
})

test('it should render an image with a remote url', () => {
  const svg = parseDiagram('diagram2', true)
  const att = getElement(svg, 'image', 1)._attributes
  expect(att.href).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png')
})

test('it should render an image in a shape with a local file', () => {
  const svg = parseDiagram('diagram27', true)
  const s = getElement(svg, 'g')
  const i = getElement(s, 'image')._attributes
  expect(i.href).toBe('../images/image.svg')
})

test('it should apply spacer settings to a shape', () => {
  const svg = parseDiagram('diagram27')
  const s = getElement(svg, 'g')
  const i1 = getElement(s, 'image')._attributes
  const i2 = getElement(s, 'image', 1)._attributes
  const t = getElement(s, 'text')._attributes
  expect(i1.x).toBe('0')
  expect(i1.y).toBe('0')
  expect(i2.x).toBe('15')
  expect(i2.y).toBe('0')
  expect(t.x).toBe('5')
  expect(t.y).toBe('75')
})

test('it should add a margin to the diagram size', () => {
  const diagram = parseDiagram('diagram1')._attributes
  expect(diagram.width).toBe('90')
  expect(diagram.height).toBe('90')
})

test('that a dot takes no space', () => {
  const svg = parseDiagram('diagram3')
  const o = getElement(svg, 'ellipse')._attributes
  const l = getElement(svg, 'line')._attributes
  const o2 = getElement(svg, 'ellipse', 1)._attributes
  expect(o.cx).toBe('45')
  expect(l.x1).toBe('60.5')
  expect(o2.cx).toBe('76')
})

test('that dashes colspan', () => {
  const svg = parseDiagram('diagram4')
  const line = getElement(svg, 'line')._attributes
  const e = getElement(svg, 'ellipse', 1)._attributes
  const e2 = getElement(svg, 'ellipse', 2)._attributes

  expect(line.x1).toBe('80')
  expect(line.x2).toBe('180')
  expect(e.cx).toBe('81')
  expect(e2.cx).toBe('179')
})

test('that pipes rowspan', () => {
  const svg = parseDiagram('diagram5')
  const line = getElement(svg, 'line')._attributes
  const e = getElement(svg, 'ellipse')._attributes
  const text = getElement(svg, 'text')._attributes

  expect(line.y1).toBe('30')
  expect(line.y2).toBe('180')
  expect(e.cy).toBe('65')
  expect(text.y).toBe('165')
})

test('it should apply styling', () => {
  const svg = parseDiagram('diagram6')
  const o1 = getElement(svg, 'ellipse')._attributes
  const o2 = getElement(svg, 'ellipse', 1)._attributes
  const o3 = getElement(svg, 'ellipse', 2)._attributes
  const o4 = getElement(svg, 'ellipse', 3)._attributes

  expect(svg.style._text).toMatch(/\.o { fill: moccasin; stroke: moccasin }/)

  expect(o1['class']).toBe('o')
  expect(o2['class']).toBe('o')
  expect(o3['class']).toBe('o')
  expect(o4['class']).toBe('o')
  expect(o3.style).toBe('stroke: blue')
  expect(o4.style).toBe('stroke: green')
})

test('it should make a unique key for style names that are not valid css names', () => {
  const svg = parseDiagram('diagram6')
  const o5 = getElement(svg, 'ellipse', 4)._attributes

  const className = o5['class']
  expect(svg.style._text).toMatch(`.${className} { stroke: red }`)
})

test('it should apply fonts', () => {
  const svg = parseDiagram('diagram7', true)
  const text1 = getElement(svg, 'text')._attributes
  const text2 = getElement(svg, 'text', 1)._attributes
  const text3 = getElement(svg, 'text', 2)._attributes

  const font1 = '@import url("https://fonts.googleapis.com/css?family=Roboto");'
  const font2 = '@import url("https://fonts.googleapis.com/css?family=Lobster")'
  const font3 = '@font-face { font-family: \'Indie Flower\'; src: url(\'../fonts/IndieFlower-Regular.ttf\''

  expect(svg.defs.style._text).toMatch(font1)
  expect(svg.defs.style._text).toMatch(font2)
  expect(svg.defs.style._text).toMatch(font3)

  expect(svg.style._text).toMatch('text { font-family: Lobster')
  expect(svg.style._text).toMatch('.message2 { font-family: Roboto }')
  expect(svg.style._text).toMatch('.message3 { font-family: Indie Flower }')

  expect(text1.class).not.toMatch('text1')
  expect(text2.class).toMatch('message2')
  expect(text3.class).toMatch('message3')
})

test('it should apply custom margins', () => {
  const svg = parseDiagram('diagram8')
  const o1 = getElement(svg, 'ellipse')._attributes

  expect(svg._attributes.width).toBe('48')
  expect(svg._attributes.height).toBe('132')

  expect(o1.cx).toBe('15')
  expect(o1.cy).toBe('105')
})

test('it should apply custom spacers', () => {
  const svg = parseDiagram('diagram8')
  const o1 = getElement(svg, 'ellipse')._attributes
  const o2 = getElement(svg, 'ellipse', 1)._attributes
  const o3 = getElement(svg, 'ellipse', 2)._attributes

  const spacerHorizontal = 3
  const spacerVertical = 7
  const radius = 5

  let x1 = pf(o1.cx)
  let x2 = pf(o2.cx)
  expect(x2 - x1).toBe(radius * 2 + spacerHorizontal)

  let y1 = pf(o2.cy)
  let y2 = pf(o3.cy)
  expect(y2 - y1).toBe(radius * 2 + spacerVertical)
})

test('it should use variables in style definitions', () => {
  const svg = parseDiagram('diagram8')
  const o1 = getElement(svg, 'ellipse')._attributes
  const o2 = getElement(svg, 'ellipse', 3)._attributes

  expect(svg.style._text).toMatch('.o { fill: rgb(125, 106, 181) }.o2 { fill: rgb(224, 102, 102) }')

  expect(o1.class).toBe('o')
  expect(o2.class).toBe('o2')
})

test('it should fill dynamic widths', () => {
  const svg = parseDiagram('diagram9')
  const e1 = getElement(svg, 'ellipse')._attributes
  const e2 = getElement(svg, 'ellipse', 1)._attributes
  const line = getElement(svg, 'line')._attributes

  const radius = 15
  const x1 = parseInt(e1.cx) - radius
  const x2 = parseInt(e2.cx) + radius
  expect(parseInt(line.x1)).toBe(x1)
  expect(parseInt(line.x2)).toBe(x2)
})

test('it should fill dynamic heights', () => {
  const svg = parseDiagram('diagram10')
  const e1 = getElement(svg, 'ellipse')._attributes
  const e2 = getElement(svg, 'ellipse', 1)._attributes
  const line = getElement(svg, 'line')._attributes

  const radius = 15
  const y1 = parseInt(e1.cy) - radius
  const y2 = parseInt(e2.cy) + radius
  expect(parseInt(line.y1)).toBe(y1)
  expect(parseInt(line.y2)).toBe(y2)
})

test('it should place a layer AT an element', () => {
  const svg = parseDiagram('diagram11')
  const ref1 = getElement(svg, 'ellipse')._attributes
  const ref2 = getElement(svg, 'ellipse', 1)._attributes
  const ref3 = getElement(svg, 'ellipse', 2)._attributes
  const ref4 = getElement(svg, 'ellipse', 3)._attributes
  const ref5 = getElement(svg, 'ellipse', 4)._attributes

  const o1 = getElement(svg, 'ellipse', 0, 1)._attributes
  const o2 = getElement(svg, 'ellipse', 0, 2)._attributes
  const o3 = getElement(svg, 'ellipse', 0, 3)._attributes
  const o4 = getElement(svg, 'ellipse', 0, 4)._attributes
  const o5 = getElement(svg, 'ellipse', 0, 5)._attributes

  const radius = 15
  const smallRadius = 7
  const offset = 7

  expect(o1.cx).toBe(ref1.cx)
  expect(o1.cy).toBe(ref1.cy)

  expect(pf(o2.cx)).toBe(pf(ref2.cx) - radius)
  expect(o2.cy).toBe(ref2.cy)

  expect(pf(o3.cx)).toBe(pf(ref3.cx) - radius + smallRadius)
  expect(o3.cy).toBe(ref3.cy)

  expect(pf(o4.cx)).toBe(pf(ref4.cx) - radius - smallRadius)
  expect(pf(o4.cy)).toBe(pf(ref4.cy) + radius - smallRadius)

  expect(pf(o5.cx)).toBe(pf(ref5.cx))
  expect(pf(o5.cy)).toBe(pf(ref5.cy) + smallRadius + offset)
})

test('it should place a layer AT another layer by zindex', () => {
  const svg = parseDiagram('diagram54')
  const o = getElement(svg, 'ellipse', 0, 2)._attributes

  expect(o.cx).toBe('42')
  expect(o.cy).toBe('31')
})

test('it should place a layer on a PATH between elements', () => {
  const svg = parseDiagram('diagram12')
  const line = getElement(svg, 'line', 0, 1)._attributes

  expect(svg.g[1]._attributes.transform).toBe('rotate(12.995 110 60)')
  expect(line.x1).toBe("43.292")
  expect(line.y1).toBe("60")
  expect(line.x2).toBe("176.708")
  expect(line.y2).toBe("60")
})

test('that elements can be referred to in layers by z-index', () => {
  const svg = parseDiagram('diagram12')
  const line = getElement(svg, 'line', 0, 2)._attributes

  expect(svg.g[2]._attributes.transform).toBe('rotate(116.565 100 80)')
  expect(line.x1).toBe("77.639")
  expect(line.y1).toBe("80")
  expect(line.x2).toBe("122.361")
  expect(line.y2).toBe("80")
})

test('it should render layers by z-index', () => {
  const svg = parseDiagram('diagram13')
  const rect1 = getElement(svg, 'rect', 0, 0)._attributes
  const rect2 = getElement(svg, 'rect', 0, 1)._attributes
  const rect3 = getElement(svg, 'rect', 0, 2)._attributes

  expect(rect1['class']).toBe('r2')
  expect(rect2['class']).toBe('r1')
  expect(rect3['class']).toBe('r3')
})

test('it should rotate a layer', () => {
  const svg = parseDiagram('diagram14')
  const text = getElement(svg, 'text', 0, 2)._attributes

  expect(svg.g[2]._attributes.transform).toBe('rotate(-16.39 130 70) translate(2.5 15) rotate(16.39 127.5 55) translate(-2.5 -15)')
  expect(text.x).toBe('130')
  expect(text.y).toBe('70')
})

test('it should fill a layer`s width using path', () => {
  const svg = parseDiagram('diagram15')
  const line = getElement(svg, 'line', 0, 1)._attributes

  expect(line.x1).toBe('150')
  expect(line.x2).toBe('295')
})

test('it should fill a layer`s width using the default layer`s width', () => {
  const svg = parseDiagram('diagram15')
  const line = getElement(svg, 'line', 0, 2)._attributes

  expect(line.x1).toBe('30')
  expect(line.x2).toBe('415')
})

test('it should fill a layer`s width using another layer`s width', () => {
  const svg = parseDiagram('diagram15')
  const line = getElement(svg, 'line', 0, 3)._attributes

  expect(line.x1).toBe('170')
  expect(line.x2).toBe('315')
})

test('it should fill a layer`s width using a fixed width', () => {
  const svg = parseDiagram('diagram15')
  const line = getElement(svg, 'line', 0, 4)._attributes

  expect(line.x1).toBe('217.5')
  expect(line.x2).toBe('227.5')
})

test('it should fill a layer`s width using only space available in the layer`s grid', () => {
  const svg = parseDiagram('diagram15')
  const line = getElement(svg, 'line', 0, 5)._attributes

  expect(line.x1).toBe(line.x2)
})

test('it should fill a layer`s height using the default layer`s height', () => {
  const svg = parseDiagram('diagram16')
  const line = getElement(svg, 'line', 0, 1)._attributes

  expect(line.y1).toBe('30')
  expect(line.y2).toBe('240')
})

test('it should fill a layer`s height using another layer`s height', () => {
  const svg = parseDiagram('diagram16')
  const line = getElement(svg, 'line', 0, 2)._attributes

  expect(line.y1).toBe('30')
  expect(line.y2).toBe('240')
})

test('it should fill a layer`s height using a fixed height', () => {
  const svg = parseDiagram('diagram16')
  const line = getElement(svg, 'line', 0, 3)._attributes

  expect(line.y1).toBe('30')
  expect(line.y2).toBe('45')
})

test('it should fill a layer`s height using only space available in the layer`s grid', () => {
  const svg = parseDiagram('diagram16', true)
  const line = getElement(svg, 'line', 0, 4)._attributes

  expect(line.y1).toBe('30')
  expect(line.y2).toBe('50') // From y1 to y2 should be the height of the vertical-spacer
})

test('it should not overfill a negative height offset', () => {
  const svg = parseDiagram('diagram16')
  const line = getElement(svg, 'line', 0, 5)._attributes

  expect(line.y1).toBe('130')
  expect(line.y2).toBe('130')
})

test('it should render a shape', () => {
  const svg = parseDiagram('diagram17')
  const s1 = getElement(svg, 'g')._attributes
  const s2 = getElement(svg, 'g', 1)._attributes
  expect(s1.transform).toBe('translate(30 30)')
  expect(s2.transform).toBe('translate(30 70)')
})

test('it should render shape parameters', () => {
  const svg = parseDiagram('diagram18')
  const s1 = getElement(svg, 'g')
  expect(s1.g[1].text.tspan._text).toBe('Two')
})

test('it should scale shapes', () => {
  const svg = parseDiagram('diagram18')
  const s1 = getElement(svg, 'g')._attributes
  expect(s1.transform).toMatch('scale(0.7 0.7)')
})

test('it should render plugin elements', () => {
  const svg = parseDiagram('diagram19')
  const rect = getElement(svg, 'rect')._attributes
  const {tspan, _attributes: text} = getElement(svg, 'text')

  expect(rect.x).toBe('100')
  expect(rect.y).toBe('80')
  expect(rect.width).toBe('80')
  expect(rect.height).toBe('25')

  expect(text.x).toBe('140')
  expect(text.y).toBe('92.5')
  expect(tspan._text).toBe('Hello, World!')
})

test('it should render raw svg', () => {
  const svg = parseDiagram('diagram20')
  const att = getElement(svg, 'ellipse', 0, 1)._attributes
  expect(att.display).toBe('none')
})

test('it should show a debug grid', () => {
  const svg = parseDiagram('diagram20')
  const rect1 = getElement(svg, 'rect')._attributes
  const rect2 = getElement(svg, 'rect', 1)._attributes
  const rect3 = getElement(svg, 'rect', 2)._attributes
  const rect9 = getElement(svg, 'rect', 7)._attributes

  expect(rect1.style).toMatch('fill: white')
  expect(rect2.style).toMatch('fill: lightblue')
  expect(rect3.style).toMatch('fill: white')
  expect(rect9.style).toMatch('fill: lightblue')
})

test('it should show a debug grid for shape', () => {
  const svg = parseDiagram('diagram20')
  const shape = getElement(svg, 'g', 0, 1)
  const rect1 = getElement(shape, 'rect', 0)._attributes
  const rect2 = getElement(shape, 'rect', 1)._attributes
  expect(rect1.style).toMatch('fill: lightgray')
  expect(rect2.style).toMatch('fill: lightpink')
})

test('it should save to a file', () => {
  parseDiagram('diagram1', true)
  const xml = fs.readFileSync(path.resolve(basePath, 'output', 'diagram1.svg'), 'utf-8')
  const js = XmlJS.xml2js(xml, {compact: true})
  const att = getElement(js.svg, 'ellipse')._attributes
  expect(att.cx).toBe('45')
})

test('it should render a layer\'s svg tag', () => {
  const svg = parseDiagram('diagram1')
  const att = getElement(svg, 'ellipse', 0, 1)._attributes
  expect(att.cx).toBe('45')
  expect(att.cy).toBe('45')
  expect(svg.g[1]._attributes.transform).toBe('translate(25,25)')
})

test('it should fill columns evenly when they are already determined', () => {
  const svg = parseDiagram('diagram30')
  const o1 = getElement(svg, 'ellipse', 0)._attributes
  const o2 = getElement(svg, 'ellipse', 1)._attributes
  expect(o1.cx).toBe('50')
  expect(o2.cx).toBe('130')
})

test('it should align multiline text top-left', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 8)._attributes
  expect(t.x).toBe('270')
  expect(t.y).toBe('230')
  expect(t.class).toMatch('-pln-diagram-at')
  expect(t.class).toMatch('-pln-diagram-al')
})

test('it should align multiline text top', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 7)._attributes
  expect(t.x).toBe('200')
  expect(t.y).toBe('230')
  expect(t.class).toMatch('-pln-diagram-at')
  expect(t.class).toMatch('-pln-diagram-ac')
})

test('it should align multiline text top-right', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 6)._attributes
  expect(t.x).toBe('130')
  expect(t.y).toBe('230')
  expect(t.class).toMatch('-pln-diagram-at')
  expect(t.class).toMatch('-pln-diagram-ar')
})

test('it should align multiline text left', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 5)._attributes
  expect(t.x).toBe('270')
  expect(t.y).toBe('180')
  expect(t.class).toMatch('-pln-diagram-am')
  expect(t.class).toMatch('-pln-diagram-al')
})

test('it should align multiline text middle', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 4)._attributes
  expect(t.x).toBe('200')
  expect(t.y).toBe('180')
  expect(t.class).toMatch('-pln-diagram-am')
  expect(t.class).toMatch('-pln-diagram-ac')
})

test('it should align multiline text right', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 3)._attributes
  expect(t.x).toBe('130')
  expect(t.y).toBe('180')
  expect(t.class).toMatch('-pln-diagram-am')
  expect(t.class).toMatch('-pln-diagram-ar')
})

test('it should align multiline text bottom-left', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 2)._attributes
  expect(t.x).toBe('270')
  expect(t.y).toBe('130')
  expect(t.class).toMatch('-pln-diagram-ab')
  expect(t.class).toMatch('-pln-diagram-al')
})

test('it should align multiline text bottom', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 1)._attributes
  expect(t.x).toBe('200')
  expect(t.y).toBe('130')
  expect(t.class).toMatch('-pln-diagram-ab')
  expect(t.class).toMatch('-pln-diagram-ac')
})

test('it should align multiline text bottom-right', () => {
  const svg = parseDiagram('diagram31')
  const t = getElement(svg, 'text', 0)._attributes
  expect(t.x).toBe('130')
  expect(t.y).toBe('130')
  expect(t.class).toMatch('-pln-diagram-ab')
  expect(t.class).toMatch('-pln-diagram-ar')
})

test('it should fill both width and height for a layer', () => {
  const svg = parseDiagram('diagram32')
  const r = getElement(svg, 'rect', 0, 1)._attributes
  expect(r.width).toBe('100')
  expect(r.height).toBe('100')
})

test('it should use default style for text alignment', () => {
  const svg = parseDiagram('diagram33')
  const t = getElement(svg, 'text')._attributes
  expect(t.x).toBe('180')
  expect(t.y).toBe('180')
})

test('that text aligns with the grid', () => {
  const svg = parseDiagram('diagram34')
  const t1 = getElement(svg, 'text')._attributes
  const t2 = getElement(svg, 'text', 1)._attributes
  const t3 = getElement(svg, 'text', 2)._attributes
  const t4 = getElement(svg, 'text', 3)._attributes
  expect(t1.x).toBe('330')
  expect(t1.y).toBe('130')
  expect(t2.x).toBe('180')
  expect(t2.y).toBe('130')
  expect(t3.x).toBe('405')
  expect(t3.y).toBe('180')
  expect(t4.x).toBe('330')
  expect(t4.y).toBe('430')
  expect(t1.class).toMatch('-pln-diagram-al')
  expect(t1.class).toMatch('-pln-diagram-ab')
})

test('it should translate diagrams that have elements in the negative coordinate space', () => {
  const svg = parseDiagram('diagram35')
  const e = getElement(svg, 'ellipse', 0, 1)._attributes
  expect(svg._attributes.viewBox).toBe('-175 -200 385 360')
  expect(e.cx).toBe('-95')
  expect(e.cy).toBe('-120')
})

test('WHEN there are no newlines, it should apply no vertical space before the first element in shape', () => {
  const svg = parseDiagram('diagram36')
  const s1 = getElement(svg, 'g')
  const s3 = getElement(svg, 'g', 2)
  const e1 = getElement(s1, 'ellipse')._attributes
  const e3 = getElement(s3, 'ellipse')._attributes
  expect(s1._attributes.transform).toBe('translate(30 55)')
  expect(s3._attributes.transform).toBe('translate(110 55)')
  expect(e1.cy).toBe('10')
  expect(e3.cy).toBe('10')
})

test('WHEN there are two newlines, it should apply vertical space before the first element in shape', () => {
  const svg = parseDiagram('diagram36')
  const s2 = getElement(svg, 'g', 1)
  const s4 = getElement(svg, 'g', 3)
  const e2 = getElement(s2, 'ellipse')._attributes
  const e4 = getElement(s4, 'ellipse')._attributes
  expect(s2._attributes.transform).toBe('translate(70 30)')
  expect(s4._attributes.transform).toBe('translate(150 45)')
  expect(e2.cy).toBe('60')
  expect(e4.cy).toBe('30')
})

test('it should apply grid-align to shapes', () => {
  const svg = parseDiagram('diagram37')
  const s1 = getElement(svg, 'g', 0)
  const s2 = getElement(svg, 'g', 1)
  const e1 = getElement(s1, 'ellipse')._attributes
  const e2 = getElement(s2, 'ellipse')._attributes
  expect(s1._attributes.transform).toBe('translate(310 210)')
  expect(s2._attributes.transform).toBe('translate(330 230)')
  expect(e1.cx).toBe('10')
  expect(e1.cy).toBe('10')
  expect(e2.cx).toBe('10')
  expect(e2.cy).toBe('10')
})

test('it should make the path on the start point', () => {
  const svg = parseDiagram('diagram38')
  const l = getElement(svg, 'line', 0, 1)._attributes
  expect(l.x1).toBe('45')
})

test('it should make the path on the end point', () => {
  const svg = parseDiagram('diagram38')
  const l = getElement(svg, 'line', 0, 2)._attributes
  expect(l.x1).toBe('280')
})

test('it should make the path on the middle point', () => {
  const svg = parseDiagram('diagram38')
  const l = getElement(svg, 'line', 0, 3)._attributes
  expect(l.x1).toBe('432.5')
})

test('it should index into shape elements', () => {
  const svg = parseDiagram('diagram39')
  expect(svg.g[1]._attributes.transform).toBe('rotate(112.834 80 92.5)')
  expect(svg.g[2]._attributes.transform).toBe('rotate(67.166 120 92.5)')
  expect(svg.g[3]._attributes.transform).toBe('rotate(9.728 202.5 60)')
  const shape = svg.g[3].g
  expect(shape._attributes.transform).toBe('translate(113.724 59.5)')
  const line = getElement(shape, 'line')._attributes
  expect(line.x1).toBe('0')
  expect(line.y1).toBe('0.5')
  expect(line.x2).toBe('177.553')
  expect(line.y2).toBe('0.5')
})

test('it should fill a minimum horizontal when the space is less than the minimum', () => {
  const svg = parseDiagram('diagram40')
  const r = getElement(svg, 'rect')._attributes
  const l1 = getElement(svg, 'line')._attributes
  const l2 = getElement(svg, 'line', 1)._attributes
  const l3 = getElement(svg, 'line', 2)._attributes
  expect(r.x).toBe('55')
  expect(parseFloat(l1.x2) - parseFloat(l1.x1)).toBe(30)
  expect(parseFloat(l2.x2) - parseFloat(l2.x1)).toBe(50)
  expect(parseFloat(l3.x2) - parseFloat(l3.x1)).toBe(40)
})

test('it should fill a minimum vertical when the space is less than the minimum', () => {
  const svg = parseDiagram('diagram41')
  const r2 = getElement(svg, 'rect', 1)._attributes
  const l1 = getElement(svg, 'line')._attributes
  const l2 = getElement(svg, 'line', 1)._attributes
  const l3 = getElement(svg, 'line', 2)._attributes
  expect(r2.y).toBe('60')
  expect(parseFloat(l1.y2) - parseFloat(l1.y1)).toBe(30)
  expect(parseFloat(l2.y2) - parseFloat(l2.y1)).toBe(50)
  expect(parseFloat(l3.y2) - parseFloat(l3.y1)).toBe(40)
})

test('it should fill a shape\'s height', () => {
  const svg = parseDiagram('diagram59')
  const s = getElement(svg, 'g')
  const r = getElement(s, 'rect')._attributes
  expect(r.width).toBe('100')
  expect(r.height).toBe('200')
})

test('when a shape\'s grid aligment is different from the diagram\'s alignment, it should apply the shape\'s alignment', () => {
  const svg = parseDiagram('diagram68')
  const s = getElement(svg, 'g')
  const t = getElement(s, 'text')._attributes
  expect(t.x).toBe('100')
  expect(t.y).toBe('100')
})

test('it should notify a spec parsed listener', () => {
  const svg = parseDiagram('diagram59')
  expect(svg.style._text).toMatch(/\.test-spec-parsed { text-anchor: start; }/)
})

test('it should give empty columns an equal amount of space', () => {
  const svg = parseDiagram('diagram69')
  const r2 = getElement(svg, 'rect', 1)._attributes
  const r3 = getElement(svg, 'rect', 2)._attributes
  expect(r2.x).toBe('63.333')
  expect(r3.x).toBe('196.667')
})

test('it should give empty rows an equal amount of space', () => {
  const svg = parseDiagram('diagram70')
  const r2 = getElement(svg, 'rect', 1)._attributes
  const r3 = getElement(svg, 'rect', 2)._attributes
  expect(r2.y).toBe('63.333')
  expect(r3.y).toBe('196.667')
})

test('it should take a shape\'s size and pass into shape layout', () => {
  const svg = parseDiagram('diagram72')
  const s1 = getElement(svg, 'g')
  const s2 = getElement(svg, 'g', 1)
  const s3 = getElement(svg, 'g', 2)
  const r1 = getElement(s1, 'rect')._attributes
  const r2 = getElement(s2, 'rect')._attributes
  const r3 = getElement(s3, 'rect')._attributes
  expect(r1.width).toBe('300')
  expect(r2.width).toBe('100')
  expect(r3.width).toBe('10')
})

test('it should fill dynamic widths with spacers', () => {
  const svg = parseDiagram('diagram73')
  const line1 = getElement(svg, 'line', 0, 1)._attributes
  const line2 = getElement(svg, 'line', 0, 2)._attributes
  const line3 = getElement(svg, 'line', 0, 3)._attributes
  const line4 = getElement(svg, 'line', 0, 4)._attributes
  const line5 = getElement(svg, 'line', 0, 5)._attributes
  const line6 = getElement(svg, 'line', 0, 6)._attributes
  expect(line1.x1).toBe('50')
  expect(line2.x1).toBe('50')
  expect(line3.x1).toBe('50')
  expect(line4.x1).toBe('50')
  expect(line5.x1).toBe('45')
  expect(line6.x1).toBe('50')
  expect(parseFloat(line1.x2) - parseFloat(line1.x1)).toBe(40)
  expect(parseFloat(line2.x2) - parseFloat(line2.x1)).toBe(30)
  expect(parseFloat(line3.x2) - parseFloat(line3.x1)).toBe(30)
  expect(parseFloat(line4.x2) - parseFloat(line4.x1)).toBe(10)
  expect(parseFloat(line5.x2) - parseFloat(line5.x1)).toBe(0)
  expect(parseFloat(line6.x2) - parseFloat(line6.x1)).toBe(40)
  const rect1 = getElement(svg, 'rect', 0, 1)._attributes
  const rect2 = getElement(svg, 'rect', 0, 2)._attributes
  const rect3 = getElement(svg, 'rect', 0, 3)._attributes
  const rect4 = getElement(svg, 'rect', 0, 4)._attributes
  const rect5 = getElement(svg, 'rect', 0, 5)._attributes
  const rect6 = getElement(svg, 'rect', 0, 6)._attributes
  expect(rect1.x).toBe('80')
  expect(rect2.x).toBe('80')
  expect(rect3.x).toBe('80')
  expect(rect4.x).toBe('80')
  expect(rect5.x).toBe('85')
  expect(rect6.x).toBe('80')
})

test('it should fill dynamic heights with spacers', () => {
  const svg = parseDiagram('diagram74')
  const line1 = getElement(svg, 'line', 0, 1)._attributes
  const line2 = getElement(svg, 'line', 0, 2)._attributes
  const line3 = getElement(svg, 'line', 0, 3)._attributes
  const line4 = getElement(svg, 'line', 0, 4)._attributes
  const line5 = getElement(svg, 'line', 0, 5)._attributes
  const line6 = getElement(svg, 'line', 0, 6)._attributes
  expect(line1.y1).toBe('50')
  expect(line2.y1).toBe('50')
  expect(line3.y1).toBe('50')
  expect(line4.y1).toBe('50')
  expect(line5.y1).toBe('50')
  expect(line6.y1).toBe('50')
  expect(parseFloat(line1.y2) - parseFloat(line1.y1)).toBe(40)
  expect(parseFloat(line2.y2) - parseFloat(line2.y1)).toBe(30)
  expect(parseFloat(line3.y2) - parseFloat(line3.y1)).toBe(30)
  expect(parseFloat(line4.y2) - parseFloat(line4.y1)).toBe(10)
  expect(parseFloat(line5.y2) - parseFloat(line5.y1)).toBe(0)
  expect(parseFloat(line6.y2) - parseFloat(line6.y1)).toBe(40)
  const rect1 = getElement(svg, 'rect', 0, 1)._attributes
  const rect2 = getElement(svg, 'rect', 0, 2)._attributes
  const rect3 = getElement(svg, 'rect', 0, 3)._attributes
  const rect4 = getElement(svg, 'rect', 0, 4)._attributes
  const rect5 = getElement(svg, 'rect', 0, 5)._attributes
  const rect6 = getElement(svg, 'rect', 0, 6)._attributes
  expect(rect1.y).toBe('80')
  expect(rect2.y).toBe('80')
  expect(rect3.y).toBe('80')
  expect(rect4.y).toBe('80')
  expect(rect5.y).toBe('90')
  expect(rect6.y).toBe('80')
})

test('it should provide box information when using box mode', () => {
  const svg = parseDiagram('diagram75')
  const p1 = getElement(svg, 'path', 1, 1)._attributes
  const p2 = getElement(svg, 'path', 1, 2)._attributes
  const p3 = getElement(svg, 'path', 1, 3)._attributes
  const p4 = getElement(svg, 'path', 1, 4)._attributes
  const p5 = getElement(svg, 'path', 1, 5)._attributes
  const p6 = getElement(svg, 'path', 1, 6)._attributes
  const p7 = getElement(svg, 'path', 1, 7)._attributes
  const p8 = getElement(svg, 'path', 1, 8)._attributes
  const p9 = getElement(svg, 'path', 1, 9)._attributes
  const p10 = getElement(svg, 'path', 1, 10)._attributes
  const p11 = getElement(svg, 'path', 1, 11)._attributes
  const p12 = getElement(svg, 'path', 1, 12)._attributes
  expect(p1.d).toMatch('M 270,145 m 16 0 ')
  expect(p2.d).toMatch('M 379.5,80 m 0.5 16 ')
  expect(p3.d).toMatch('M 385,145 m 89 0 ')
  expect(p4.d).toMatch('M 220,170 m 0 16 ')
  expect(p5.d).toMatch('M 130,225 m 16 10 ')
  expect(p6.d).toMatch('M 220,240 m 0 44 ')
  expect(p7.d).toMatch('M 430,170 m 110 16 ')
  expect(p8.d).toMatch('M 430,225 m 184 10 ')
  expect(p9.d).toMatch('M 430,240 m 110 44 ')
  expect(p10.d).toMatch('M 270,260 m 16 65 ')
  expect(p11.d).toMatch('M 379.5,260 m 0.5 114 ')
  expect(p12.d).toMatch('M 385,260 m 89 65 ')
})
