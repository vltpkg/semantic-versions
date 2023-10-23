import { test } from 'tap'
import { satisfies } from 'semver'
import { includes, excludes } from '../fixtures/semver-ranges.js'

test('range tests', t => {
  t.plan(includes.length)
  includes.forEach(([range, ver, options]) =>
    t.ok(satisfies(ver, range, options), `${range} satisfied by ${ver}`))
})

test('negative range tests', t => {
  t.plan(excludes.length)
  excludes.forEach(([range, ver, options]) =>
    t.notOk(satisfies(ver, range, options), `${range} not satisfied by ${ver}`))
})
