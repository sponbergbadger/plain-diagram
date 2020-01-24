const InputFile = require('../lib/InputFile');

const file1 =`
circle:
  o: 5

shape:
  s: circles

variable:
  blue: #00f

layout:

  o
  s

shape:circles

  o o

shape:circles3

  o o o

shape:circles4

settings:
  horizontal-spacer: 1

layout:

  o o o o
`

test('it should parse the file into sections', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  expect(spec.lines[0].lineNumber).toBe(8)
  expect(spec.lines[0].string).toBe('variable:')
  expect(spec.lines[3].lineNumber).toBe(1)
  expect(spec.lines[3].string).toBe('')
  expect(layout.lines[2].lineNumber).toBe(13)
  expect(layout.lines[2].string).toBe('  o')
  expect(shapes[0].lines[0].lineNumber).toBe(16)
  expect(shapes[0].lines[0].string).toBe('circles')
  expect(shapes[1].lines[2].lineNumber).toBe(22)
  expect(shapes[1].lines[2].string).toBe('  o o o')
})

test('when pop is called, it should increment the line number', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  expect(spec.getLineNumber()).toBe(8)
  spec.pop()
  expect(spec.getLineNumber()).toBe(8)
  spec.pop()
  expect(spec.getLineNumber()).toBe(9)
})

test('when peek is called, it should not increment the line number', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  expect(spec.getLineNumber()).toBe(8)
  spec.peek()
  expect(spec.getLineNumber()).toBe(8)
  spec.peek()
  expect(spec.getLineNumber()).toBe(8)
})

test('when pop is called, it should return the current line and remove it', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  expect(spec.pop()).toBe('variable:')
  expect(spec.pop()).toBe('  blue: #00f')
  expect(spec.pop()).toBe('')
})

test('when peek is called, it should return the current line and note remove it', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  expect(spec.peek()).toBe('variable:')
  expect(spec.peek()).toBe('variable:')
  expect(spec.peek()).toBe('variable:')
})

test('that an input file can be constructed with a NumberedLines', () => {
  const input = new InputFile(file1)
  const {spec, layout, shapes} = input.fileSections
  const {spec: spec2, layout: layout2} = new InputFile(null, shapes[2]).fileSections
  expect(spec2.lines[1].lineNumber).toBe(27)
  expect(spec2.lines[1].string).toBe('  horizontal-spacer: 1')
})
