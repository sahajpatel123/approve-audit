import { test } from 'node:test'
import assert from 'node:assert'

// The spender list is derived from logs; this pins the classification, which is where a revoker
// goes wrong: a zero allowance is stale, an open one is live, and MAX_UINT is a blanket approval.
const MAX = 2n ** 256n - 1n

const classify = (allowance) => (allowance === 0n ? 'stale' : allowance === MAX ? 'blanket' : 'live')

test('zero allowance is stale', () => assert.equal(classify(0n), 'stale'))
test('max allowance is a blanket approval', () => assert.equal(classify(MAX), 'blanket'))
test('partial allowance is live', () => assert.equal(classify(123n), 'live'))
