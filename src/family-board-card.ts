import { LitElement, css, html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import patrickHand from '@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?inline';
import { childIds, resolveEntity, toBoardModel, type HassStates } from './adapter';
import { renderBoard, type AreaSize } from './board';
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

/** Milliseconds between checks for a card that moved without changing size (a kiosk plugin hiding the top bar). */
const REFIT_INTERVAL_MS = 2000;
/** A measured area below this in either direction is ignored. */
const MIN_AREA = 100;

/**
 * Whether the card is a panel view's own card. Checked against Home Assistant frontend 20261028.6
 * (core 2026.11.2): hui-panel-view renders its hui-card into its shadow root, and hui-card renders
 * the card as its light-DOM child. Any other element on the way (a stack, a grid, the edit-mode
 * hui-card-options) means the card is not the view's own card.
 */
function inPanelView(card: Element): boolean {
  let node: Node | null = card.parentNode;
  while (node) {
    if (node instanceof ShadowRoot) {
      node = node.host;
      continue;
    }
    if (!(node instanceof Element)) return false;
    const tag = node.localName;
    if (tag === 'hui-panel-view') return true;
    if (tag !== 'hui-card') return false;
    node = node.parentNode;
  }
  return false;
}

const baseStyles = css`
  ha-card { padding: 0; background: ${unsafeCSS(PAPER)}; overflow: hidden; display: block; }
  svg { display: block; width: 100%; height: auto; }
  ha-card.fb-fill svg { height: 100%; }
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
  static properties = { _svg: { state: true }, _size: { state: true } };

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
  /** The area the board fills, or undefined when not filling. */
  declare _size: AreaSize | undefined;
  /** Clock used for seasons; overridable (e.g. by the dev playground). */
  now: () => Date = () => new Date();
  /** Size override (e.g. by the dev playground); when set it replaces the window measurement. */
  measure?: () => AreaSize;
  private _config?: CardConfig;
  private _hass?: Hass;
  private _key = '';
  private _prevPoints: Record<string, number> = {};
  private _observer?: ResizeObserver;
  private _frame?: number;
  private _timer?: ReturnType<typeof setInterval>;
  private readonly _refitNow = () => this.refit();

  constructor() {
    super();
    this._svg = '';
    this._size = undefined;
    registerFont();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this._refitNow);
    this._timer = setInterval(this._refitNow, REFIT_INTERVAL_MS);
    // Before the first render there is no ha-card to measure; firstUpdated takes over then.
    if (this.hasUpdated) {
      this._observe();
      this.refit();
    }
  }

  protected firstUpdated(): void {
    this._observe();
    this.refit();
  }

  /**
   * Watches the ha-card's size. The host is inline (as is HA's hui-card around it), and an inline
   * element never reports to a ResizeObserver, so the block ha-card is observed instead.
   */
  private _observe(): void {
    const card = this.shadowRoot?.querySelector('ha-card');
    if (this._observer || !card || !this.isConnected || typeof ResizeObserver === 'undefined') return;
    this._observer = new ResizeObserver(() => {
      // Deferred, so setting the ha-card's height in this frame does not cause a ResizeObserver loop error.
      if (this._frame !== undefined) return;
      this._frame = requestAnimationFrame(() => {
        this._frame = undefined;
        this.refit();
      });
    });
    this._observer.observe(card);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = undefined;
    if (this._frame !== undefined) cancelAnimationFrame(this._frame);
    this._frame = undefined;
    window.removeEventListener('resize', this._refitNow);
    clearInterval(this._timer);
    this._timer = undefined;
  }

  setConfig(raw: unknown): void {
    this._config = normalizeConfig(raw);
    this._key = '';
    this._remeasure();
    this._update();
  }

  set hass(h: Hass) {
    this._hass = h;
    this._remeasure();
    this._update();
  }

  /** Measures again and redraws if the size changed. */
  refit(): void {
    if (this._remeasure()) this._update();
  }

  /** Stores the area to fill; true when it changed. While detached the stored size is kept. */
  private _remeasure(): boolean {
    if (!this.isConnected) return false;
    const size = this._fitSize();
    if (size?.w === this._size?.w && size?.h === this._size?.h) return false;
    this._size = size;
    return true;
  }

  /** The area to fill, or undefined when the card does not fill (now). */
  private _fitSize(): AreaSize | undefined {
    const fill = this._config?.fill;
    if (fill === undefined || fill === false) return undefined;
    if (fill === 'auto' && !inPanelView(this)) return undefined;
    let size: AreaSize;
    if (this.measure) {
      size = this.measure();
    } else {
      // The ha-card is a block with a real width; the inline host is not. No ha-card before the first render.
      const card = this.shadowRoot?.querySelector('ha-card');
      if (!card) return undefined;
      const rect = card.getBoundingClientRect();
      // Page coordinates, so a scrolled page does not grow the area that it scrolled past.
      size = { w: rect.width, h: window.innerHeight - (rect.top + window.scrollY) };
    }
    const w = Math.round(size.w);
    // Rounded down, so a fractional top edge cannot overflow the window by half a pixel.
    const h = Math.floor(size.h);
    return w < MIN_AREA || h < MIN_AREA ? undefined : { w, h };
  }

  getCardSize(): number {
    return 8;
  }

  private _update(): void {
    if (!this._config || !this._hass) return;
    try {
      const now = this.now();
      const model = toBoardModel(this._hass.states, this._config);
      const size = this._size;
      const key = `${localDate(now)}|${size ? `${size.w}x${size.h}` : ''}|${JSON.stringify(model)}`;
      if (key === this._key) return;
      // A size-only redraw passes the stored points, which equal the current ones, so nothing is new.
      this._svg = renderBoard(model, this._config, { date: now, prevPoints: this._prevPoints, size });
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
    // One template, so the observed ha-card stays the same element; `nothing` leaves the attributes out when not filling.
    const size = this._size;
    return html`<ha-card
      class=${size ? 'fb-fill' : nothing}
      style=${size ? `height: ${size.h}px` : nothing}
      @click=${this._onClick}
    >${unsafeSVG(this._svg)}</ha-card>`;
  }
}

if (!customElements.get('family-board-card')) customElements.define('family-board-card', FamilyBoardCard);

const w = window as unknown as { customCards?: Array<Record<string, string>> };
w.customCards = w.customCards ?? [];
if (!w.customCards.some((c) => c.type === 'family-board-card')) {
  w.customCards.push({ type: 'family-board-card', name: 'Family Board', description: 'Gezeichnete Punkteanzeige für TaskMate' });
}
