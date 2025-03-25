/**
 * Simple Test
 * 
 * Basic tests to verify that the test framework is working
 */

import { test, suite, assertTrue, assertEqual } from './test-framework.js';

suite('Simple Tests', () => {
  test('Basic assertion', () => {
    assertTrue(true, 'True should be true');
  });
  
  test('Equality assertion', () => {
    assertEqual(1, 1, 'Numbers should be equal');
  });
  
  test('Object equality', () => {
    assertEqual({ a: 1, b: 2 }, { a: 1, b: 2 }, 'Objects should be equal');
  });
}); 