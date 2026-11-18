// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcAmount, DEFAULT_PRICES, generateCode } from '../lib/pricing.js';

test('single-sided black & white is pages x copies x rate', () => {
  assert.equal(calcAmount(DEFAULT_PRICES, { mode: 'bw', duplex: false, pages: 3, copies: 2 }), 3 * 2 * 200);
});
test('colour uses the colour rate', () => {
  assert.equal(calcAmount(DEFAULT_PRICES, { mode: 'color', duplex: false, pages: 5, copies: 1 }), 5 * 800);
});
test('a shop with its own prices is charged its own prices', () => {
  const prices = { bw: 100, color: 500, duplexBw: 80, duplexColor: null };
  assert.equal(calcAmount(prices, { mode: 'bw', duplex: true, pages: 10, copies: 1 }), 800);
  assert.equal(calcAmount(prices, { mode: 'bw', duplex: false, pages: 10, copies: 1 }), 1000);
});
test('order codes are 6 characters with no look-alike letters', () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});
