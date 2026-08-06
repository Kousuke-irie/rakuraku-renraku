import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDLING_STATUS,
  TOPIC_TAG,
  URGENCY,
} from '../../shared/constants.js';
import {
  calculateUrgency,
  SLA_ALERT_HOURS,
  SLA_WARN_HOURS,
} from './urgencyCalculator.js';

test('欠席・遅刻は経過時間に関係なく緊急になる', () => {
  assert.equal(
    calculateUrgency({
      topicTag: TOPIC_TAG.ABSENCE_LATE,
      elapsedHours: 0,
      handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    }),
    URGENCY.HIGH,
  );
});

test('完了と保留は欠席・遅刻より先に低として扱う', () => {
  for (const handlingStatus of [HANDLING_STATUS.DONE, HANDLING_STATUS.ON_HOLD]) {
    assert.equal(
      calculateUrgency({
        topicTag: TOPIC_TAG.ABSENCE_LATE,
        elapsedHours: SLA_ALERT_HOURS,
        handlingStatus,
      }),
      URGENCY.LOW,
    );
  }
});

test('期限超過と重要タグの閾値を判定する', () => {
  assert.equal(
    calculateUrgency({
      topicTag: TOPIC_TAG.OTHER,
      elapsedHours: SLA_ALERT_HOURS,
      handlingStatus: HANDLING_STATUS.IN_PROGRESS,
    }),
    URGENCY.HIGH,
  );
  assert.equal(
    calculateUrgency({
      topicTag: TOPIC_TAG.SCHEDULING,
      elapsedHours: SLA_WARN_HOURS,
      handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    }),
    URGENCY.HIGH,
  );
});

test('返信待ちは低、それ以外は通常になる', () => {
  assert.equal(
    calculateUrgency({
      topicTag: TOPIC_TAG.QUESTION,
      elapsedHours: 1,
      handlingStatus: HANDLING_STATUS.WAITING_STUDENT,
    }),
    URGENCY.LOW,
  );
  assert.equal(
    calculateUrgency({
      topicTag: TOPIC_TAG.QUESTION,
      elapsedHours: 1,
      handlingStatus: HANDLING_STATUS.NEEDS_REPLY,
    }),
    URGENCY.NORMAL,
  );
});
