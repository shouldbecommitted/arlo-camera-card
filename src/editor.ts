import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "custom-card-helpers";
import { CardConfig } from "./types";

// ha-form lives in the HA frontend at runtime; it isn't bundled with the card.
// The schema below drives a fully native Lovelace editor for our config.
const SCHEMA = [
  {
    name: "cameras",
    selector: {
      entity: { domain: "camera", multiple: true },
    },
  },
  {
    name: "default_mode",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "live", label: "Live" },
          { value: "recordings", label: "Recordings" },
        ],
      },
    },
  },
  {
    name: "columns",
    selector: { number: { min: 1, max: 8, mode: "box" } },
  },
  {
    name: "snapshot_refresh",
    selector: { number: { min: 0, mode: "box", unit_of_measurement: "s" } },
  },
  {
    name: "library_days",
    selector: { number: { min: 1, mode: "box", unit_of_measurement: "d" } },
  },
] as const;

const LABELS: Record<string, string> = {
  cameras: "Cameras (defaults to every camera.aarlo_* entity)",
  default_mode: "Default mode",
  columns: "Columns (blank = responsive auto-fit)",
  snapshot_refresh: "Live snapshot refresh",
  library_days: "Recordings history to load",
};

@customElement("arlo-camera-card-editor")
export class ArloCameraCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config: CardConfig = { type: "custom:arlo-camera-card" };

  setConfig(config: CardConfig): void {
    this._config = config;
  }

  private _label = (schema: { name: string }) =>
    LABELS[schema.name] ?? schema.name;

  private _valueChanged(ev: CustomEvent) {
    const config = ev.detail.value as CardConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.hass) return html``;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._label}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}
