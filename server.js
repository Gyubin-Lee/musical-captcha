const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
// Use the port provided by the environment (e.g., Render) or 3000 for local development
const port = process.env.PORT || 3000;

// Define available notes (C Major Scale, 4th octave)
const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const CHALLENGE_LENGTH = 5; // Number of notes in the challenge

// Middleware setup
app.use(express.json()); // To parse JSON request bodies
app.use(express.static(__dirname)); // Modified to find static files in the current directory

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

// API to create a new challenge (note sequence) and send it to the client
app.get('/api/challenge', (req, res) => {
    const challenge = [];
    for (let i = 0; i < CHALLENGE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * NOTES.length);
        challenge.push(NOTES[randomIndex]);
    }

    // Store the generated solution in the server session
    req.session.solution = challenge;

    console.log(`New Challenge Generated. Solution: ${challenge.join(', ')}`);

    // Send only the challenge (note array) to the client (as the client needs to play the sound)
    res.json({ challenge });
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