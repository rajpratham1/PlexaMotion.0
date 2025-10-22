document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Element Cache ---
    const elements = {
        gestureToggle: document.getElementById('gesture-toggle'),
        voiceToggle: document.getElementById('voice-toggle'),
        gestureHandBtn: document.getElementById('gesture-hand-btn'),
        gestureHeadBtn: document.getElementById('gesture-head-btn'),
        toggleCameraViewBtn: document.getElementById('toggle-camera-view-btn'),
        quickActionBtns: document.querySelectorAll('.quick-action-btn'),
        veroHelpBtn: document.getElementById('vero-help-btn'),
        gestureHelpBtn: document.getElementById('gesture-help-btn'), // New button
        veroModal: document.getElementById('vero-modal'),
        gestureModal: document.getElementById('gesture-modal'), // New modal
        veroModalClose: document.getElementById('vero-modal-close'),
        gestureModalClose: document.getElementById('gesture-modal-close'), // New close button
        clearLogsBtn: document.getElementById('clear-logs-btn'),
        // Status Displays
        webcamStatus: document.getElementById('webcam-status'),
        micStatus: document.getElementById('mic-status'),
        modeStatus: document.getElementById('mode-status'),
        lastCommandStatus: document.getElementById('last-command-status'),
        // Dynamic Content
        consoleOutput: document.getElementById('console-output'),
        micAnimation: document.getElementById('mic-animation'),
        speechFeedback: document.getElementById('speech-feedback'),
        gestureFeedContainer: document.getElementById('gesture-feed-container'),
        gestureFeed: document.getElementById('gestureFeed'),
        toastMessage: document.getElementById('toast-message'),
    };

    // --- State Management ---
    let state = {
        cameraStream: null,
        frameEmitter: null,
        isCameraVisible: true,
        isGestureActive: false,
        isVoiceActive: false,
        lastLog: "",
        recognition: null,
        isListening: false,
        silenceTimer: null,
        faceLandmarker: null,
    };

    // --- Logging & Notifications ---
    const showToast = (message) => {
        elements.toastMessage.textContent = message;
        elements.toastMessage.classList.add('show');
        setTimeout(() => { elements.toastMessage.classList.remove('show'); }, 3000);
    };

    const addLog = (message, source = 'System') => {
        const logKey = `${source}:${message}`;
        if (state.lastLog === logKey) return;
        state.lastLog = logKey;

        const logEntry = document.createElement('p');
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logEntry.innerHTML = `[${timestamp}] <span class="source source-${source}">[${source}]</span> ${message}`;
        
        elements.consoleOutput.appendChild(logEntry);
        if (elements.consoleOutput.children.length > 10) {
            elements.consoleOutput.removeChild(elements.consoleOutput.firstChild);
        }
        elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
    };

    // --- Speech Synthesis (TTS) ---
    const speak = (text) => {
        if (!('speechSynthesis' in window)) {
            return showToast("Speech synthesis not supported.");
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    };

    // --- Camera & Gesture Control ---
    const startCamera = async () => {
        if (state.cameraStream) return;
        try {
            state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            elements.gestureFeed.srcObject = state.cameraStream;
            elements.gestureFeedContainer.style.display = state.isCameraVisible ? 'block' : 'none';
            addLog('Camera stream active', 'Gesture');

            await createFaceLandmarker();

            state.frameEmitter = setInterval(() => {
                if (!state.cameraStream) return;
                const video = elements.gestureFeed;
                if (video.readyState < 2) return;

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                socket.emit('process_frame', { frame: canvas.toDataURL('image/jpeg') });

                if (state.faceLandmarker) {
                    const results = state.faceLandmarker.detect(video);
                    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                        const nose = results.faceLandmarks[0][4]; // Nose tip
                        const event = new CustomEvent('faceLandmark', { detail: { y: nose.y } });
                        document.dispatchEvent(event);
                    }
                }
            }, 100);

        } catch (err) {
            showToast('⚠️ Please allow camera access for gesture control to work.');
            elements.gestureToggle.checked = false;
            state.isGestureActive = false;
            socket.emit('toggle_gesture', { active: false });
        }
    };

    const stopCamera = () => {
        if (!state.cameraStream) return;
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
        clearInterval(state.frameEmitter);
        state.frameEmitter = null;
        elements.gestureFeedContainer.style.display = 'none';
        addLog('Camera stream stopped', 'Gesture');
    };

    async function createFaceLandmarker() {
        const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js');
        const { FaceLandmarker, FilesetResolver } = vision;
        const filesetResolver = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        state.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: 'GPU'
            },
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 1
        });
        addLog('Face Landmarker created', 'Gesture');
    }

    elements.gestureToggle.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        if (isActive === state.isGestureActive) return;
        state.isGestureActive = isActive;

        addLog(`Gesture control ${isActive ? 'enabled' : 'disabled'}` , 'Gesture');
        socket.emit('toggle_gesture', { active: isActive });
        if (isActive) startCamera();
        else stopCamera();
    });

    elements.toggleCameraViewBtn.addEventListener('click', () => {
        state.isCameraVisible = !state.isCameraVisible;
        if (state.cameraStream) {
            elements.gestureFeedContainer.style.display = state.isCameraVisible ? 'block' : 'none';
        }
    });

    [elements.gestureHandBtn, elements.gestureHeadBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.id.includes('hand') ? 'hand' : 'head';
            elements.gestureHandBtn.classList.toggle('active', mode === 'hand');
            elements.gestureHeadBtn.classList.toggle('active', mode === 'head');
            fetch('/gesture/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
        });
    });

    // --- Vero Voice Assistant ---
    const startVero = () => {
        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            return showToast('Speech recognition not supported in this browser.');
        }
        if (state.recognition) {
            state.recognition.start();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.lang = 'en-IN';
        state.recognition.continuous = true;
        state.recognition.interimResults = true;

        state.recognition.onstart = () => {
            state.isListening = true;
            elements.micAnimation.classList.add('listening');
            elements.speechFeedback.textContent = "Listening...";
            resetSilenceTimer();
        };

        state.recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript) handleVoiceCommand(finalTranscript.trim());
            resetSilenceTimer();
        };

        state.recognition.onerror = (event) => addLog(`Speech recognition error: ${event.error}`, 'Vero');

        state.recognition.onend = () => {
            state.isListening = false;
            elements.micAnimation.classList.remove('listening');
            if (state.isVoiceActive) elements.speechFeedback.textContent = "Vero paused. Say 'Hey Vero' to resume.";
        };

        state.recognition.start();
    };

    const stopVero = () => {
        if (state.recognition) state.recognition.stop();
        clearTimeout(state.silenceTimer);
        elements.speechFeedback.textContent = "Vero is offline.";
    };

    const resetSilenceTimer = () => {
        clearTimeout(state.silenceTimer);
        state.silenceTimer = setTimeout(() => { if (state.isListening) state.recognition.stop(); }, 10000);
    };

    const handleVoiceCommand = (command) => {
        const lowerCmd = command.toLowerCase();
        elements.speechFeedback.innerHTML = `🎤 Command: <strong>${command}</strong>`;
        addLog(`Recognized: "${command}"`, 'Vero');
        elements.lastCommandStatus.textContent = command;

        if (lowerCmd.includes('hey vero')) {
            speak("I'm listening.");
            if (!state.isListening) state.recognition.start();
            return;
        }

        const commandMap = {
            'browser': ['open browser', 'open chrome', 'launch browser'],
            'music': ['play music', 'start music'],
            'vol_up': ['volume up', 'increase volume'],
            'vol_down': ['volume down', 'decrease volume'],
            'close': ['close window', 'close app'],
            'sleep': ['go to sleep', 'sleep pc']
        };

        for (const action in commandMap) {
            if (commandMap[action].some(phrase => lowerCmd.includes(phrase))) {
                const button = document.querySelector(`.quick-action-btn[data-action="${action}"]`);
                if (button) {
                    button.click();
                    return;
                }
            }
        }

        speak("Sorry, I didn't recognize that command.");
    };

    elements.voiceToggle.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        state.isVoiceActive = isActive;
        socket.emit('toggle_voice', { active: isActive });
        if (isActive) {
            speak("Vero activated.");
            startVero();
        } else {
            speak("Vero deactivated.");
            stopVero();
        }
    });

    // --- UI & Event Handlers ---
    elements.clearLogsBtn.addEventListener('click', () => { elements.consoleOutput.innerHTML = ''; state.lastLog = null; });
    
    // Modal Handlers
    elements.veroHelpBtn.addEventListener('click', () => { elements.veroModal.style.display = 'flex'; });
    elements.veroModalClose.addEventListener('click', () => { elements.veroModal.style.display = 'none'; });
    elements.gestureHelpBtn.addEventListener('click', () => { elements.gestureModal.style.display = 'flex'; });
    elements.gestureModalClose.addEventListener('click', () => { elements.gestureModal.style.display = 'none'; });

    const actionResponses = {
        'browser': 'Opening your browser.',
        'music': 'Starting music.',
        'vol_up': 'Volume up.',
        'vol_down': 'Volume down.',
        'close': 'Closing the active window.',
        'sleep': 'Putting the computer to sleep.'
    };

    elements.quickActionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            addLog(`${action.replace('_',' ').charAt(0).toUpperCase() + action.slice(1)} triggered`, 'Action');
            fetch(`/action/${action}`, { method: 'POST' });
            elements.lastCommandStatus.textContent = action.replace('_',' ');
            if (actionResponses[action]) {
                speak(actionResponses[action]);
            }
        });
    });

    // --- SocketIO Listeners ---
    socket.on('connect', () => addLog('Server connected', 'System'));
    socket.on('disconnect', () => addLog('Server disconnected', 'System'));
    socket.on('console_log', (data) => addLog(data.log, data.source));

    socket.on('full_status', (status) => {
        elements.gestureToggle.checked = status.gestureActive;
        elements.voiceToggle.checked = status.voiceActive;
        state.isGestureActive = status.gestureActive;
        state.isVoiceActive = status.voiceActive;

        elements.webcamStatus.textContent = status.gestureActive ? 'ON' : 'OFF';
        elements.webcamStatus.classList.toggle('green', status.gestureActive);
        elements.webcamStatus.classList.toggle('red', !status.gestureActive);

        elements.micStatus.textContent = status.voiceActive ? 'ON' : 'OFF';
        elements.micStatus.classList.toggle('green', status.voiceActive);
        elements.micStatus.classList.toggle('red', !status.voiceActive);

        elements.modeStatus.textContent = status.activeMode.toUpperCase();
        elements.lastCommandStatus.textContent = status.lastCommand;

        elements.gestureHandBtn.classList.toggle('active', status.gestureMode === 'hand');
        elements.gestureHeadBtn.classList.toggle('active', status.gestureMode === 'head');
        
        if(status.gestureActive && !state.cameraStream) startCamera();
        else if (!status.gestureActive && state.cameraStream) stopCamera();
    });

    addLog('PlexaMotion UI Initialized', 'System');
});