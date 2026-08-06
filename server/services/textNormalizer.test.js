import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForMatch, toOriginalRange } from './textNormalizer.js';

test('空白・全角空白・ゼロ幅文字を落とす', () => {
  assert.equal(normalizeForMatch('本 籍').text, '本籍');
  assert.equal(normalizeForMatch('本　籍').text, '本籍');
  assert.equal(normalizeForMatch('本​籍').text, '本籍');
  assert.equal(normalizeForMatch('本\n籍\t').text, '本籍');
});

test('NFKC で全角英数と半角カナを揃える', () => {
  assert.equal(normalizeForMatch('ＳＰＩ').text, 'spi');
  assert.equal(normalizeForMatch('ｼﾞｭｹﾝ').text, 'ジュケン');
});

test('句読点は落とさない（離れた語がつながって誤検知するため）', () => {
  assert.equal(normalizeForMatch('本籍。出身地').text, '本籍。出身地');
});

test('対応表で正規化後の位置を元の位置に戻せる', () => {
  const body = 'ご本 籍はどちら';
  const { text, map } = normalizeForMatch(body);

  assert.equal(text, 'ご本籍はどちら');

  const index = text.indexOf('本籍');
  const range = toOriginalRange(map, index, 2);

  // 元の本文では「本 籍」の3文字にまたがる
  assert.equal(body.slice(range.start, range.end), '本 籍');
});

test('先頭一致・末尾一致でも範囲が壊れない', () => {
  const body = '本籍';
  const { map } = normalizeForMatch(body);

  assert.deepEqual(toOriginalRange(map, 0, 2), { start: 0, end: 2 });
  // 長さが実際より長くても末尾で止まる
  assert.deepEqual(toOriginalRange(map, 0, 99), { start: 0, end: 2 });
});

test('空文字でも壊れない', () => {
  const { text, map } = normalizeForMatch('');
  assert.equal(text, '');
  assert.deepEqual(toOriginalRange(map, 0, 1), { start: 0, end: 0 });
});

test('★サロゲートペアを含んでも位置がずれない', () => {
  // 絵文字はUTF-16で2単位。位置をコードポイント単位で持つとここでずれる
  const body = '🙏ご本籍';
  const { text, map } = normalizeForMatch(body);

  const index = text.indexOf('本籍');
  const range = toOriginalRange(map, index, 2);

  assert.equal(body.slice(range.start, range.end), '本籍');
});

test('★半角カナの濁点が合成される', () => {
  // 1文字ずつ NFKC すると「ｼ」+「ﾞ」のまま分離してしまう
  assert.equal(normalizeForMatch('ｼﾞｭｹﾝ').text, 'ジュケン');
  assert.equal(normalizeForMatch('ﾎﾟｲﾝﾄ').text, 'ポイント');
});
