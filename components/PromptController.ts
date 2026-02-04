
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import './WeightKnob';
import type { WeightKnob } from './WeightKnob';

import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    weight-knob {
      width: 70%;
      flex-shrink: 0;
    }
    #midi {
      font-family: monospace;
      text-align: center;
      font-size: 1.5vmin;
      border: 0.2vmin solid #fff;
      border-radius: 0.5vmin;
      padding: 2px 5px;
      color: #fff;
      background: #0006;
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: 0.75vmin;
      .learn-mode & {
        color: orange;
        border-color: orange;
      }
      .show-cc & {
        visibility: visible;
      }
    }
    .text-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 0.5vmin;
      position: relative;
      width: 100%;
    }
    #text {
      font-weight: 500;
      font-size: 1.8vmin;
      max-width: 14vmin;
      min-width: 2vmin;
      padding: 0.1em 0.3em;
      flex-shrink: 0;
      border-radius: 0.25vmin;
      text-align: center;
      white-space: pre;
      overflow: hidden;
      border: none;
      outline: none;
      -webkit-font-smoothing: antialiased;
      background: #000;
      color: #fff;
      cursor: text;
      transition: background-color 0.2s;
      &:not(:focus) {
        text-overflow: ellipsis;
      }
    }
    .dropdown-trigger {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff2;
      border: none;
      border-radius: 50%;
      width: 2.2vmin;
      height: 2.2vmin;
      cursor: pointer;
      padding: 0;
      color: #fff;
      font-size: 1.2vmin;
      opacity: 0.6;
      transition: opacity 0.2s, background 0.2s, transform 0.2s;
      &:hover {
        opacity: 1;
        background: #fff4;
        transform: scale(1.1);
      }
    }
    select#genre-select {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      top: 0;
      left: 0;
      cursor: pointer;
      appearance: none;
      z-index: 2;
    }
    .density-control {
      margin-top: 1vmin;
      width: 80%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(5px);
    }
    .active .density-control {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }
    .density-label {
      font-size: 1vmin;
      color: #fff8;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: bold;
    }
    input[type=range] {
      width: 100%;
      height: 4px;
      background: #fff2;
      border-radius: 2px;
      outline: none;
      cursor: pointer;
      accent-color: var(--genre-color, #fff);
    }
    :host([filtered]) {
      weight-knob { 
        opacity: 0.5;
      }
      #text {
        background: #da2000;
        z-index: 1;
      }
    }
    @media only screen and (max-width: 600px) {
      #text {
        font-size: 2.3vmin;
        max-width: 18vmin;
      }
      weight-knob {
        width: 60%;
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';
  @property({ type: Number }) density = 0.5;
  @property({ type: Array }) instruments: string[] = [];
  @property({ type: String }) selectedInstrument = '';
  @property({ type: Boolean, reflect: true }) filtered = false;

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0;

  @property({ type: Boolean }) learnMode = false;
  @property({ type: Boolean }) showCC = false;

  @query('weight-knob') private weightInput!: WeightKnob;
  @query('#text') private textInput!: HTMLInputElement;

  @property({ type: Array }) genreLibrary: {text: string, color: string, instruments?: string[]}[] = [];

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;

  private lastValidText!: string;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', (e: Event) => {
      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.learnMode) {
        this.cc = cc;
        this.channel = channel;
        this.learnMode = false;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    });
  }

  override firstUpdated() {
    this.textInput.setAttribute('contenteditable', 'plaintext-only');
    this.textInput.textContent = this.text;
    this.lastValidText = this.text;
  }

  update(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showCC') && !this.showCC) {
      this.learnMode = false;
    }
    if (changedProperties.has('text') && this.textInput && !this.textInput.matches(':focus')) {
      this.textInput.textContent = this.text;
    }
    super.update(changedProperties);
  }

  private dispatchPromptChange() {
    this.dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
          density: this.density,
          instruments: this.instruments,
          selectedInstrument: this.selectedInstrument,
        },
      }),
    );
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.textInput.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.resetText();
      this.textInput.blur();
    }
  }

  private resetText() {
    this.text = this.lastValidText;
    this.textInput.textContent = this.lastValidText;
  }

  private async updateText() {
    const newText = this.textInput.textContent?.trim();
    if (!newText) {
      this.resetText();
    } else {
      this.text = newText;
      this.lastValidText = newText;
    }
    this.dispatchPromptChange();
    this.textInput.scrollLeft = 0;
  }

  private handleGenreSelect(e: Event) {
    const select = e.target as HTMLSelectElement;
    const selectedText = select.value;
    const genre = this.genreLibrary.find(g => g.text === selectedText);
    if (genre) {
      this.text = genre.text;
      this.color = genre.color;
      this.instruments = [...(genre.instruments || [])];
      this.selectedInstrument = this.instruments[0] || '';
      this.textInput.textContent = genre.text;
      this.lastValidText = genre.text;
      this.requestUpdate();
      this.dispatchPromptChange();
    }
    // Reset selection so the "Select Genre..." placeholder works next time
    select.value = "";
  }

  private handleDensityChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.density = parseFloat(input.value);
    this.dispatchPromptChange();
  }

  private onFocus() {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(this.textInput);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private toggleLearnMode() {
    this.learnMode = !this.learnMode;
  }

  override render() {
    const isActive = this.weight > 0;
    const classes = classMap({
      'prompt': true,
      'learn-mode': this.learnMode,
      'show-cc': this.showCC,
      'active': isActive,
    });
    return html`<div class=${classes} style="--genre-color: ${this.color}">
      <weight-knob
        id="weight"
        value=${this.weight}
        color=${this.filtered ? '#888' : this.color}
        audioLevel=${this.filtered ? 0 : this.audioLevel}
        @input=${this.updateWeight}></weight-knob>
      
      <div class="text-container">
        <span
          id="text"
          spellcheck="false"
          @focus=${this.onFocus}
          @keydown=${this.onKeyDown}
          @blur=${this.updateText}></span>
        
        <div style="position: relative;">
          <button class="dropdown-trigger" aria-label="Genre Library">
            ▾
          </button>
          <select id="genre-select" @change=${this.handleGenreSelect}>
            <option value="" disabled selected>Genre</option>
            ${this.genreLibrary.map(g => html`<option value=${g.text}>${g.text}</option>`)}
          </select>
        </div>
      </div>

      <div class="density-control">
        <div class="density-label">Density</div>
        <input type="range" min="0" max="1" step="0.05" .value=${this.density.toString()} @input=${this.handleDensityChange}>
      </div>

      <div id="midi" @click=${this.toggleLearnMode}>
        ${this.learnMode ? 'Learn' : `CC:${this.cc}`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}
