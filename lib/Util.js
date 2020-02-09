const fs = require('fs')
const path = require('path')

module.exports = {

  commentIndex: (line) => {
    if (line.startsWith('//')) {
      return 0
    } else {
      return line.indexOf(' //')
    }
  },

  addMessageToError: (message, error) => {
    let stackError = error.stack
    if (error.lineNumber != null) {
      if (stackError.startsWith('Error: ')) {
        stackError = stackError.substring(7)
      }
      message = `${message}\n\n ${error.message}\n`
    }
    let e = new Error(`${message}\n`)
    e.stack = e.stack.split('\n').slice(0,2).join('\n') + '\n ' + stackError
    return e
  },

  loadCustomCode: (filePath) => {
    const basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1)

    const code = fs.readFileSync(filePath, 'utf-8')

    // Turn requires into full path
    let buf = ''
    for (var line of code.split('\n')) {
      let i = line.indexOf('require(')
      if (i != -1) {
        let i2 = line.indexOf(')', i + 9)
        let relPath = line.substring(i + 9, i2 - 1)
        if (relPath.indexOf('/') != -1) {
          let fullPath = path.resolve(basePath, relPath)
          line = line.substring(0, i + 9) + fullPath + line.substring(i2 - 1)
        }
      }
      buf += line + '\n'
    }
    return buf
  },

  stringify1(obj) {
    if (obj == null) {
      return 'null'
    }
    return JSON.stringify(obj, null, 1).replace(/\s+/g, ' ')
  },

  htmlEntities(str) {
    // https://stackoverflow.com/questions/14129953/how-to-encode-a-string-in-javascript-for-displaying-in-html
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  varRep(str, variables) {
    if (str === undefined) {
      return undefined
    }
    if (variables == null) {
      return str
    }

    const re = /(.*?)(\$[a-zA-Z0-9\-_]+)([^$]*)/g

    let numMatches = 0

    let newStr = ''
    var match;
    while ((match = re.exec(str)) !== null) {
      const r = variables[match[2].substring(1)]
      newStr += match[1] + r + match[3]
      numMatches++
    }

    if (numMatches === 0) {
      return str
    } else {
      return newStr
    }
  },

  parseKeyContent(line, inputFile, numTokens, variables) {
    let contentI = line.indexOf(':')
    const key = line.substring(0, contentI).trim()
    contentI += 1

    line = line.substring(contentI).trim()

    let match

    const lines = []
    lines.push(line)

    const re = new RegExp(`^[ \\t]{${contentI},}(\\S.*)`, 'g');

    while ((match = inputFile.getPeekMatch(re)) != null) {
      lines.push(inputFile.pop(false).string.trim())
    }
    let val = lines[lines.length - 1]
    if (lines.length > 0 && val.length === 0) {
      lines.pop(false)
    }
    let content = ''
    for (var l of lines) {
      content += l + ' '
    }
    content = content.trim()

    content = content.replace(/\s+/g, ' ').trim()
    // Splits on white space except in parenthesis
    const words = content.split(/(?!\(.*)\s(?![^(]*?\))/)

    let wordI = 0

    const tokens = []
    while (tokens.length < numTokens) {
      tokens.push(this.varRep(words[wordI], variables))
      wordI++
    }

    content = ''
    while (wordI < words.length) {
      content += this.varRep(words[wordI], variables) + ' '
      wordI++
    }
    content = content.trim()

    return {
      key,
      tokens,
      content,
      contentLines: lines,
    }
  },

  extractParams(line, paramMap, key) {
    if (line === undefined) {
      return undefined
    }
    let params = []
    match = line.match(/^(\S+)\s*\((.*)\)(.*)/)
    if (match != null) {
       params = match[2].trim().split(/[,\s]+/)
       line = match[1] + match[3]
    }
    // for (var i = 0; i < params.length; i++) {
    //   params[i] = this.varRep(params[i], variables).trim()
    // }
    paramMap[key] = params
    return line
  },

  booleanOrString(val) {
    if (val === 'true') {
      return true
    } else if (val === 'false') {
      return false
    } else {
      return val
    }
  },

  relativeAbsoluteOrRemoteUrl(url, basePath, outputPath, convertRelativeToAbsolute = false) {
    if (!url.startsWith('http://')
        && !url.startsWith('https://')
        && !url.startsWith('/')) {
      // Relative path to image
      const absoluteUrl = path.resolve(basePath, url)
      if (outputPath == null) {
        // None specified. Use relative from input file.
        outputPath = basePath
      } else {
        outputPath = path.dirname(outputPath);
      }
      if (convertRelativeToAbsolute) {
        url = absoluteUrl
      } else {
        url = path.relative(outputPath, absoluteUrl)
      }
    }
    return url
  },

  round(v, decimals = 3) {
    const m = Math.pow(10, decimals)
    return Math.round(v * 1000) / 1000
  }

}
