// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connect } from '../scripts/ha-client.mjs';

type Handler = (ev: { data: string }) => void;

class FakeSocket {
  static last: FakeSocket;
  url: string;
  sent: Record<string, unknown>[] = [];
  closed = false;
  static onReply: (msg: Record<string, unknown>, sock: FakeSocket) => void = () => {};
  private listeners: Record<string, Handler[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeSocket.last = this;
    queueMicrotask(() => this.emit({ type: 'auth_required', ha_version: 'test' }));
  }
  addEventListener(type: string, fn: Handler) {
    (this.listeners[type] ??= []).push(fn);
  }
  send(data: string) {
    const msg = JSON.parse(data) as Record<string, unknown>;
    this.sent.push(msg);
    queueMicrotask(() => FakeSocket.onReply(msg, this));
  }
  close() {
    this.closed = true;
  }
  emitClose() {
    for (const fn of this.listeners.close ?? []) fn({ data: '' });
  }
  emit(msg: Record<string, unknown>) {
    for (const fn of this.listeners.message ?? []) fn({ data: JSON.stringify(msg) });
  }
}

function authOk(msg: Record<string, unknown>, sock: FakeSocket) {
  if (msg.type === 'auth') sock.emit({ type: msg.access_token === 'good' ? 'auth_ok' : 'auth_invalid', message: 'Invalid access token' });
}

describe('ha-client connect', () => {
  const original = globalThis.WebSocket;
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeSocket);
    FakeSocket.onReply = authOk;
  });
  afterEach(() => {
    vi.stubGlobal('WebSocket', original);
  });

  it('connects to the websocket URL and sends the access token after auth_required', async () => {
    const client = await connect('http://localhost:8123', 'good');
    expect(FakeSocket.last.url).toBe('ws://localhost:8123/api/websocket');
    expect(FakeSocket.last.sent[0]).toEqual({ type: 'auth', access_token: 'good' });
    client.close();
    expect(FakeSocket.last.closed).toBe(true);
  });

  it('rejects on auth_invalid', async () => {
    await expect(connect('http://localhost:8123', 'bad')).rejects.toThrow(/Invalid access token/);
  });

  it('rejects when the socket closes before auth', async () => {
    FakeSocket.onReply = (msg, sock) => sock.emitClose();
    await expect(connect('http://localhost:8123', 'good')).rejects.toThrow(/closed before auth/);
  });

  it('resolves calls by matching id with incremental ids', async () => {
    FakeSocket.onReply = (msg, sock) => {
      if (msg.type === 'auth') return authOk(msg, sock);
      // Reply to the second call first to prove matching is by id.
      if (msg.type === 'first') setTimeout(() => sock.emit({ id: msg.id, type: 'result', success: true, result: 'one' }), 5);
      else sock.emit({ id: msg.id, type: 'result', success: true, result: { echo: msg.type } });
    };
    const client = await connect('http://localhost:8123', 'good');
    const [a, b] = await Promise.all([client.call({ type: 'first' }), client.call({ type: 'second' })]);
    expect(a).toBe('one');
    expect(b).toEqual({ echo: 'second' });
    const ids = FakeSocket.last.sent.slice(1).map((m) => m.id);
    expect(ids).toEqual([1, 2]);
  });

  it('rejects a call on success: false with the error message', async () => {
    FakeSocket.onReply = (msg, sock) => {
      if (msg.type === 'auth') return authOk(msg, sock);
      sock.emit({ id: msg.id, type: 'result', success: false, error: { code: 'unknown_command', message: 'Unknown command.' } });
    };
    const client = await connect('http://localhost:8123', 'good');
    await expect(client.call({ type: 'nope' })).rejects.toThrow('Unknown command.');
  });
});
