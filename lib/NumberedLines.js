module.exports = class NumberedLines {

  // Two constructors
  // One:
  //   Parses using the parameters:
  //     - text is the text
  //     - lineNumber is the lineNumber of the first line of text
  //
  // Two:
  //   Internal data set to lines
  constructor(text, lineNumber = 1, lines = null) {
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

    this.reset()
  }

  peek() {
    this.lineIndex = this.index
    return this.lines[this.lineIndex].string
  }

  pop() {
    if (this.index === this.lines.length) {
      return null
    } else {
      this.lineIndex = this.index
      this.index++
      return this.lines[this.lineIndex].string
    }
  }

  getLineNumber() {
    return this.lines[this.lineIndex].lineNumber
  }

  reset() {
    this.lineIndex = 0
    this.index = 0
  }

}
