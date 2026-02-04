
/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, Prompt } from './types';
import { GoogleGenAI, LiveMusicFilteredPrompt } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'lyria-realtime-exp';

function main() {
  const initialPrompts = buildInitialPrompts();

  const pdjMidi = new PromptDjMidi(initialPrompts, GENRE_LIBRARY);
  document.body.appendChild(pdjMidi);

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);
  liveMusicHelper.setWeightedPrompts(initialPrompts);

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  pdjMidi.addEventListener('prompts-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    const prompts = customEvent.detail;
    liveMusicHelper.setWeightedPrompts(prompts);
  }));

  pdjMidi.addEventListener('tempo-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.tempoBpm = customEvent.detail;
  }));

  pdjMidi.addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    pdjMidi.playbackState = playbackState;
    playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
  }));

  liveMusicHelper.addEventListener('filtered-prompt', ((e: Event) => {
    const customEvent = e as CustomEvent<LiveMusicFilteredPrompt>;
    const filteredPrompt = customEvent.detail;
    toastMessage.show(filteredPrompt.filteredReason!)
    pdjMidi.addFilteredPrompt(filteredPrompt.text!);
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
  });

  liveMusicHelper.addEventListener('error', errorToast);
  pdjMidi.addEventListener('error', errorToast);

  audioAnalyser.addEventListener('audio-level-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<number>;
    const level = customEvent.detail;
    pdjMidi.audioLevel = level;
  }));

}

function buildInitialPrompts() {
  const startOn = [...GENRE_LIBRARY]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const prompts = new Map<string, Prompt>();

  for (let i = 0; i < 16; i++) {
    const promptId = `prompt-${i}`;
    const genre = GENRE_LIBRARY[i % GENRE_LIBRARY.length];
    const { text, color, instruments } = genre;
    prompts.set(promptId, {
      promptId,
      text,
      weight: startOn.includes(genre) ? 1 : 0,
      cc: i,
      color,
      density: 0.5,
      instruments: instruments || [],
      selectedInstrument: instruments ? instruments[0] : undefined,
    });
  }

  return prompts;
}

const GENRE_LIBRARY = [
  { color: '#9900ff', text: 'Bossa Nova', instruments: ['Acoustic Guitar', 'Nylon Strings', 'Piano', 'Flute'] },
  { color: '#5200ff', text: 'Chillwave', instruments: ['Synth Pad', 'Soft Lead', 'Drum Machine'] },
  { color: '#ff25f6', text: 'Drum and Bass', instruments: ['Sub Bass', 'Reese Bass', 'Sharp Synth'] },
  { color: '#2af6de', text: 'Post Punk', instruments: ['Chorus Guitar', 'Driving Bass', 'Lo-fi Drums'] },
  { color: '#ffdd28', text: 'Shoegaze', instruments: ['Distorted Guitar', 'Reverb Pad', 'Soft Vocals'] },
  { color: '#2af6de', text: 'Funk', instruments: ['Slap Bass', 'Wah Guitar', 'Clavinet', 'Brass'] },
  { color: '#9900ff', text: 'Chiptune', instruments: ['Square Wave', 'Pulse Wave', 'Noise Percursion'] },
  { color: '#3dffab', text: 'Lush Strings', instruments: ['Cello', 'Violin Section', 'Harp'] },
  { color: '#d8ff3e', text: 'Sparkling Arpeggios', instruments: ['Plucked Synth', 'Glockenspiel', 'Celesta'] },
  { color: '#d9b2ff', text: 'Staccato Rhythms', instruments: ['Marimba', 'Pizzicato Strings', 'Woodblock'] },
  { color: '#3dffab', text: 'Punchy Kick', instruments: ['808 Kick', '909 Kick', 'Analog Kick'] },
  { color: '#ffdd28', text: 'Dubstep', instruments: ['Wobble Bass', 'Gritty Lead', 'Heavy Snares'] },
  { color: '#ff25f6', text: 'K Pop', instruments: ['Pop Synth', 'Bright Piano', 'Trap Beats'] },
  { color: '#d8ff3e', text: 'Neo Soul', instruments: ['Rhodes Piano', 'Warm Bass', 'Clean Guitar'] },
  { color: '#5200ff', text: 'Trip Hop', instruments: ['Jazz Trumpet', 'Vinyl Scratches', 'Upright Bass'] },
  { color: '#d9b2ff', text: 'Thrash', instruments: ['Heavy Metal Guitar', 'Double Kick Drums', 'Raw Bass'] },
  { color: '#ff4b2b', text: 'Techno', instruments: ['FM Lead', 'Industrial Percussion', 'Acid Synth'] },
  { color: '#00d2ff', text: 'Deep House', instruments: ['Soulful Vocal', 'Muted Organ', 'Classic 909'] },
  { color: '#ff0099', text: 'Synthwave', instruments: ['DX7 Bell', 'Analog Strings', 'Retro Drums'] },
  { color: '#8e44ad', text: 'Lo-Fi Hip Hop', instruments: ['Muted Piano', 'Warm Pad', 'Lazy Drums'] },
  { color: '#2ecc71', text: 'Eurodance', instruments: ['Trance Lead', 'Housetrance Piano', 'Snare Roll'] },
  { color: '#34495e', text: 'Grime', instruments: ['Squelchy Bass', 'Dirty Lead', 'Aggressive Percussion'] },
  { color: '#f1c40f', text: 'Acid Jazz', instruments: ['Hammond Organ', 'Tenor Sax', 'Walking Bass'] },
  { color: '#ff79c6', text: 'Vaporwave', instruments: ['Saxophone', 'Pitch-shifted Pad', 'Electric Piano'] },
  { color: '#7f8c8d', text: 'Industrial', instruments: ['Distorted Percussion', 'Metallic Pad', 'Noisy Lead'] },
  { color: '#e67e22', text: 'Reggaeton', instruments: ['Dembow Rhythm', 'Sub Kick', 'Brass Hits'] },
  { color: '#95a5a6', text: 'Ska', instruments: ['Upstroke Guitar', 'Walking Bassline', 'Trombone'] },
  { color: '#ecf0f1', text: 'Gospel', instruments: ['Grand Piano', 'B3 Organ', 'Choral Vocals'] },
  { color: '#d35400', text: 'Bluegrass', instruments: ['Banjo', 'Mandolin', 'Fiddle', 'Upright Bass'] },
  { color: '#c0392b', text: 'Hardstyle', instruments: ['Distorted Kick', 'Screech Lead', 'Rave Pad'] },
  { color: '#1abc9c', text: 'Afrobeat', instruments: ['Polyrythmic Drums', 'Funk Guitar', 'Baritone Sax'] },
  { color: '#3498db', text: 'Ambient', instruments: ['Shimmer Pad', 'Ethereal Textures', 'Soft Piano'] },
  { color: '#9b59b6', text: 'Garage', instruments: ['Skippy Beats', 'Warped Vocal', 'Organ Bass'] },
  { color: '#f39c12', text: 'Disco', instruments: ['String Section', 'Octave Bass', 'Cowbell'] },
  { color: '#e74c3c', text: 'Heavy Metal', instruments: ['Overdriven Guitar', 'Power Bass', 'Aggressive Drums'] },
  { color: '#bdc3c7', text: 'Minimal', instruments: ['Clockwork Percussion', 'Sine Bass', 'Clicky Snares'] },
  { color: '#2c3e50', text: 'Trap', instruments: ['Rapid Hats', 'Boomy 808', 'Dark Pluck'] },
  { color: '#f1c40f', text: 'Ragtime', instruments: ['Honky Tonk Piano', 'Tack Piano', 'Banjo'] },
];

main();
