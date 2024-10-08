const SAMPLING_RATE = 44100; // Standard audio digitale

const BASE_FREQUENCIES = [1, 190, 380, 650, 985, 1225, 1960];

const PITCH_LOWERING_FACTOR = 5; // Abbasso il pitch, per poter legare la frequenza agli RPM

// Parametri LFO
const MIN_LFO_FREQUENCY = 5; // Frequenza minima dell'LFO (Hz)
const MAX_LFO_FREQUENCY = 100; // Frequenza massima dell'LFO (Hz)
const MIN_LFO_AMPLITUDE = 30; // Ampiezza minima del vibrato (Hz)
const MAX_LFO_AMPLITUDE = 20; // Ampiezza massima del vibrato (Hz)

// "Whine" del motore elettrico
const WHINE_OFFSET = 1700; // Offset rispetto alla prima BASE_FREQUENCY
const WHINE_AMPLITUDE = 0.005;

// Attenuazione del volume ad alti RPM
const ATTENUATION_START_RPM = 6900;
const ATTENUATION_END_RPM = 7300;

// Costanti riguardanti il motore
const MAX_RPM = 7500;
const IDLING_ENGINE_RPM = 700;

const WAFE_FUNC = customEnvelopeWave; // Costante utile per cambiare l'onda

// Mappare RPM alla frequenza in modo non lineare
function mapRpmToFrequencyOffset(rpm) {
  const MAX_FREQ_OFFSET = 1300;

  // Usiamo una funzione di potenza per un aumento più graduale
  const normalizedRpm = Math.min(rpm, MAX_RPM) / MAX_RPM;
  return MAX_FREQ_OFFSET * normalizedRpm;
}

// Funzione per calcolare l'attenuazione del volume basata sugli RPM
function calculateVolumeAttenuation(rpm) {
  if (rpm <= ATTENUATION_START_RPM) {
    return 1; // Nessuna attenuazione
  } else if (rpm >= ATTENUATION_END_RPM) {
    return 0; // Completamente muto
  } else {
    // Calcolo del valore per valori intermedi
    return (
      1 -
      (rpm - ATTENUATION_START_RPM) /
        (ATTENUATION_END_RPM - ATTENUATION_START_RPM)
    );
  }
}

// Funzione per mappare RPM alla frequenza dell'LFO
function mapRpmToLfoFrequency(rpm) {
  if (rpm <= IDLING_ENGINE_RPM) {
    return MIN_LFO_FREQUENCY;
  }
  const normalizedRpm =
    (Math.min(rpm, MAX_RPM) - IDLING_ENGINE_RPM) /
    (MAX_RPM - IDLING_ENGINE_RPM);
  return (
    MIN_LFO_FREQUENCY + (MAX_LFO_FREQUENCY - MIN_LFO_FREQUENCY) * normalizedRpm
  );
}

// Mappa gli RPM all'ampiezza dell'LFO
function mapRpmToLfoAmplitude(rpm) {
  const normalizedRpm = Math.min(rpm, MAX_RPM) / MAX_RPM;
  return (
    MIN_LFO_AMPLITUDE + (MAX_LFO_AMPLITUDE - MIN_LFO_AMPLITUDE) * normalizedRpm
  );
}

// Funzione per generare un'onda a dente di sega
function sawtooth(phase) {
  return 2 * (phase - Math.floor(0.5 + phase));
}

// Funzione per generare un'onda quadra
function squareWave(phase) {
  return phase % 1 < 0.5 ? 1 : -1;
}

function sinWave(phase) {
  return Math.sin(2 * Math.PI * phase);
}

// Funzione per generare un'onda con inviluppo personalizzato
function customEnvelopeWave(phase) {
  const x = 2 * Math.PI * phase;
  const sinePart = Math.sin(x);
  const flatteningFactor = Math.pow(Math.cos(x / 2), 2);
  return sinePart * flatteningFactor;
}
// Funzione per generare rumore bianco
function generateWhiteNoise() {
  return Math.random() * 2 - 1;
}

// Funzione per mappare gli RPM all'ampiezza del rumore bianco
function mapRpmToNoiseAmplitude(rpm) {
  if (rpm <= IDLING_ENGINE_RPM) {
    return 0; // Nessun rumore bianco al minimo
  }
  const normalizedRpm =
    (Math.min(rpm, MAX_RPM) - IDLING_ENGINE_RPM) /
    (MAX_RPM - IDLING_ENGINE_RPM);
  return normalizedRpm; // Aumenta gradualmente fino a 1
}

class ElectricEngineSoundGenerator extends AudioWorkletProcessor {
  constructor() {
    // inizializzo le fasi
    super();
    this.lfoPhase = 0;
    this.whinePhase = 0;
    this.phases = BASE_FREQUENCIES.map(() => 0);

    // Inizializzo il filtro passa basso con una frequenza di cutoff di 100 Hz
    this.lowPassFilter = new LowPassFilter(100, SAMPLING_RATE);
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

  process(_, outputs, parameters) {
    const output = outputs[0];
    const rpm = parameters.rpm;

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        const currentRpm = rpm.length > 1 ? rpm[i] : rpm[0];

        const frequencyOffset = mapRpmToFrequencyOffset(currentRpm);
        const volumeAttenuation = calculateVolumeAttenuation(currentRpm);
        const lfoFrequency = mapRpmToLfoFrequency(currentRpm);
        const lfoAmplitude = mapRpmToLfoAmplitude(currentRpm);

        // Calcolo della frequenza modulata (vibrato)
        const vibratoOffset = WAFE_FUNC(this.lfoPhase) * lfoAmplitude;

        // Somma delle onde a dente di sega con la frequenza modulata dal vibrato
        let sample =
          BASE_FREQUENCIES.reduce(
            (accumulator, _, index) =>
              accumulator + WAFE_FUNC(this.phases[index]),
            0
          ) / BASE_FREQUENCIES.length; // Media delle onde a dente di sega

        // Aggiunta del whine come offset della frequenza base
        const whineFreq = BASE_FREQUENCIES[0] + frequencyOffset + WHINE_OFFSET;
        sample += WHINE_AMPLITUDE * WAFE_FUNC(this.whinePhase);

        // Aggiunta del rumore bianco con ampiezza controllata dagli RPM
        const noiseAmplitude = mapRpmToNoiseAmplitude(currentRpm); // L'ampiezza del rumore bianco ora varia con gli RPM
        let whiteNoise = generateWhiteNoise() * noiseAmplitude;

        const filteredWhiteNoise = this.lowPassFilter.process(whiteNoise);

        // Aggiungo il rumore bianco filtrato al segnale
        sample += filteredWhiteNoise;

        // Attenuazione del volume solo per il suono del motore, escludendo il rumore bianco
        outputChannel[i] = sample * volumeAttenuation + filteredWhiteNoise;

        // Aggiornamento delle fasi delle onde a dente di sega
        BASE_FREQUENCIES.forEach((freq, index) => {
          const adjustedFreq = freq + frequencyOffset + vibratoOffset;
          this.phases[index] +=
            adjustedFreq / PITCH_LOWERING_FACTOR / SAMPLING_RATE;

          // Se la fase supera 1 (ciclo completo), la resetto
          if (this.phases[index] >= 1) {
            this.phases[index] -= 1;
          }
        });

        // Aggiornamento della fase del whine
        this.whinePhase += whineFreq / SAMPLING_RATE;
        if (this.whinePhase >= 1) {
          this.whinePhase -= 1;
        }

        // Aggiornamento della fase del LFO con frequenza variabile
        this.lfoPhase += lfoFrequency / SAMPLING_RATE;
        if (this.lfoPhase >= 1) {
          this.lfoPhase -= 1;
        }
      }
    }

    return true;
  }
}

class LowPassFilter {
  constructor(cutoffFrequency, sampleRate) {
    this.cutoffFrequency = cutoffFrequency;
    this.sampleRate = sampleRate;
    this.alpha = 0;
    this.lastOutput = 0;
    this.updateAlpha();
  }

  updateAlpha() {
    const dt = 1 / this.sampleRate;
    const rc = 1 / (2 * Math.PI * this.cutoffFrequency);
    this.alpha = dt / (rc + dt);
  }

  process(input) {
    this.lastOutput = this.alpha * input + (1 - this.alpha) * this.lastOutput;
    return this.lastOutput;
  }
}

registerProcessor(
  "electric-engine-audio-processor",
  ElectricEngineSoundGenerator
);
