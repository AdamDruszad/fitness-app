import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSession } from './authSession.js';

function fixture(get, initial = 'sample-test-token') {
  let token = initial;
  const session = createAuthSession({ get }, { readToken: () => token, writeToken: value => { token = value; } });
  return { session, token: () => token };
}
test('unauthenticated startup never fetches a private profile', async () => {
  const { session } = fixture(() => assert.fail('Unexpected request'), null);
  await session.refetchUser();
  assert.deepEqual(session.getSnapshot(), { user: null, loading: false, error: '' });
});
test('login validates the profile and shares the successful session', async () => {
  const { session, token } = fixture(async () => ({ data: { id: 'test-user' } }), null);
  await session.login('sample-test-token');
  assert.equal(session.getSnapshot().user.id, 'test-user');
  assert.equal(token(), 'sample-test-token');
});
test('a network failure preserves the token and allows a retry', async () => {
  let fail = true;
  const { session, token } = fixture(async () => { if (fail) throw new Error('offline'); return { data: { id: 'test-user' } }; });
  await session.refetchUser();
  assert.ok(session.getSnapshot().error);
  assert.equal(token(), 'sample-test-token');
  fail = false;
  await session.refetchUser();
  assert.equal(session.getSnapshot().user.id, 'test-user');
});
test('an invalid session clears its token', async () => {
  const { session, token } = fixture(async () => { throw { response: { status: 401 } }; });
  await session.refetchUser();
  assert.equal(token(), null);
  assert.equal(session.getSnapshot().user, null);
});
test('late successful request cannot undo logout', async () => {
  let resolve;
  const { session } = fixture(() => new Promise(done => { resolve = done; }));
  const pending = session.refetchUser();
  session.logout();
  resolve({ data: { id: 'old-user' } });
  await pending;
  assert.equal(session.getSnapshot().user, null);
  assert.equal(session.getSnapshot().loading, false);
});
test('old profile response cannot overwrite a newer session', async () => {
  const resolves = [];
  const { session } = fixture(() => new Promise(done => resolves.push(done)));
  const first = session.refetchUser();
  const second = session.login('new-test-token');
  resolves[1]({ data: { id: 'new-user' } });
  await second;
  resolves[0]({ data: { id: 'old-user' } });
  await first;
  assert.equal(session.getSnapshot().user.id, 'new-user');
});
