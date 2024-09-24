const SAMPLING_RATE = 44100; // Standard audio digitale

const BASE_FREQUENCIES = [190, 380, 650, 985, 1225, 1960];

const PITCH_LOWERING_FACTOR = 4; // Per legare la frequenza agli RPM

// Parametri del vibrato
const VIBRATO_FREQUENCY = 100; // Frequenza del vibrato (Hz)
const VIBRATO_AMPLITUDE = 20; // Ampiezza del vibrato (Hz)

// Parametri per il whine del motore elettrico
const WHINE_OFFSET = 1700; // Offset in Hz per il whine
const WHINE_AMPLITUDE = 0.05; // Ampiezza del whine (0-1)

// Mappare RPM alla frequenza in modo non lineare
function mapRpmToFrequencyOffset(rpm) {
  const MAX_RPM = 10000; // Assumiamo questo come valore massimo di RPM
  const MAX_FREQ_OFFSET = 2000; // Massimo offset di frequenza in Hz
  const EXPONENT = 0.5; // Esponente per la curva di frequenza (tra 0.5 e 1)

  // Usiamo una funzione di potenza per un aumento più graduale
  const normalizedRpm = Math.min(rpm, MAX_RPM) / MAX_RPM;
  return MAX_FREQ_OFFSET * Math.pow(normalizedRpm, EXPONENT);
}

class ElectricEngineSoundGenerator extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lfoPhase = 0; // Inizializza la fase del LFO
    this.whinePhase = 0; // Inizializza la fase del whine

    // Inizializza le fasi per ogni onda sinusoidale
    this.phases = BASE_FREQUENCIES.map(() => 0);
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
    const rpm = parameters.rpm;

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        const currentRpm = rpm.length > 1 ? rpm[i] : rpm[0];
        const frequencyOffset = mapRpmToFrequencyOffset(currentRpm);

        // Calcolo della frequenza modulata (vibrato)
        const vibratoOffset =
          Math.sin(this.lfoPhase * 2 * Math.PI) * VIBRATO_AMPLITUDE;

        // Somma delle sinusoidi con la frequenza modulata dal vibrato
        let sample =
          BASE_FREQUENCIES.reduce((accumulator, freq, index) => {
            const adjustedFreq = freq + frequencyOffset + vibratoOffset;
            return accumulator + Math.sin(this.phases[index] * 2 * Math.PI);
          }, 0) / BASE_FREQUENCIES.length; // Media delle sinusoidi

        // Aggiunta del whine come offset della frequenza base
        const whineFreq = BASE_FREQUENCIES[0] + frequencyOffset + WHINE_OFFSET;
        sample += WHINE_AMPLITUDE * Math.sin(this.whinePhase * 2 * Math.PI);

        outputChannel[i] = sample;

        // Aggiorno tutte le fasi delle sinusoidi
        BASE_FREQUENCIES.forEach((freq, index) => {
          const adjustedFreq = freq + frequencyOffset + vibratoOffset;
          this.phases[index] +=
            adjustedFreq / PITCH_LOWERING_FACTOR / SAMPLING_RATE;

          // Se la fase supera 1 (ciclo completo), la resetto
          if (this.phases[index] >= 1) {
            this.phases[index] -= 1;
          }
        });

        // Aggiorno la fase del whine
        this.whinePhase += whineFreq / SAMPLING_RATE;
        if (this.whinePhase >= 1) {
          this.whinePhase -= 1;
        }

        // Aggiorno la fase del LFO per il vibrato
        this.lfoPhase += VIBRATO_FREQUENCY / SAMPLING_RATE;
        if (this.lfoPhase >= 1) {
          this.lfoPhase -= 1;
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
