document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play-button');
    const submitButton = document.getElementById('submit-button');
    const playCButton = document.getElementById('play-c-button');
    const resetButton = document.getElementById('reset-button');
    const pianoKeys = document.querySelectorAll('.key');
    const userInputDisplay = document.getElementById('user-input-display');
    const statusMessage = document.getElementById('status-message');

    let audioContext; // Core object of Web Audio API
    let userInput = [];
    let isPlaying = false;

    // Define the frequencies (Hz) for each note.
    const noteFrequencies = {
        'C4': 261.63,
        'D4': 293.66,
        'E4': 329.63,
        'F4': 349.23,
        'G4': 392.00,
        'A4': 440.00,
        'B4': 493.88,
    };

    /**
     * Initializes AudioContext on the user's first interaction.
     * This is to comply with the browser's autoplay policy.
     */
    const initializeAudioContext = () => {
        if (!audioContext) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContext();
            } catch (e) {
                alert('Web Audio API is not supported in this browser.');
            }
        }
    };

    /**
     * Creates and plays a specific note using the Web Audio API
     * @param {string} note - The note to play (e.g., 'C4')
     */
    const playSound = (note) => {
        if (!audioContext) return;

        const frequency = noteFrequencies[note];
        if (!frequency) return;

        const now = audioContext.currentTime;
        const noteDuration = 0.4; // Duration of the note in seconds
        const sampleRate = audioContext.sampleRate;
        const numSamples = Math.floor(noteDuration * sampleRate);

        // Create an AudioBuffer to hold our custom waveform
        const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0); // Get data for mono channel

        // Generate the sawtooth wave samples, matching the server's logic
        const period = 1.0 / frequency;
        for (let i = 0; i < numSamples; i++) {
            const time = i / sampleRate;
            // Sawtooth wave formula: 2 * (t/T - floor(0.5 + t/T))
            channelData[i] = 2 * (time / period - Math.floor(0.5 + time / period));
        }

        // Create a source node to play our buffer
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = audioContext.createGain(); // Create a volume control node

        // Adjust the volume to prevent 'click' noises and create a smooth sound
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.7, now + 0.02); // Attack
        gainNode.gain.linearRampToValueAtTime(0, now + noteDuration); // Decay

        // Connect the nodes: source -> gain (volume) -> speakers (destination)
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Schedule the sound to start
        source.start(now);
    };

    // 'Play Challenge' button click event
    playButton.addEventListener('click', async () => {
        if (isPlaying) return;

        initializeAudioContext(); // Initialize AudioContext on first click
        statusMessage.textContent = '';
        userInput = [];
        updateUserInputDisplay();

        isPlaying = true;
        playButton.disabled = true;
        playButton.textContent = 'Playing...';

        try {
            const response = await fetch('/api/challenge');
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => {
                isPlaying = false;
                playButton.disabled = false;
                playButton.textContent = 'Play Challenge 🎵';
            };
        } catch (error) {
            statusMessage.textContent = 'An error occurred. Please try again.';
            console.error('Error fetching challenge:', error);
            isPlaying = false;
            playButton.disabled = false;
            playButton.textContent = 'Play Challenge 🎵';
        }
    });

    // 'Play C' button click event
    playCButton.addEventListener('click', () => {
        initializeAudioContext(); // Ensure audio is ready to play
        playSound('C4');
    });

    // Piano key click event
    pianoKeys.forEach(key => {
        key.addEventListener('click', () => {
            initializeAudioContext(); // Initialize AudioContext on first click
            if (isPlaying) return; // Prevent input while the challenge is playing

            const note = key.dataset.note;
            playSound(note);
            if (userInput.length < 5) {
                userInput.push(note);
                updateUserInputDisplay();
            }

            // Add visual effect for key press
            key.classList.add('active');
            setTimeout(() => {
                key.classList.remove('active');
            }, 200); // The visual effect lasts for 200ms
        });
    });

    // 'Reset' button click event
    resetButton.addEventListener('click', () => {
        // Clear user input and status message
        userInput = [];
        updateUserInputDisplay();
        statusMessage.textContent = '';
    });

    // 'Submit Answer' button click event
    submitButton.addEventListener('click', async () => {
        if (userInput.length !== 5) {
            statusMessage.textContent = 'Please enter all 5 notes.';
            return;
        }

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAnswer: userInput }),
            });
            const result = await response.json();
            statusMessage.textContent = result.message;
            statusMessage.style.color = result.success ? 'green' : 'red';

            // After any submission attempt, the server-side challenge is cleared.
            // So, we must clear the user's input to force them to get a new challenge
            // if they were wrong, or to start fresh if they were right.
            userInput = [];
            updateUserInputDisplay();
        } catch (error) {
            statusMessage.textContent = 'An error occurred during verification.';
            console.error('Error verifying answer:', error);
        }
    });

    const updateUserInputDisplay = () => {
        // Clear the display but keep the label text
        userInputDisplay.innerHTML = 'Your input: ';

        // Create and append a bubble for each note in the user's input
        userInput.forEach(note => {
            const noteBubble = document.createElement('span');
            noteBubble.className = 'note-bubble';
            // Display only the note letter (e.g., 'C' from 'C4')
            noteBubble.textContent = note.charAt(0);
            userInputDisplay.appendChild(noteBubble);
        });
    };
});