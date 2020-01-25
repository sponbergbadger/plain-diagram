const fs = require('fs')
const path = require('path')

const package = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json')))

const readmePath = path.resolve(__dirname, '../../README.md')

let readme = fs.readFileSync(readmePath, 'utf-8')
const match = readme.match(/(## Version[\s\S]+?)\d+\.\d+.\d+(\s.*)/)

const newSection = `${match[1]}${package.version}${match[2]}`

readme = readme.substring(0, match.index)
readme += newSection

fs.writeFileSync(readmePath, readme)
