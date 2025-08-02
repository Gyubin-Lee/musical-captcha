const express = require('express');
const session = require('express-session');
const wav = require('node-wav');
const path = require('path');

const app = express();
// Use the port provided by the environment (e.g., Render) or 3000 for local development
const port = process.env.PORT || 3000;

// Define available notes (C Major Scale, 4th octave)
const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const CHALLENGE_LENGTH = 5; // Number of notes in the challenge

// Define the frequencies (Hz) for each note.
const noteFrequencies = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
};

// Audio generation settings
const SAMPLE_RATE = 44100; // 44.1kHz. Do not change without recalibrating other values.
const NOTE_DURATION_BASE = 0.4;
const SILENCE_DURATION_BASE = 0.2;
const NOISE_AMPLITUDE = 0.08;   // How loud the background noise is.
const PADDING_DURATION_SEC = 0.5; // Duration of noise-only padding at start/end



// Middleware setup
app.use(express.json()); // To parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files only from the 'public' directory

// Session setup
// In production, 'trust proxy' is needed as services like Render use a reverse proxy.
app.set('trust proxy', 1);
app.use(session({
    // Use an environment variable for the secret in production for security
    secret: process.env.SESSION_SECRET || 'a-default-secret-for-development',
    resave: false,
    saveUninitialized: true,
    // In production (HTTPS), cookies must be secure.
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

/**
 * Generates raw audio data (PCM) for a sequence of notes.
 * @param {string[]} notes - Array of notes to generate audio for.
 * @returns {Float32Array} - The raw audio data.
 */
function generateAudioData(notes) {
    const noteSamples = Math.floor(NOTE_DURATION_BASE * SAMPLE_RATE);
    const silenceSamples = Math.floor(SILENCE_DURATION_BASE * SAMPLE_RATE);
    const melodySamples = (noteSamples + silenceSamples) * notes.length;
    const paddingSamples = Math.floor(PADDING_DURATION_SEC * SAMPLE_RATE);

    const totalSamples = paddingSamples + melodySamples + paddingSamples;
    const audioData = new Float32Array(totalSamples);

    // Melody generation starts after the initial padding
    let currentPosition = paddingSamples;

    notes.forEach(note => {
        const frequency = noteFrequencies[note];
        // Envelope settings to match client-side playSound() for a "smooth" sound
        const attackTimeSec = 0.02;
        const attackSamples = Math.floor(attackTimeSec * SAMPLE_RATE);
        const maxAmplitude = 0.5; // Lowered note volume

        if (frequency) {
            const period = 1.0 / frequency;
            for (let i = 0; i < noteSamples; i++) {
                const time = i / SAMPLE_RATE;
                // Sawtooth wave formula: 2 * (t/T - floor(0.5 + t/T))
                const rawSample = 2 * (time / period - Math.floor(0.5 + time / period));

                // Apply AD (Attack-Decay) envelope to make it smooth
                let amplitude;
                if (i < attackSamples) {
                    // Attack phase: linear ramp up from 0 to maxAmplitude
                    amplitude = maxAmplitude * (i / attackSamples);
                } else {
                    // Decay phase: linear ramp down from maxAmplitude to 0
                    amplitude = maxAmplitude * (1 - (i - attackSamples) / (noteSamples - attackSamples));
                }
                audioData[currentPosition + i] = rawSample * Math.max(0, amplitude);
            }
        }

        currentPosition += noteSamples + silenceSamples; // Move to the next note position
    });

    // Add continuous background white noise to the entire clip to confuse bots
    for (let i = 0; i < totalSamples; i++) {
        const noise = (Math.random() * 2 - 1) * NOISE_AMPLITUDE;
        audioData[i] += noise;
    }

    // The channelData is an array of Float32Array, one for each channel.
    // We have a mono sound, so we wrap our audioData in an array.
    return [audioData];
}

// API to create a new challenge (note sequence) and send it to the client
app.get('/api/challenge', (req, res) => {
    let challenge;

    // If a solution already exists in the session, use it.
    // Otherwise, generate a new one.
    if (req.session.solution) {
        challenge = req.session.solution;
        console.log(`Replaying existing challenge. Solution: ${challenge.join(', ')}`);
    } else {
        challenge = [];
        for (let i = 0; i < CHALLENGE_LENGTH; i++) {
            const randomIndex = Math.floor(Math.random() * NOTES.length);
            challenge.push(NOTES[randomIndex]);
        }

        // Store the new generated solution in the server session
        req.session.solution = challenge;

        console.log(`New Challenge Generated. Solution: ${challenge.join(', ')}`);
    }

    // 1. Generate raw audio data from the challenge notes
    const pcmData = generateAudioData(challenge);

    // 2. Encode the raw audio data into a WAV format buffer (in memory)
    const wavBuffer = wav.encode(pcmData, { sampleRate: SAMPLE_RATE, float: true, bitDepth: 32 });

    // 3. Send the buffer as an audio file
    res.set('Content-Type', 'audio/wav');
    res.send(wavBuffer);
});

// API to verify the user's answer
app.post('/api/verify', (req, res) => {
    const { userAnswer } = req.body;
    const solution = req.session.solution;

    console.log(`User Answer: ${userAnswer}, Correct Solution: ${solution}`);

    if (!solution || !userAnswer || userAnswer.length !== solution.length) {
        return res.json({ success: false, message: 'Invalid request.' });
    }

    const isCorrect = userAnswer.every((note, index) => note === solution[index]);

    // Delete the used solution from the session to prevent reuse
    req.session.solution = null;

    if (isCorrect) {
        res.json({ success: true, message: 'Verification successful!' });
    } else {
        res.json({ success: false, message: 'Incorrect. Please try again.' });
    }
});

app.listen(port, () => {
    console.log(`Musical reCAPTCHA server listening at http://localhost:${port}`);
});