module.exports = class NumberedLines {

  // Two constructors
  // One:
  //   Parses using the parameters:
  //     - text is the text
  //     - lineNumber is the lineNumber of the first line of text
  //
  // Two:
  //   Internal data set to lines
  constructor(inputFile, text, lineNumber = 1, lines = null) {
    this.inputFile = inputFile
    if (lines == null) {
      this.lines = []
      for (var line of text.split('\n')) {
        this.lines.push({
          lineNumber: lineNumber,
          string: line
        })
        lineNumber++
      }
    } else {
      this.lines = lines
    }

    this.resetIndex = 0
    this.reset()
  }

  peek() {
    if (this.index === this.lines.length) {
      return null
    } else {
      this.lineIndex = this.index
      return this.lines[this.lineIndex].string
    }
  }

  pop(moveProcessingLineMark = true) {
    if (this.index === this.lines.length) {
      return null
    } else {
      this.lineIndex = this.index
      this.index++
      if (moveProcessingLineMark) {
        this.processingLine = this.lineIndex
      }
      return this.lines[this.lineIndex].string
    }
  }

  getLineNumber(lineIndex = this.lineIndex) {
    return this.lines[lineIndex].lineNumber
  }

  getLineNumberWithIndent(lineIndex, errorLine = false, indent = 8) {
    let l = '' + this.getLineNumber(lineIndex)
    if (errorLine) {
      l = '> ' + l
    }
    while (l.length < indent) {
      l = ' ' + l
    }
    return l
  }

  reset() {
    this.lineIndex = this.resetIndex
    this.index = this.lineIndex
    this.processingLine = this.lineIndex
  }

  lockResetIndex() {
    this.resetIndex = this.index
  }

  userError(msg) {
   this.inputFile.userError(msg, this.getLineNumber(this.processingLine))
  }

}
