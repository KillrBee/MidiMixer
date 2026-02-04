
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import './InfluenceMonitor';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      background: #000;
      color: #fff;
      overflow: hidden;
    }
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: #111;
      transition: background-image 0.5s ease;
    }
    header {
      position: absolute;
      top: 0;
      width: 100%;
      padding: 2vmin 4vmin;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
      background: linear-gradient(to bottom, #000a, transparent);
      z-index: 20;
    }
    .tempo-container {
      display: flex;
      align-items: center;
      gap: 1.5vmin;
      background: #fff1;
      padding: 1vmin 2vmin;
      border-radius: 1vmin;
      backdrop-filter: blur(5px);
    }
    .tempo-label {
      font-size: 1.5vmin;
      font-weight: 700;
      color: #fff8;
    }
    .tempo-value {
      font-family: monospace;
      font-size: 2vmin;
      color: #00ffcc;
      min-width: 6vmin;
    }
    #tempo-slider {
      width: 15vmin;
      accent-color: #00ffcc;
    }
    #main-content {
      display: flex;
      width: 100%;
      height: 100%;
      justify-content: center;
      align-items: center;
      gap: 4vmin;
      padding: 10vmin 5vmin 5vmin;
      box-sizing: border-box;
    }
    #grid {
      width: 70vmin;
      height: 70vmin;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.5vmin;
      flex-shrink: 0;
    }
    #side-panel {
      width: 35vmin;
      height: 75vmin;
      display: flex;
      flex-direction: column;
      gap: 2vmin;
    }
    #inspector {
      flex: 1;
      background: #ffffff0a;
      backdrop-filter: blur(25px);
      border: 1px solid #ffffff1a;
      padding: 2.5vmin;
      border-radius: 2vmin;
      display: flex;
      flex-direction: column;
      gap: 1.5vmin;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #fff4 transparent;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .inspector-title {
      font-size: 2.2vmin;
      font-weight: 800;
      border-bottom: 2px solid #fff2;
      padding-bottom: 1vmin;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1vmin;
    }
    .active-genre-item {
      display: flex;
      flex-direction: column;
      gap: 0.8vmin;
      padding: 1.5vmin;
      background: #fff1;
      border-radius: 1.2vmin;
      border-left: 6px solid var(--genre-color);
      transition: all 0.2s;
      position: relative;
      &:hover {
        transform: translateX(5px);
        background: #fff2;
      }
    }
    .genre-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .genre-name {
      font-weight: 700;
      font-size: 1.8vmin;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 1vmin;
    }
    .inst-indicator {
      width: 1vmin;
      height: 1vmin;
      border-radius: 50%;
      background: var(--genre-color);
      box-shadow: 0 0 10px var(--genre-color);
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.4; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1.2); }
    }
    .genre-slot-id {
      font-size: 1.2vmin;
      color: #fff6;
      font-family: monospace;
    }
    .instrument-label {
      font-size: 1.1vmin;
      color: #fff6;
      text-transform: uppercase;
      font-weight: bold;
    }
    .instrument-select {
      background: #000;
      color: #fff;
      border: 1px solid #fff3;
      border-radius: 0.6vmin;
      font-size: 1.5vmin;
      padding: 0.8vmin;
      width: 100%;
      outline: none;
      cursor: pointer;
      &:focus {
        border-color: var(--genre-color);
      }
    }
    #buttons {
      display: flex;
      gap: 10px;
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0004;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff;
      border-radius: 4px;
      user-select: none;
      padding: 4px 8px;
      transition: all 0.2s;
      &.active {
        background-color: #fff;
        color: #000;
      }
    }
    #controls-footer {
      position: absolute;
      bottom: 4vmin;
      display: flex;
      align-items: center;
      gap: 4vmin;
      z-index: 30;
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;
  private genreLibrary: {text: string, color: string, instruments?: string[]}[] = [];

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @state() public audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private tempoBpm = 120;

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor(
    initialPrompts: Map<string, Prompt>,
    genreLibrary: {text: string, color: string, instruments?: string[]}[] = [],
  ) {
    super();
    this.prompts = initialPrompts;
    this.genreLibrary = genreLibrary;
    this.midiDispatcher = new MidiDispatcher();
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const detail = e.detail;
    const { promptId } = detail;
    const prompt = this.prompts.get(promptId);

    if (!prompt) return;

    Object.assign(prompt, detail);

    const newPrompts = new Map(this.prompts);
    newPrompts.set(promptId, { ...prompt });

    this.prompts = newPrompts;
    this.requestUpdate();

    this.dispatchEvent(new CustomEvent('prompts-changed', { detail: this.prompts }));
  }

  private handleTempoInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value);
    this.tempoBpm = val;
    this.dispatchEvent(new CustomEvent('tempo-changed', { detail: val }));
  }

  private handleInstrumentChange(promptId: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    const prompt = this.prompts.get(promptId);
    if (prompt) {
      prompt.selectedInstrument = select.value;
      this.handlePromptChanged(new CustomEvent('prompt-changed', { detail: prompt }));
    }
  }

  private readonly makeBackground = throttle(() => {
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    const MAX_WEIGHT = 0.5;
    const MAX_ALPHA = 0.6;
    const bg: string[] = [];
    [...this.prompts.values()].forEach((p, i) => {
      const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
      const alpha = Math.round(alphaPct * 0xff).toString(16).padStart(2, '0');
      const stop = p.weight / 2;
      const x = (i % 4) / 3;
      const y = Math.floor(i / 4) / 3;
      bg.push(`radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`);
    });
    return bg.join(', ');
  }, 30);

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) return;
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e: any) {
      this.showMidi = false;
      this.dispatchEvent(new CustomEvent('error', {detail: e.message}));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.midiDispatcher.activeMidiInputId = selectElement.value;
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  override render() {
    const bg = styleMap({ backgroundImage: this.makeBackground() });
    const activePrompts = [...this.prompts.values()].filter(p => p.weight > 0);

    return html`
      <div id="background" style=${bg}></div>
      
      <header>
        <div id="buttons">
          <button @click=${() => this.setShowMidi(!this.showMidi)} class=${this.showMidi ? 'active' : ''}>MIDI</button>
          <select @change=${this.handleMidiInputChange} .value=${this.activeMidiInputId || ''} style=${this.showMidi ? '' : 'visibility: hidden'}>
            ${this.midiInputIds.map(id => html`<option value=${id}>${this.midiDispatcher.getDeviceName(id)}</option>`)}
          </select>
        </div>

        <div class="tempo-container">
          <div class="tempo-label">TEMPO</div>
          <div class="tempo-value">${this.tempoBpm} BPM</div>
          <input id="tempo-slider" type="range" min="60" max="200" .value=${this.tempoBpm.toString()} @input=${this.handleTempoInput}>
        </div>
      </header>

      <div id="main-content">
        <div id="grid">${this.renderPrompts()}</div>
        
        <div id="side-panel">
          <influence-monitor 
            .activePrompts=${activePrompts} 
            .audioLevel=${this.audioLevel}>
          </influence-monitor>

          <div id="inspector">
            <div class="inspector-title">Active Styles</div>
            ${activePrompts.length === 0 ? html`<div style="color: #fff4; font-size: 1.6vmin; text-align: center; margin-top: 4vmin;">Increase weight on a slot to mix styles...</div>` : ''}
            ${activePrompts.map(p => {
              const slotIndex = parseInt(p.promptId.split('-')[1]) + 1;
              return html`
                <div class="active-genre-item" style="--genre-color: ${p.color}">
                  <div class="genre-header">
                    <div class="genre-name">
                      <div class="inst-indicator"></div>
                      ${p.text}
                    </div>
                    <div class="genre-slot-id">Slot ${slotIndex}</div>
                  </div>
                  <div class="instrument-label">Lead: ${p.selectedInstrument}</div>
                  <select class="instrument-select" @change=${(e: Event) => this.handleInstrumentChange(p.promptId, e)}>
                    ${(p.instruments || []).map(inst => html`<option value=${inst} ?selected=${p.selectedInstrument === inst}>${inst}</option>`)}
                  </select>
                </div>
              `;
            })}
          </div>
        </div>
      </div>

      <div id="controls-footer">
        <play-pause-button .playbackState=${this.playbackState} @click=${this.playPause}></play-pause-button>
      </div>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => html`
      <prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        density=${prompt.density}
        .instruments=${prompt.instruments}
        selectedInstrument=${prompt.selectedInstrument}
        .genreLibrary=${this.genreLibrary}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>
    `);
  }
}
