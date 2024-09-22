/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/engine-sound-generator/blob/main/LICENSE | MIT
 */

/*
 * Only used for testing as there already is an OscillatorNode interface that
 * can be used to generate a sine wave.
 */

const SAMPLING_RATE = 44100;

class ElectricEngineSoundGenerator extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase1 = 0; // Fase iniziale dell'oscillatore
    this.phase2 = 0;
  }

  static get parameterDescriptors() {
    return [
      {
        name: "rpm",
        defaultValue: 0.0,
        minValue: 0.0,
        automationRate: "a-rate",
      },
    ];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frequency = parameters.rpm;
    const div = 4;

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        // Calcolo della fase e del segnale audio
        const currentFreq =
          frequency.length > 1 ? frequency[i] / div : frequency[0] / div;
        outputChannel[i] = Math.sin(this.phase * 2 * Math.PI);

        // Calcolo delle due sinusoidi
        const sin1 = Math.sin(this.phase1 * 2 * Math.PI);
        const sin2 = Math.sin(this.phase2 * 2 * Math.PI);

        // Somma delle sinusoidi
        outputChannel[i] = (sin1 + sin2) / 2; // Media delle due onde per evitare clipping

        // Aggiornamento delle fasi
        this.phase1 += currentFreq / sampleRate;
        this.phase2 += currentFreq / 2.3 / sampleRate;

        // Reset delle fasi se superano 1 ciclo completo
        if (this.phase1 >= 1) this.phase1 -= 1;
        if (this.phase2 >= 1) this.phase2 -= 1;

        // Aggiorna la fase per il campione successivo
        this.phase += currentFreq / SAMPLING_RATE;

        if (this.phase >= 1) {
          this.phase -= 1;
        }
      }
    }

    return true;
  }
}

registerProcessor(
  "electric-engine-audio-processor",
  ElectricEngineSoundGenerator
);
