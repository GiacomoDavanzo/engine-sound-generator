const SAMPLING_RATE = 44100; // Standard audio digitale

const SIN_RATIOS = [1, 1.5, 1.8];

// Parametri del vibrato
const VIBRATO_FREQUENCY = 5; // Frequenza del vibrato (Hz)
const VIBRATO_AMPLITUDE = 30; // Ampiezza del vibrato (Hz)

// Mappare RPM alla frequenza in modo non lineare ()
function mapRpmToFrequency(rpm) {
  const MAX_RPM = 10000; // Assumiamo questo come valore massimo di RPM
  const MIN_FREQ = 20; // Frequenza minima in Hz
  const MAX_FREQ = 2000; // Frequenza massima in Hz
  const EXPONENT = 0.75; // Esponente per la curva di frequenza (tra 0.5 e 1)

  // Usiamo una funzione di potenza per un aumento più graduale
  const normalizedRpm = Math.min(rpm, MAX_RPM) / MAX_RPM;
  return MIN_FREQ + (MAX_FREQ - MIN_FREQ) * Math.pow(normalizedRpm, EXPONENT);
}

class ElectricEngineSoundGenerator extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lfoPhase = 0; // Inizializza la fase del LFO
    for (let i = 1; i <= SIN_RATIOS.length; i++) {
      this[`phase${i}`] = 0;
    }
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
        const baseFrequency = mapRpmToFrequency(currentRpm);

        // Calcolo della frequenza modulata (vibrato)
        const vibratoOffset =
          Math.sin(this.lfoPhase * 2 * Math.PI) * VIBRATO_AMPLITUDE;
        const modulatedFreq = baseFrequency + vibratoOffset;

        // Somma delle sinusoidi con la frequenza modulata dal vibrato
        outputChannel[i] =
          SIN_RATIOS.reduce((accumulator, _, index) => {
            const phase = this[`phase${index + 1}`];
            return accumulator + Math.sin(phase * 2 * Math.PI); // Somma delle sinusoidi
          }, 0) / SIN_RATIOS.length; // Media delle sinusoidi

        // Aggiorno tutte le fasi delle sinusoidi
        for (let j = 1; j <= SIN_RATIOS.length; j++) {
          this[`phase${j}`] +=
            (modulatedFreq * SIN_RATIOS[j - 1]) / 8 / SAMPLING_RATE;

          // Se la fase supera 1 (un ciclo completo), la resetto
          if (this[`phase${j}`] >= 1) {
            this[`phase${j}`] -= 1;
          }
        }

        // Aggiorno la fase del LFO (per il vibrato)
        this.lfoPhase += VIBRATO_FREQUENCY / SAMPLING_RATE;
        if (this.lfoPhase >= 1) {
          this.lfoPhase -= 1;
        }
      }
    }

    return true; // Continua l'elaborazione
  }
}

registerProcessor(
  "electric-engine-audio-processor",
  ElectricEngineSoundGenerator
);
