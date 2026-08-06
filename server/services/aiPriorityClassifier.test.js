import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAiPriority, validateAiPriorityOutput } from './aiPriorityClassifier.js';

function geminiResponse(value) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  };
}

const highResult = {
  priority: 'high',
  reason: '他社の回答期限が明日までのため',
  requestedAction: '合否結果の連絡時期を知りたい',
  contextSummary: '他社の回答期限が明日まで',
  needsMoreContext: false,
};

test('構造化JSONを検証してAI対応推奨度を返す', async () => {
  let requestOptions;
  const result = await classifyAiPriority({
    minimalInput: { latestStudentMessage: '明日までに結果を知りたいです' },
    recentMessagesProvider: () => [],
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return geminiResponse(highResult);
    },
  });

  assert.equal(result.priority, 'high');
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-key');
  assert.equal(requestOptions.body.includes('test-key'), false);
});

test('needsMoreContextの場合だけ直近会話を追加して再判定する', async () => {
  const requests = [];
  let calls = 0;
  const result = await classifyAiPriority({
    minimalInput: { latestStudentMessage: 'それでお願いします' },
    recentMessagesProvider: () => [{ sender: 'hr', body: '明日までに回答します' }],
    apiKey: 'test-key',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      calls += 1;
      return geminiResponse(calls === 1 ? { ...highResult, needsMoreContext: true } : highResult);
    },
  });

  assert.equal(result.priority, 'high');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].contents[0].parts[0].text.includes('recentMessages'), false);
  assert.equal(requests[1].contents[0].parts[0].text.includes('recentMessages'), true);
});

test('列挙値外のpriorityを拒否する', () => {
  assert.throws(
    () => validateAiPriorityOutput({ ...highResult, priority: 'urgent' }),
    /invalid_ai_response/,
  );
});
