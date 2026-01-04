const taskInput = document.getElementById('taskInput');
const runBtn = document.getElementById('runBtn');
const currentStatus = document.getElementById('currentStatus');
const taskIdDisplay = document.getElementById('taskId');
const consoleOutput = document.getElementById('consoleOutput');
const liveViewFrame = document.getElementById('liveViewFrame');
const iframeContainer = document.getElementById('iframeContainer');
const externalLink = document.getElementById('externalLink');
const placeholder = document.querySelector('.placeholder');
const chatHistory = document.getElementById('chatHistory');
const startTavusBtn = document.getElementById('startTavusBtn');
// tavusFrame removed as we use DailyIframe now
const startTavusOverlay = document.getElementById('startTavusOverlay');

let pollingInterval;

function log(message, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.appendChild(entry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function addToChat(message, sender = 'system') {
    const entry = document.createElement('div');
    entry.className = `message ${sender}`;
    entry.style.marginTop = "5px";

    if (sender === 'user') {
        entry.style.textAlign = "right";
        entry.style.color = "#007bff";
    } else {
        entry.style.textAlign = "left";
        entry.style.color = "#333";
    }

    entry.textContent = message;
    chatHistory.appendChild(entry);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

let dailyCallFrame = null;

async function startTavusSession() {
    startTavusBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
    startTavusBtn.disabled = true;
    log("Initializing Tavus session...", "info");

    try {
        const response = await fetch('/api/tavus/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to start Tavus session");
        }

        const data = await response.json();

        log(`Tavus session created. URL: ${data.conversation_url}`, 'success');

        if (data.conversation_url) {
            // Validate Daily SDK
            if (!window.DailyIframe) {
                throw new Error("Daily.co SDK not loaded. Check internet connection or ad blockers.");
            }

            // Initialize Daily Call Frame
            const videoContainer = document.getElementById('tavusVideoContainer');

            // Clean up old frame if exists
            if (dailyCallFrame) {
                dailyCallFrame.destroy();
            }

            log("Creating Daily Iframe...", "info");

            // Create new frame with high z-index
            dailyCallFrame = window.DailyIframe.createFrame(videoContainer, {
                iframeStyle: {
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    zIndex: '20' // Ensure it's above the overlay (z-index 10)
                },
                showLeaveButton: true,
                showFullscreenButton: true
            });

            // Event Listeners
            dailyCallFrame.on('joined-meeting', (event) => {
                log("Joined meeting! Waiting for Tavus agent...", "success");
                startTavusOverlay.style.display = 'none';
            });

            dailyCallFrame.on('participant-joined', (event) => {
                log(`Participant joined: ${event.participant.user_name || 'Tavus Avatar'}`, 'info');
            });

            dailyCallFrame.on('track-started', (event) => {
                log(`Video track started: ${event.participant.user_name || 'System'} (${event.track.kind})`, 'success');
            });

            dailyCallFrame.on('error', (e) => {
                log(`Daily Error: ${e?.errorMsg}`, 'error');
                console.error("Daily Error:", e);
                startTavusBtn.innerHTML = 'Start Conversation';
                startTavusBtn.disabled = false;
            });

            // Force hide overlay after 10 seconds if not joined (timeout fallback)
            setTimeout(() => {
                if (startTavusOverlay.style.display !== 'none') {
                    log("Join timeout: Forcing overlay hide to check video.", "warning");
                    startTavusOverlay.style.display = 'none';
                }
            }, 10000);

            // Join the meeting
            log("Joining Daily room...", "info");
            await dailyCallFrame.join({ url: data.conversation_url });

            addToChat("Video connecting... Please allow Camera/Microphone access.", "system");

        } else {
            throw new Error("No conversation_url returned from API");
        }
    } catch (e) {
        console.error(e);
        log(`Tavus Error: ${e.message}`, 'error');
        alert("Tavus Error: " + e.message);
        startTavusBtn.innerHTML = 'Start Conversation';
        startTavusBtn.disabled = false;
    }
}


if (startTavusBtn) {
    startTavusBtn.addEventListener('click', startTavusSession);
}

function updateLiveView(url) {
    if (url) {
        liveViewFrame.src = url;
        liveViewFrame.classList.add('active');
        placeholder.style.display = 'none';
        externalLink.href = url;
    }
}

async function handleInput() {
    const query = taskInput.value.trim();
    if (!query) return;

    addToChat(query, 'user');
    taskInput.value = '';

    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';

    try {
        // Check Intent
        const intentResponse = await fetch('/api/process_intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        const intent = await intentResponse.json();

        if (intent.type === 'conversation') {
            addToChat(intent.message, 'agent');
            // Here we could also send text to Tavus to speak if we had a text-to-speech endpoint
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
        } else if (intent.type === 'action') {
            addToChat(intent.message, 'agent');
            log("Agent started action: " + intent.task, 'info');
            await startTask(intent.task);
        }

    } catch (error) {
        log(`Error: ${error.message}`, 'error');
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
    }
}

async function startTask(taskDescription) {
    // Reset UI for task
    currentStatus.textContent = "Starting...";

    try {
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: taskDescription })
        });

        if (!response.ok) throw new Error('Failed to start task');

        const data = await response.json();
        const taskId = data.taskId;
        const liveUrl = data.liveUrl;

        taskIdDisplay.textContent = taskId;
        log(`Task created. ID: ${taskId}`, 'success');

        if (liveUrl) {
            log(`Live view available`, 'info');
            updateLiveView(liveUrl);
        }

        pollStatus(taskId, data.sessionId);

    } catch (error) {
        log(`Error: ${error.message}`, 'error');
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
        currentStatus.textContent = "Error";
    }
}

async function pollStatus(taskId, sessionId) {
    pollingInterval = setInterval(async () => {
        try {
            // Poll for task status
            const taskResponse = await fetch(`/api/task/${taskId}`);
            const data = await taskResponse.json();

            const status = data.status;
            currentStatus.textContent = status.toUpperCase();

            // If live view is missing, poll for session info
            if (!liveViewFrame.src && sessionId) {
                const sessionResponse = await fetch(`/api/session/${sessionId}`);
                const sessionData = await sessionResponse.json();
                if (sessionData.liveUrl) {
                    log(`Live view available: ${sessionData.liveUrl}`, 'info');
                    updateLiveView(sessionData.liveUrl);
                }
            }

            if (status === 'finished' || status === 'stopped') {
                clearInterval(pollingInterval);
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';

                if (data.output) {
                    log('Task Completed!', 'success');
                    log(`Output: ${JSON.stringify(data.output, null, 2)}`, 'success');
                    addToChat("I've finished the task.", 'agent');
                } else {
                    log('Task Stopped.', 'system');
                }
            } else if (status === 'paused') {
                log('Task Paused.', 'system');
            }

        } catch (error) {
            console.error("Polling error:", error);
        }
    }, 2000);
}

runBtn.addEventListener('click', handleInput);

// Allow Ctrl+Enter or just Enter to submit
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleInput();
    }
});
