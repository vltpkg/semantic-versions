import { test } from 'tap'
import { satisfies } from '../../index.js'
import { includes, excludes } from '../fixtures/ranges.js'

test('range tests', t => {
  t.plan(includes.length)
  includes.forEach(([range, ver]) =>
    t.ok(satisfies(ver, range), `${range} satisfied by ${ver}`))
})

test('negative range tests', t => {
  t.plan(excludes.length)
  excludes.forEach(([range, ver]) =>
    t.notOk(satisfies(ver, range), `${range} not satisfied by ${ver}`))
})
