import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import patrickHand from '@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?inline';
import { childIds, resolveEntity, toBoardModel, type HassStates } from './adapter';
import { renderBoard } from './board';
import { DEFAULT_ENTITIES, normalizeConfig, type CardConfig } from './config';
import { animCss } from './draw/anim';
import { esc, INK, PAPER } from './draw/sketch';
import { de } from './i18n';
import { THEMES, seasonThemeIds, themeCss } from './themes/registry';

interface Hass { states: HassStates }

let fontRegistered = false;
function registerFont(): void {
  if (fontRegistered) return;
  fontRegistered = true;
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  try {
    const face = new FontFace('Patrick Hand', `url(${patrickHand})`);
    document.fonts.add(face);
    void face.load().catch(() => {});
  } catch {
    // font is cosmetic; fall back silently
  }
}

const STUB_THEMES = ['bricks', 'dino'];

function errorSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><text x="400" y="225" font-size="24" text-anchor="middle" fill="${INK}">${esc(de.renderError)}</text></svg>`;
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const baseStyles = css`
  ha-card { padding: 0; background: ${unsafeCSS(PAPER)}; overflow: hidden; display: block; }
  svg { display: block; width: 100%; height: auto; }
  [data-kid-half][data-tappable] { cursor: pointer; }
  @keyframes fb-drop {
    from { transform: translateY(-40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .fb-new { animation: fb-drop 700ms ease-out both; }
  .fb-anim {
    animation-duration: var(--t, 10s);
    animation-delay: var(--d, 0s);
    animation-iteration-count: infinite;
    transform-box: fill-box;
  }
  ${unsafeCSS(animCss)}
  @media (prefers-reduced-motion: reduce) {
    .fb-new { animation: none; }
    .fb-anim { animation: none !important; }
  }
`;

export class FamilyBoardCard extends LitElement {
  static properties = { _svg: { state: true } };

  static styles = [baseStyles, unsafeCSS(themeCss())];

  /** Registered theme ids (read by the browser check). */
  static get themeIds(): string[] {
    return Object.keys(THEMES);
  }

  /** Ids of the registered themes that have a season scene (read by the browser check). */
  static get seasonThemeIds(): string[] {
    return seasonThemeIds();
  }

  static getStubConfig(hass?: Hass): Record<string, unknown> {
    const states = hass?.states ?? {};
    const overview = resolveEntity(states, DEFAULT_ENTITIES.overview, 'overview');
    const rewards = resolveEntity(states, DEFAULT_ENTITIES.rewards, 'rewards');
    const ids = childIds(states, overview);
    if (ids.length === 0) return { kids: [{ id: 'kind-1', theme: 'bricks' }] };
    return {
      // Sensors found under a prefixed name are written into the config, so it shows what is read.
      ...(overview !== DEFAULT_ENTITIES.overview ? { overview_entity: overview } : {}),
      ...(rewards !== DEFAULT_ENTITIES.rewards ? { rewards_entity: rewards } : {}),
      kids: ids.map((id, i) => ({ id, theme: STUB_THEMES[i % STUB_THEMES.length] })),
    };
  }

  declare _svg: string;
  /** Clock used for seasons; overridable (e.g. by the dev playground). */
  now: () => Date = () => new Date();
  private _config?: CardConfig;
  private _hass?: Hass;
  private _key = '';
  private _prevPoints: Record<string, number> = {};

  constructor() {
    super();
    this._svg = '';
    registerFont();
  }

  setConfig(raw: unknown): void {
    this._config = normalizeConfig(raw);
    this._key = '';
    this._update();
  }

  set hass(h: Hass) {
    this._hass = h;
    this._update();
  }

  getCardSize(): number {
    return 8;
  }

  private _update(): void {
    if (!this._config || !this._hass) return;
    try {
      const now = this.now();
      const model = toBoardModel(this._hass.states, this._config);
      const key = `${localDate(now)}|${JSON.stringify(model)}`;
      if (key === this._key) return;
      this._svg = renderBoard(model, this._config, { date: now, prevPoints: this._prevPoints });
      // Remember the state only after a successful render, so the next update retries.
      this._key = key;
      this._prevPoints = Object.fromEntries(model.kids.map((k) => [k.id, k.points]));
    } catch (err) {
      console.error('family-board-card: render failed', err);
      this._key = '';
      this._svg = errorSvg();
    }
  }

  private _onClick(e: Event): void {
    const half = e.composedPath().find((n): n is Element => n instanceof Element && n.hasAttribute('data-kid-half'));
    // Only halves the board marked tappable navigate: a kid that was not found has no tap target.
    if (half?.getAttribute('data-tappable') !== 'true') return;
    const id = half.getAttribute('data-kid-half');
    const path = this._config?.kids.find((k) => k.id === id)?.tap_path;
    if (!path) return;
    history.pushState(null, '', path);
    window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
  }

  protected render(): TemplateResult {
    return html`<ha-card @click=${this._onClick}>${unsafeSVG(this._svg)}</ha-card>`;
  }
}

if (!customElements.get('family-board-card')) customElements.define('family-board-card', FamilyBoardCard);

const w = window as unknown as { customCards?: Array<Record<string, string>> };
w.customCards = w.customCards ?? [];
if (!w.customCards.some((c) => c.type === 'family-board-card')) {
  w.customCards.push({ type: 'family-board-card', name: 'Family Board', description: 'Gezeichnete Punkteanzeige für TaskMate' });
}
