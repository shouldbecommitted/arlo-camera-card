import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import Hls from "hls.js";

export type PlayerSource =
  | { kind: "live"; entityId: string; url: string; title: string }
  | { kind: "clip"; url: string; title: string };

@customElement("arlo-player-dialog")
export class ArloPlayerDialog extends LitElement {
  /** When set, the dialog is open and plays this source. */
  @property({ attribute: false }) source?: PlayerSource;
  /** true when prev/next navigation should be shown (clip mode). */
  @property({ type: Boolean }) navigable = false;

  @query("video") private _video!: HTMLVideoElement;
  @state() private _status: "loading" | "playing" | "error" = "loading";

  private _hls?: Hls;
  private _timeout?: number;

  static styles = css`
    .scrim {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .title {
      color: #fff;
      font-weight: 600;
      margin-bottom: 8px;
    }
    video {
      max-width: 96vw;
      max-height: 78vh;
      background: #000;
      border-radius: 10px;
    }
    .row {
      display: flex;
      gap: 18px;
      margin-top: 14px;
    }
    button {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      cursor: pointer;
    }
    .status {
      color: #fff;
      position: absolute;
      pointer-events: none;
    }
    .retry {
      color: #0a84ff;
      cursor: pointer;
      pointer-events: auto;
    }
  `;

  protected updated(changed: PropertyValues): void {
    if (changed.has("source")) {
      this._teardownHls();
      if (this.source) this._load();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardownHls();
  }

  private _teardownHls() {
    if (this._timeout) window.clearTimeout(this._timeout);
    if (this._hls) {
      this._hls.destroy();
      this._hls = undefined;
    }
  }

  private _load() {
    if (!this.source) return;
    const url = this.source.url;
    // Live opens with an empty url while the stream URL is fetched; stay in the
    // loading state until the real url arrives (a second `source` update).
    if (!url) {
      this._status = "loading";
      return;
    }
    this._status = "loading";
    this._timeout = window.setTimeout(() => {
      if (this._status === "loading") this._status = "error";
    }, 15000);

    const onReady = () => {
      if (this._timeout) window.clearTimeout(this._timeout);
      this._status = "playing";
      this._video.play().catch(() => undefined);
    };

    const isHls = url.includes(".m3u8") || this.source.kind === "live";
    if (isHls && Hls.isSupported()) {
      this._hls = new Hls();
      this._hls.loadSource(url);
      this._hls.attachMedia(this._video);
      this._hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      this._hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) this._status = "error";
      });
    } else {
      this._video.src = url;
      this._video.addEventListener("loadeddata", onReady, { once: true });
      this._video.addEventListener(
        "error",
        () => (this._status = "error"),
        { once: true }
      );
    }
  }

  private _close() {
    this.dispatchEvent(
      new CustomEvent("player-close", { bubbles: true, composed: true })
    );
  }

  private _nav(dir: -1 | 1) {
    this.dispatchEvent(
      new CustomEvent("player-nav", {
        detail: { dir },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.source) return html``;
    return html`
      <div
        class="scrim"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this._close();
        }}
      >
        <div class="title">${this.source.title}</div>
        <video controls playsinline></video>
        ${this._status === "loading"
          ? html`<div class="status">Connecting…</div>`
          : null}
        ${this._status === "error"
          ? html`<div class="status">
              Could not play.
              <span class="retry" @click=${() => this._load()}>Retry</span>
            </div>`
          : null}
        <div class="row">
          ${this.navigable
            ? html`<button @click=${() => this._nav(-1)}>‹ Prev</button>`
            : null}
          <button @click=${() => this._close()}>Close</button>
          ${this.navigable
            ? html`<button @click=${() => this._nav(1)}>Next ›</button>`
            : null}
        </div>
      </div>
    `;
  }
}
