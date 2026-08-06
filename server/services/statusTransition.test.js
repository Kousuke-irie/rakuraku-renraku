import test from 'node:test';
import assert from 'node:assert/strict';
import { HANDLING_STATUS, ROLE } from '../../shared/constants.js';
import { nextHandlingStatus } from './statusTransition.js';

test('人事の返信で要返信・対応中から返信待ちへ遷移する', () => {
  for (const current of [HANDLING_STATUS.NEEDS_REPLY, HANDLING_STATUS.IN_PROGRESS]) {
    assert.equal(nextHandlingStatus(current, ROLE.HR), HANDLING_STATUS.WAITING_STUDENT);
  }
});

test('学生の返信で返信待ち・完了から要返信へ遷移する', () => {
  for (const current of [HANDLING_STATUS.WAITING_STUDENT, HANDLING_STATUS.DONE]) {
    assert.equal(nextHandlingStatus(current, ROLE.STUDENT), HANDLING_STATUS.NEEDS_REPLY);
  }
});

test('保留は送信者にかかわらず自動遷移しない', () => {
  for (const role of [ROLE.HR, ROLE.ADMIN, ROLE.STUDENT]) {
    assert.equal(nextHandlingStatus(HANDLING_STATUS.ON_HOLD, role), HANDLING_STATUS.ON_HOLD);
  }
});
