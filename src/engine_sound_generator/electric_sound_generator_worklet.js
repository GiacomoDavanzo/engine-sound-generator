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
    this.phase = 0; // Fase iniziale dell'oscillatore
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

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        // Calcolo della fase e del segnale audio
        const currentFreq = frequency.length > 1 ? frequency[i] : frequency[0];
        outputChannel[i] = Math.sin(this.phase * 2 * Math.PI);

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
