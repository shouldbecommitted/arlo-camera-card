import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { CameraTile } from "./types";
import { gridTemplate } from "./layout";

/** Pure: build a tile view-model for one camera from hass state. */
export function cameraTile(hass: HomeAssistant, entityId: string): CameraTile {
  const st: any = hass.states[entityId];
  const base = entityId.replace(/^camera\.aarlo_/, "");
  const name = st?.attributes?.friendly_name ?? entityId;
  const online = !!st && st.state !== "unavailable";
  const snapshot = st?.attributes?.entity_picture;
  const motion =
    hass.states[`binary_sensor.aarlo_motion_${base}`]?.state === "on";
  const batteryRaw = hass.states[`sensor.aarlo_battery_level_${base}`]?.state;
  const batteryNum = Number(batteryRaw);
  const battery =
    batteryRaw !== undefined && !Number.isNaN(batteryNum)
      ? batteryNum
      : undefined;
  return { entity_id: entityId, name, snapshot, online, motion, battery };
}

@customElement("arlo-live-grid")
export class ArloLiveGrid extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) cameras: string[] = [];
  /** fixed desktop column count; 0/undefined = responsive auto-fit */
  @property({ type: Number }) columns = 0;
  /** snapshot refresh interval (seconds); 0 disables */
  @property({ type: Number }) refresh = 10;

  private _timer?: number;
  private _bust = 0;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.refresh > 0) {
      this._timer = window.setInterval(() => {
        this._bust = Date.now();
        this.requestUpdate();
      }, this.refresh * 1000);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) window.clearInterval(this._timer);
  }

  static styles = css`
    .grid {
      display: grid;
      gap: 8px;
    }
    .cam {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      overflow: hidden;
      background: #000;
      cursor: pointer;
    }
    .cam.offline {
      cursor: default;
      filter: grayscale(1) brightness(0.6);
    }
    .cam img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .label {
      position: absolute;
      left: 6px;
      bottom: 5px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-shadow: 0 1px 3px #000;
    }
    .badge {
      position: absolute;
      top: 6px;
      right: 6px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
    }
    .badge.motion {
      background: #ff9f0a;
      color: #1c1c1e;
      left: 6px;
      right: auto;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 4px;
      background: #34c759;
      vertical-align: middle;
    }
    .dot.off {
      background: #8e8e93;
    }
  `;

  private _open(entityId: string, online: boolean) {
    if (!online) return;
    this.dispatchEvent(
      new CustomEvent("open-live", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="grid" style="grid-template-columns:${gridTemplate(this.columns)}">
        ${this.cameras.map((id) => {
          const t = cameraTile(this.hass, id);
          const src = t.snapshot
            ? `${t.snapshot}${t.snapshot.includes("?") ? "&" : "?"}_b=${this._bust}`
            : undefined;
          return html`
            <div
              class="cam ${t.online ? "" : "offline"}"
              @click=${() => this._open(t.entity_id, t.online)}
            >
              ${src ? html`<img src=${src} alt=${t.name} />` : null}
              ${t.motion ? html`<span class="badge motion">motion</span>` : null}
              ${t.battery !== undefined
                ? html`<span class="badge">${t.battery}%</span>`
                : null}
              <span class="label">
                <span class="dot ${t.online ? "" : "off"}"></span>${t.name}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
