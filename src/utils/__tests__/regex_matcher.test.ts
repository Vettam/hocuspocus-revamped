import test from 'ava';
import { RegexMatcher } from '../regex_matcher';

test('matchUUID returns true for valid UUID v4', (t) => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  t.true(RegexMatcher.matchUUID(validUUID));
});

test('matchUUID returns true for uppercase UUID', (t) => {
  const validUUID = '550E8400-E29B-41D4-A716-446655440000';
  t.true(RegexMatcher.matchUUID(validUUID));
});

test('matchUUID returns true for mixed case UUID', (t) => {
  const validUUID = '550e8400-E29B-41d4-A716-446655440000';
  t.true(RegexMatcher.matchUUID(validUUID));
});

test('matchUUID returns false for invalid UUID - missing segment', (t) => {
  const invalidUUID = '550e8400-e29b-41d4-446655440000';
  t.false(RegexMatcher.matchUUID(invalidUUID));
});

test('matchUUID returns false for invalid UUID - wrong segment length', (t) => {
  const invalidUUID = '550e8400-e29b-41d4-a716-4466554400';
  t.false(RegexMatcher.matchUUID(invalidUUID));
});

test('matchUUID returns false for invalid UUID - contains invalid characters', (t) => {
  const invalidUUID = '550e8400-e29b-41d4-a716-44665544000g';
  t.false(RegexMatcher.matchUUID(invalidUUID));
});

test('matchUUID returns false for empty string', (t) => {
  t.false(RegexMatcher.matchUUID(''));
});

test('matchUUID returns false for non-UUID string', (t) => {
  t.false(RegexMatcher.matchUUID('not-a-uuid'));
});

test('matchUUID returns false for UUID with extra characters', (t) => {
  const uuidWithExtra = 'prefix-550e8400-e29b-41d4-a716-446655440000';
  // Note: The anchored regex requires an exact full-string match
  t.false(RegexMatcher.matchUUID(uuidWithExtra));
});

test('matchUUID returns false for UUID without dashes', (t) => {
  const uuidNoDashes = '550e8400e29b41d4a716446655440000';
  t.false(RegexMatcher.matchUUID(uuidNoDashes));
});
