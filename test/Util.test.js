const Util = require('../lib/Util');

test('it should stringify js to one line with spaces', () => {
  const obj = {
    a: 1,
    b: {
      c: 'c',
      d: {
        e: 'd'
      }
    }
  }
  const str = Util.stringify1(obj)
  expect(str).not.toMatch('\n')
})

test('when the input is null it should stringify js to null', () => {
  const str = Util.stringify1(null)
  expect(str).toBe('null')
})

test('it should format an error message', () => {
  try {
    throw new Error('unit testing')
  } catch (e) {
    const eWithMsg = Util.addMessageToError('additional message', e)
    expect(eWithMsg.stack.split('\n')[0]).toBe('Error: additional message')
    expect(eWithMsg.stack.split('\n')[1]).toBe('')
    expect(eWithMsg.stack.split('\n')[2]).toBe(' Error: unit testing')
    expect(eWithMsg.message).toMatch('additional message')
  }
})

test('it should return a string if not a bool', () => {
  expect(Util.booleanOrString('test')).toBe('test')
})

test('it should return a bool false if the string is false', () => {
  expect(Util.booleanOrString('false')).toBeFalsy()
})
