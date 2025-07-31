document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('play-button');
    const submitButton = document.getElementById('submit-button');
    const pianoKeys = document.querySelectorAll('.key');
    const userInputDisplay = document.getElementById('user-input-display');
    const statusMessage = document.getElementById('status-message');

    let audioContext; // Core object of Web Audio API
    let currentChallenge = [];
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

    // Function to play notes sequentially
    const playNotesSequentially = (notes) => {
        isPlaying = true;
        playButton.disabled = true;
        let delay = 0;
        notes.forEach(note => {
            setTimeout(() => {
                playSound(note);
            }, delay);
            delay += 600; // Interval between notes (ms)
        });

        // Re-enable the button after playback is finished
        setTimeout(() => {
            isPlaying = false;
            playButton.disabled = false;
        }, delay);
    };

    /**
     * Creates and plays a specific note using the Web Audio API
     * @param {string} note - The note to play (e.g., 'C4')
     */
    const playSound = (note) => {
        if (!audioContext) return;

        const frequency = noteFrequencies[note];
        if (!frequency) return;

        const oscillator = audioContext.createOscillator(); // Create a sound source (oscillator)
        const gainNode = audioContext.createGain(); // Create a volume control node

        // Set the oscillator type (e.g., 'sine', 'square', 'sawtooth', 'triangle')
        oscillator.type = 'sawtooth';
        // Set the oscillator's frequency
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        // Adjust the volume to prevent 'click' noises and create a smooth sound
        const now = audioContext.currentTime;
        const noteDuration = 0.4; // Duration of the note in seconds
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.7, now + 0.02); // Attack
        gainNode.gain.linearRampToValueAtTime(0, now + noteDuration); // Decay

        // Connect the nodes: oscillator -> gain (volume) -> speakers (destination)
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Schedule the sound to start and stop
        oscillator.start(now);
        oscillator.stop(now + noteDuration);
    };

    // 'Play Challenge' button click event
    playButton.addEventListener('click', async () => {
        initializeAudioContext(); // Initialize AudioContext on first click
        statusMessage.textContent = '';
        userInput = [];
        updateUserInputDisplay();

        try {
            const response = await fetch('/api/challenge');
            const data = await response.json();
            currentChallenge = data.challenge;
            playNotesSequentially(currentChallenge);
        } catch (error) {
            statusMessage.textContent = 'An error occurred. Please try again.';
            console.error('Error fetching challenge:', error);
        }
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
        });
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
        } catch (error) {
            statusMessage.textContent = 'An error occurred during verification.';
            console.error('Error verifying answer:', error);
        }
    });

    const updateUserInputDisplay = () => {
        userInputDisplay.textContent = `Your input: ${userInput.join(', ')}`;
    };
});