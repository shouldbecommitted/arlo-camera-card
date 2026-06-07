import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DayGroup, toMs } from "./grouping";
import { LibraryItem } from "./types";
import { mapTrigger } from "./filters";

const TZ = "Pacific/Auckland";

function timeLabel(item: LibraryItem): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(toMs(item.created_at)));
}

function durationLabel(item: LibraryItem): string {
  if (!item.duration) return "";
  const m = Math.floor(item.duration / 60);
  const s = Math.floor(item.duration % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

@customElement("arlo-recordings-grid")
export class ArloRecordingsGrid extends LitElement {
  @property({ attribute: false }) groups: DayGroup[] = [];
  @property({ type: Number }) columns = 3;
  @property({ type: Boolean }) loading = false;
  @property() error = "";

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), 1fr);
      gap: 8px;
    }
    @media (max-width: 480px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .day {
      grid-column: 1 / -1;
      color: var(--secondary-text-color, #8e8e93);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 8px 0 2px;
    }
    .rec {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      cursor: pointer;
    }
    .rec img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .who {
      position: absolute;
      top: 6px;
      left: 6px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
    }
    .who.person {
      background: var(--primary-color, #0a84ff);
    }
    .meta {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 5px 7px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
      color: #fff;
      font-size: 10px;
    }
    .state {
      padding: 24px;
      text-align: center;
      color: var(--secondary-text-color, #8e8e93);
    }
    .retry {
      margin-top: 8px;
      cursor: pointer;
      color: var(--primary-color, #0a84ff);
    }
  `;

  private _play(item: LibraryItem) {
    this.dispatchEvent(
      new CustomEvent("play-clip", {
        detail: { item },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _retry() {
    this.dispatchEvent(
      new CustomEvent("retry", { bubbles: true, composed: true })
    );
  }

  render() {
    if (this.loading)
      return html`<div class="state">Loading recordings…</div>`;
    if (this.error)
      return html`<div class="state">
        ${this.error}
        <div class="retry" @click=${() => this._retry()}>Retry</div>
      </div>`;
    if (this.groups.length === 0)
      return html`<div class="state">No recordings for this filter.</div>`;

    this.style.setProperty("--cols", String(this.columns));
    return html`
      <div class="grid">
        ${this.groups.map(
          (g) => html`
            <div class="day">${g.label}</div>
            ${g.items.map((item) => {
              const trig = mapTrigger(item.object ?? item.trigger);
              const dur = durationLabel(item);
              return html`
                <div class="rec" @click=${() => this._play(item)}>
                  <img src=${item.thumbnail} alt=${trig} />
                  <span class="who ${trig}">${trig}</span>
                  <span class="meta"
                    >${timeLabel(item)}${dur ? ` · ${dur}` : ""}</span
                  >
                </div>
              `;
            })}
          `
        )}
      </div>
    `;
  }
}
