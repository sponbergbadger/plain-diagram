const NumberedLines = require('./NumberedLines')
const Util = require('./Util')

module.exports = class InputFile {

  constructor(text) {
    this.text = text
    this.fileSections = parseParts(text)
    this.numberedLines = new NumberedLines(text)
  }

}

function parseParts(text) {
  let match = text.match(/([\s\S]+?)\nlayout:([\s\S]+)/m)
  if (match == null) {
    throw new Error('Invalid specification: must provide a spec followed by a layout section')
  }
  let spec = new NumberedLines(match[1])
  let part2 = match[2]
  let layout
  let shapes

  match = part2.match(/([\s\S]+?)(\nshape:[\s\S]*)/m)
  if (match == null) {
    layout = new NumberedLines(part2, spec.lines.length + 1)
  } else {
    layout = new NumberedLines(match[1], spec.lines.length + 1)
    let shapeLineNumber = spec.lines.length + layout.lines.length

    shapes = match[2].split(/\nshape:/m)

    shapes.shift() // first line is empty due to split
    shapeLineNumber++

    for (var i = 0; i < shapes.length; i++) {
      shapes[i] = new NumberedLines(shapes[i], shapeLineNumber)
      shapeLineNumber += shapes[i].lines.length
    }
  }

  spec = moveToTop(spec, 'settings')
  spec = moveToTop(spec, 'variable')
  spec = moveSvgToBottom(spec)

  return {
    spec,
    layout,
    shapes
  }
}

function moveToTop(numberedLines, type) {
  const newlines = []
  const variables = []
  let line
  let arr = newlines
  while ((line = numberedLines.pop()) != null) {
    const commentI = Util.commentIndex(line)
    if (commentI != -1) {
     line = line.substring(0, commentI)
    }
    if (/^\S+/.test(line)) {
      if (line.startsWith(`${type}:`)) {
        arr = variables
      } else {
        arr = newlines
      }
    }
    arr.push({ lineNumber: numberedLines.getLineNumber(), string: line })
  }
  return new NumberedLines(null, null, [...variables, ...newlines])
}

function moveSvgToBottom(numberedLines) {
  const newlines = []
  const svg = []
  let line
  let arr = newlines
  while ((line = numberedLines.pop()) != null) {
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
    arr.push({ lineNumber: numberedLines.getLineNumber(), string: line })
  }
  return new NumberedLines(null, null, [...newlines, ...svg])
}
