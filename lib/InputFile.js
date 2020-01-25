const NumberedLines = require('./NumberedLines')
const Util = require('./Util')

module.exports = class InputFile {

  // Two constructors
  // One:
  //   Parses the text
  //
  // Two:
  //   Parses another InputFile keeping track of the original line numbers
  constructor(text, numberedLines) {
    if (numberedLines == null) {
      this.numberedLines = new NumberedLines(this, text)
      this.fileSections = parseParts(this, text)
    } else {
      const lineNumber = numberedLines.getLineNumber()
      let text = ''
      let line
      while ((line = numberedLines.pop()) != null) {
        text += line.string
        if (numberedLines.peek() != null) {
          text += '\n'
        }
      }
      this.fileSections = parseParts(numberedLines.inputFile, text, lineNumber)
    }
  }

  userError(msg, lineNumber) {
    const lineIndex = lineNumber - 1
    const errorLineNumber = this.numberedLines.getLineNumber(lineIndex)

    let index = lineIndex - 3
    if (index < 0) {
      index = 0
    }

    let stopIndex = lineIndex + 3
    if (stopIndex >= this.numberedLines.lines.length) {
      stopIndex = this.numberedLines.lines.length - 1
    }

    let buf = `${msg}\n\n`
    while (index <= stopIndex) {
      const errorLine = index === lineIndex
      buf += `${this.numberedLines.getLineNumberWithIndent(index, errorLine)} | ${this.numberedLines.lines[index].string}\n`
      index++
    }

    const error = new Error(buf)
    error.lineNumber = errorLineNumber
    throw error
   }

}

function parseParts(inputFile, text, offset = 1) {
  let match = text.match(/([\s\S]+?)\nlayout:([\s\S]+)/m)
  if (match == null) {
    if (offset != 1) {
      // In a shape, move the pointer up to the shape declaration line
      offset -= 1
    }
    return inputFile.userError('Invalid specification: must provide a spec followed by a layout section', offset)
  }
  let spec = new NumberedLines(inputFile, match[1], offset)
  let part2 = match[2]
  let layout
  let shapes

  if (offset === null) {
    offset = 0
  }

  match = part2.match(/([\s\S]+?)(\nshape:[\s\S]*)/m)
  if (match == null) {
    layout = new NumberedLines(inputFile, part2, spec.lines.length + offset)
  } else {
    layout = new NumberedLines(inputFile, match[1], spec.lines.length + offset)
    let shapeLineNumber = spec.lines.length + layout.lines.length

    shapes = match[2].split(/\nshape:/m)

    shapes.shift() // first line is empty due to split
    shapeLineNumber++

    for (var i = 0; i < shapes.length; i++) {
      shapes[i] = new NumberedLines(inputFile, shapes[i], shapeLineNumber + offset - 1)
      shapeLineNumber += shapes[i].lines.length
    }
  }

  stripComments(spec)
  stripComments(layout)
  if (shapes != null) {
    for (var s of shapes) {
      stripComments(s)
    }
  }

  spec = moveToTop(inputFile, spec, 'settings')
  spec = moveToTop(inputFile, spec, 'variable')
  spec = moveSvgToBottom(inputFile, spec)

  layout.pop()
  layout.lockResetIndex()

  return {
    spec,
    layout,
    shapes
  }
}

function stripComments(numberedLines) {
  let strippedLines = []
  for (var i = 0; i < numberedLines.lines.length; i++) {
    let line = numberedLines.lines[i]
    const commentI = Util.commentIndex(line.string)
    if (commentI != -1) {
     line.string = line.string.substring(0, commentI)
    }
    if (true || !line.startsWith('//')) {
      strippedLines.push(line)
    }
  }
  numberedLines.lines = strippedLines
}

function moveToTop(inputFile, numberedLines, type) {
  const newlines = []
  const variables = []
  let line
  let arr = newlines
  while ((line = numberedLines.pop()) != null) {
    if (/^\S+/.test(line.string)) {
      if (line.string.startsWith(`${type}:`)) {
        arr = variables
      } else {
        arr = newlines
      }
    }
    arr.push({ lineNumber: numberedLines.getLineNumber(), string: line.string })
  }
  return new NumberedLines(inputFile, null, null, [...variables, ...newlines])
}

function moveSvgToBottom(inputFile, numberedLines) {
  const newlines = []
  const svg = []
  let line
  let arr = newlines
  while ((line = numberedLines.pop()) != null) {
    if (/^\S+/.test(line.string)) {
      if (line.string.startsWith('svg:')) {
        arr =  svg
      } else {
        arr = newlines
      }
    }
    arr.push({ lineNumber: numberedLines.getLineNumber(), string: line.string })
  }
  return new NumberedLines(inputFile, null, null, [...newlines, ...svg])
}
