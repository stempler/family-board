// Minimal Home Assistant client for the dev scripts: REST via fetch, WebSocket via Node's global WebSocket.

/**
 * Open an authenticated WebSocket connection.
 * @param {string} baseUrl e.g. http://localhost:8123
 * @param {string} token access token
 * @returns {Promise<{ call: (msg: Record<string, unknown>) => Promise<any>, close: () => void }>}
 */
export async function connect(baseUrl, token) {
  const ws = new WebSocket(baseUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/websocket');
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void }>} */
  const pending = new Map();
  let nextId = 1;
  let authed = false;

  return new Promise((resolve, reject) => {
    const client = {
      /** @param {Record<string, unknown>} msg */
      call(msg) {
        const id = nextId++;
        return new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ ...msg, id }));
        });
      },
      close() {
        ws.close();
      },
    };

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (msg.type === 'auth_ok') {
        authed = true;
        resolve(client);
      } else if (msg.type === 'auth_invalid') {
        ws.close();
        reject(new Error(`WebSocket auth failed: ${msg.message ?? 'auth_invalid'}`));
      } else if (msg.type === 'result' && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.success) p.resolve(msg.result);
        else p.reject(new Error(msg.error?.message ?? `WebSocket call ${msg.id} failed`));
      }
    });
    ws.addEventListener('error', () => reject(new Error(`WebSocket error connecting to ${baseUrl}`)));
    ws.addEventListener('close', () => {
      if (!authed) reject(new Error(`WebSocket to ${baseUrl} closed before auth`));
      for (const p of pending.values()) p.reject(new Error('WebSocket closed'));
      pending.clear();
    });
  });
}

/**
 * JSON REST call against the HA API.
 * @param {string} baseUrl
 * @param {string | undefined} token Bearer token (omit for unauthenticated endpoints)
 * @param {string} method
 * @param {string} path
 * @param {unknown} [body]
 */
export async function rest(baseUrl, token, method, path, body) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
