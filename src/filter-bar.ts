import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { FilterState, TriggerType } from "./types";
import { cameraTile } from "./live-grid";

const TRIGGERS: TriggerType[] = ["person", "motion", "vehicle", "animal"];

@customElement("arlo-filter-bar")
export class ArloFilterBar extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) cameras: string[] = [];
  @property({ attribute: false }) filter!: FilterState;

  static styles = css`
    .bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .chip {
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 20px;
      background: var(--secondary-background-color, #2c2c2e);
      color: var(--secondary-text-color, #bbb);
      cursor: pointer;
      user-select: none;
    }
    .chip.on {
      background: var(--primary-color, #0a84ff);
      color: #fff;
    }
    .spacer {
      margin-left: auto;
    }
  `;

  private _emit(filter: FilterState) {
    this.dispatchEvent(
      new CustomEvent("filter-change", {
        detail: { filter },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _name(id: string): string {
    return cameraTile(this.hass, id).name;
  }

  private _toggleCamera(id: string) {
    const all = this.filter.cameras;
    const next = all && all.length === 1 && all[0] === id ? null : [id];
    this._emit({ ...this.filter, cameras: next });
  }

  private _toggleTrigger(t: TriggerType) {
    const next = this.filter.trigger === t ? null : t;
    this._emit({ ...this.filter, trigger: next });
  }

  render() {
    const f = this.filter;
    const allCams = f.cameras === null;
    return html`
      <div class="bar">
        <span
          class="chip ${allCams ? "on" : ""}"
          @click=${() => this._emit({ ...f, cameras: null })}
          >All cameras</span
        >
        ${this.cameras.map(
          (id) => html`
            <span
              class="chip ${f.cameras?.includes(id) ? "on" : ""}"
              @click=${() => this._toggleCamera(id)}
              >${this._name(id)}</span
            >
          `
        )}
        ${TRIGGERS.map(
          (t) => html`
            <span
              class="chip ${t === "person" ? "spacer" : ""} ${f.trigger === t
                ? "on"
                : ""}"
              @click=${() => this._toggleTrigger(t)}
              >${t}</span
            >
          `
        )}
      </div>
    `;
  }
}
