const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { ConfirmableNumberInput } = require('../src/components/ExerciseSlotCard.tsx')

function exerciseInput(kind, initial) {
  const old = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect }
  const state = []
  let cursor = 0
  let value = initial
  const commits = [], pending = []
  React.useState = (initialValue) => {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initialValue === 'function' ? initialValue() : initialValue
    return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next }]
  }
  React.useRef = (initialValue) => {
    const index = cursor++
    if (!(index in state)) state[index] = { current: initialValue }
    return state[index]
  }
  React.useEffect = () => {}
  const render = () => {
    cursor = 0
    const tree = ConfirmableNumberInput({ kind, value, weightUnit: 'kg', label: 'dato de la serie', onConfirm: (next) => commits.push(next), onPending: (next) => pending.push(next) })
    const [input, controls] = tree.props.children
    const children = controls?.props?.children || []
    return { input, confirm: children[1], cancel: children[2], text: children[0]?.props.children }
  }
  return { render, commits, pending, setValue: (next) => { value = next }, restore: () => Object.assign(React, old) }
}

test('el peso se conserva como borrador hasta confirmar y se puede cancelar', () => {
  const ui = exerciseInput('weight', 102)
  try {
    ui.render().input.props.onChange({ target: { value: '20' } })
    let view = ui.render()
    assert.deepEqual(ui.commits, [])
    assert.match(view.text, /Sin confirmar/)
    view.cancel.props.onClick()
    assert.deepEqual(ui.commits, [])
    assert.deepEqual(ui.pending, [true, false])
    ui.render().input.props.onChange({ target: { value: '20' } })
    view = ui.render()
    view.confirm.props.onClick()
    assert.deepEqual(ui.commits, [20])
    assert.deepEqual(ui.pending, [true, false, true, false])
  } finally { ui.restore() }
})

test('las repeticiones requieren confirmación y un cambio remoto impide sobrescribir', () => {
  const ui = exerciseInput('reps', 10)
  try {
    ui.render().input.props.onChange({ target: { value: '25' } })
    ui.setValue(12)
    const view = ui.render()
    assert.equal(view.confirm.props.disabled, true)
    assert.match(view.text, /valor cambió/)
    view.confirm.props.onClick()
    assert.deepEqual(ui.commits, [])
    view.cancel.props.onClick()
    assert.deepEqual(ui.pending, [true, false])
    assert.equal(ui.render().input.props.value, '12')
  } finally { ui.restore() }
})
