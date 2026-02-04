
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import type { Prompt } from '../types';

@customElement('influence-monitor')
export class InfluenceMonitor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      background: #000a;
      backdrop-filter: blur(10px);
      border: 1px solid #fff2;
      border-radius: 1.5vmin;
      padding: 1.5vmin;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .monitor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1vmin;
      border-bottom: 1px solid #fff1;
      padding-bottom: 0.5vmin;
    }
    .monitor-title {
      font-size: 1.2vmin;
      font-weight: 800;
      color: #fff6;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .slots-container {
      display: flex;
      flex-direction: column;
      gap: 1vmin;
    }
    .slot-row {
      display: grid;
      grid-template-columns: 8vmin 1fr 4vmin;
      align-items: center;
      gap: 1.5vmin;
    }
    .slot-info {
      font-size: 1.1vmin;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #fffa;
    }
    .waveform-canvas {
      width: 100%;
      height: 3vmin;
      background: #fff05;
      border-radius: 0.4vmin;
    }
    .influence-badge {
      font-family: monospace;
      font-size: 1.1vmin;
      text-align: right;
      color: var(--genre-color, #fff);
      font-weight: bold;
    }
  `;

  @property({ type: Array }) activePrompts: Prompt[] = [];
  @property({ type: Number }) audioLevel = 0;

  @query('.slots-container') private container!: HTMLElement;

  private rafId: number | null = null;
  private phases: Map<string, number> = new Map();

  override firstUpdated() {
    this.renderWaveforms();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private renderWaveforms() {
    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (canvases) {
      // Fix: Added index 'i' to the forEach callback to resolve the "Cannot find name 'i'" error on line 117
      canvases.forEach((canvas, i) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const promptId = canvas.dataset.id || '';
        const prompt = this.activePrompts.find(p => p.promptId === promptId);
        if (!prompt) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        // Influence determines line thickness and opacity
        const influence = prompt.weight / 2;
        ctx.strokeStyle = prompt.color;
        ctx.lineWidth = 1 + influence * 3;
        ctx.globalAlpha = 0.3 + influence * 0.7;

        let phase = this.phases.get(promptId) || 0;
        phase += 0.1 + influence * 0.2;
        this.phases.set(promptId, phase);

        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          // Simulate waveform using audioLevel and weight
          // 'i' is the index of the current canvas being processed
          const freq = 0.05 + (i / 100);
          const amp = (h / 2.5) * influence * (0.5 + this.audioLevel * 1.5);
          const y = h / 2 + Math.sin(x * freq + phase) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }
    this.rafId = requestAnimationFrame(() => this.renderWaveforms());
  }

  override render() {
    const totalWeight = this.activePrompts.reduce((acc, p) => acc + p.weight, 0) || 1;

    return html`
      <div class="monitor-header">
        <div class="monitor-title">Live Influence Monitor</div>
      </div>
      <div class="slots-container">
        ${this.activePrompts.map(p => {
          const influencePct = Math.round((p.weight / totalWeight) * 100);
          return html`
            <div class="slot-row" style="--genre-color: ${p.color}">
              <div class="slot-info" title="${p.text} - ${p.selectedInstrument}">
                ${p.text}
              </div>
              <canvas 
                class="waveform-canvas" 
                data-id="${p.promptId}" 
                width="200" 
                height="40">
              </canvas>
              <div class="influence-badge">${influencePct}%</div>
            </div>
          `;
        })}
        ${this.activePrompts.length === 0 ? html`<div style="color: #fff2; font-size: 1.1vmin; text-align: center; padding: 1vmin;">No active signals...</div>` : ''}
      </div>
    `;
  }
}
