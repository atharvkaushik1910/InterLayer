const taskInput = document.getElementById("taskInput");
const runBtn = document.getElementById("runBtn");
const currentStatus = document.getElementById("currentStatus");
const taskIdDisplay = document.getElementById("taskId");
const consoleOutput = document.getElementById("consoleOutput");
const liveViewFrame = document.getElementById("liveViewFrame");
const iframeContainer = document.getElementById("iframeContainer");
const externalLink = document.getElementById("externalLink");
const placeholder = document.querySelector(".placeholder");
const chatHistory = document.getElementById("chatHistory");
const startTavusBtn = document.getElementById("startTavusBtn");
const startTavusOverlay = document.getElementById("startTavusOverlay");

let pollingInterval;
let dailyCallObject = null;
let connectionTimeout = null;
let autoLeaveTimeout = null;
let sttSocket = null;
let mediaRecorder = null;
let transcriptionStarted = false;

function log(message, type = "system") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function addToChat(message, sender = "system") {
  const entry = document.createElement("div");
  entry.className = `message ${sender}`;
  entry.style.marginTop = "5px";

  if (sender === "user") {
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

function resetTavusUI() {
  if (startTavusOverlay) {
    startTavusOverlay.style.display = "flex";
  }
  if (startTavusBtn) {
    startTavusBtn.innerHTML = "Start Conversation";
    startTavusBtn.disabled = false;
  }
}

function cleanupDailyCall() {
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }

  if (autoLeaveTimeout) {
    clearTimeout(autoLeaveTimeout);
    autoLeaveTimeout = null;
  }

  stopTranscription();
  transcriptionStarted = false;

  if (dailyCallObject) {
    try {
      dailyCallObject.destroy();
    } catch (e) {
      console.warn("Error destroying Daily call object:", e);
    }
    dailyCallObject = null;
  }

  const videoContainer = document.getElementById("tavusVideoContainer");
  if (videoContainer) {
    videoContainer.innerHTML = "";
  }
}

function createVideoElement(participantId, isLocal = false) {
  const videoContainer = document.getElementById("tavusVideoContainer");

  const wrapper = document.createElement("div");
  wrapper.id = `video-wrapper-${participantId}`;
  wrapper.style.cssText = `
    position: ${isLocal ? "absolute" : "relative"};
    width: ${isLocal ? "200px" : "100%"};
    height: ${isLocal ? "150px" : "100%"};
    ${isLocal ? "bottom: 20px; right: 20px; z-index: 10; border: 2px solid #00d4aa; border-radius: 8px; overflow: hidden;" : ""}
  `;

  const videoEl = document.createElement("video");
  videoEl.id = `video-${participantId}`;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.muted = isLocal;
  videoEl.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
  `;

  const label = document.createElement("div");
  label.textContent = isLocal ? "You" : "Tavus Agent";
  label.style.cssText = `
    position: absolute;
    bottom: 10px;
    left: 10px;
    color: white;
    background: rgba(0, 0, 0, 0.6);
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 11;
  `;

  wrapper.appendChild(videoEl);
  wrapper.appendChild(label);
  videoContainer.appendChild(wrapper);

  return videoEl;
}

function updateVideoTrack(participantId, track, isLocal = false) {
  let videoEl = document.getElementById(`video-${participantId}`);

  if (!videoEl && track) {
    videoEl = createVideoElement(participantId, isLocal);
  }

  if (videoEl && track) {
    videoEl.srcObject = new MediaStream([track.persistentTrack || track.track]);
    videoEl.play().catch((e) => {
      console.warn(`Error playing video for ${participantId}:`, e);
    });
  }
}

function updateAudioTrack(participantId, track) {
  let audioEl = document.getElementById(`audio-${participantId}`);

  if (!audioEl && track) {
    audioEl = document.createElement("audio");
    audioEl.id = `audio-${participantId}`;
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
  }

  if (audioEl && track) {
    audioEl.srcObject = new MediaStream([track.persistentTrack || track.track]);
    audioEl.play().catch((e) => {
      console.warn(`Error playing audio for ${participantId}:`, e);
    });
  }
}

async function startTranscription() {
  try {
    log("Starting AssemblyAI transcription...", "info");

    // Wait for Daily to fully initialize audio tracks
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get the local audio track from Daily
    const participants = dailyCallObject.participants();
    const localParticipant = participants.local;

    if (!localParticipant || !localParticipant.tracks.audio) {
      throw new Error("No local audio track available from Daily");
    }

    // Get the MediaStreamTrack from Daily
    const audioTrack =
      localParticipant.tracks.audio.persistentTrack ||
      localParticipant.tracks.audio.track;

    if (!audioTrack) {
      throw new Error("Could not access audio track from Daily");
    }

    console.log("Using Daily audio track for transcription:", audioTrack);

    // Create a MediaStream from the Daily audio track
    const stream = new MediaStream([audioTrack]);

    const token = "83515da6633f41f29ede079d601fe283";
    const socket = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`,
    );

    sttSocket = socket;

    socket.onopen = () => {
      log("AssemblyAI WebSocket connected", "success");
      addToChat("Voice transcription started", "system");
      console.log("AssemblyAI: Connected to transcription service");

      // Start recording AFTER socket is open
      try {
        const recorder = new RecordRTC(stream, {
          type: "audio",
          mimeType: "audio/webm;codecs=pcm",
          recorderType: RecordRTC.StereoAudioRecorder,
          timeSlice: 250,
          desiredSampRate: 16000,
          numberOfAudioChannels: 1,
          bufferSize: 4096,
          audioBitsPerSecond: 128000,
          ondataavailable: (blob) => {
            if (socket.readyState === WebSocket.OPEN) {
              const reader = new FileReader();
              reader.onload = () => {
                const base64data = reader.result.split(",")[1];
                socket.send(JSON.stringify({ audio_data: base64data }));
              };
              reader.readAsDataURL(blob);
            }
          },
        });

        recorder.startRecording();
        mediaRecorder = recorder;

        log("Audio recording started", "success");
        console.log("AssemblyAI: Now transcribing audio from Daily...");
      } catch (recError) {
        console.error("Error starting recorder:", recError);
        log(`Recording error: ${recError.message}`, "error");
      }
    };

    socket.onmessage = (message) => {
      const res = JSON.parse(message.data);
      console.log("AssemblyAI message:", res.message_type);

      if (res.message_type === "SessionBegins") {
        log("Transcription session active", "success");
        console.log("Session info:", res);
      } else if (res.message_type === "FinalTranscript") {
        if (res.text && res.text.trim().length > 0) {
          console.log(`[FINAL TRANSCRIPT]: ${res.text}`);
          log(`You said: ${res.text}`, "success");
          addToChat(res.text, "user");
        }
      } else if (res.message_type === "PartialTranscript") {
        if (res.text && res.text.trim().length > 0) {
          console.log(`[INTERIM]: ${res.text}`);
        }
      }
    };

    socket.onerror = (error) => {
      console.error("AssemblyAI WebSocket error:", error);
      log("Transcription error", "error");
    };

    socket.onclose = (event) => {
      console.log(
        "AssemblyAI: WebSocket closed",
        event.code,
        event.reason || "No reason provided",
      );
      log("Transcription stopped", "info");
    };
  } catch (error) {
    console.error("Failed to start transcription:", error);
    log(`Transcription error: ${error.message}`, "error");
    addToChat(
      "Could not start voice transcription. Please check microphone permissions.",
      "system",
    );
  }
}

function stopTranscription() {
  if (mediaRecorder) {
    try {
      if (mediaRecorder.stopRecording) {
        mediaRecorder.stopRecording();
        log("Audio recording stopped", "info");
      }
    } catch (e) {
      console.warn("Error stopping recorder:", e);
    }
    mediaRecorder = null;
  }

  if (sttSocket) {
    try {
      if (sttSocket.readyState === WebSocket.OPEN) {
        sttSocket.close();
        log("Transcription connection closed", "info");
      }
    } catch (e) {
      console.warn("Error closing AssemblyAI socket:", e);
    }
    sttSocket = null;
  }

  transcriptionStarted = false;
}

async function startTavusSession() {
  startTavusBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
  startTavusBtn.disabled = true;
  log("Initializing Tavus session...", "info");

  try {
    const response = await fetch("/api/tavus/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Failed to start Tavus session");
    }

    const data = await response.json();
    log(`Tavus session created. URL: ${data.conversation_url}`, "success");

    if (!data.conversation_url) {
      throw new Error("No conversation_url returned from API");
    }

    if (!window.Daily) {
      throw new Error(
        "Daily.co SDK not loaded. Check internet connection or ad blockers.",
      );
    }

    const videoContainer = document.getElementById("tavusVideoContainer");
    if (!videoContainer) {
      throw new Error("Video container element not found");
    }

    cleanupDailyCall();

    log("Creating Daily call object...", "info");

    dailyCallObject = window.Daily.createCallObject();

    connectionTimeout = setTimeout(() => {
      log("Connection timeout - taking too long to connect", "error");
      addToChat("Connection timed out. Please try again.", "system");
      cleanupDailyCall();
      resetTavusUI();
    }, 30000);

    dailyCallObject.on("loading", (event) => {
      log("Loading Daily resources...", "info");
    });

    dailyCallObject.on("loaded", (event) => {
      log("Daily resources loaded", "success");
    });

    dailyCallObject.on("started-camera", async (event) => {
      log("Camera started", "success");
    });

    dailyCallObject.on("camera-error", (event) => {
      log(
        `Camera Error: ${event?.errorMsg || "Camera access denied"}`,
        "error",
      );
      console.error("Camera Error:", event);
      addToChat("Camera error. Please check permissions.", "system");
    });

    dailyCallObject.on("joining-meeting", (event) => {
      log("Joining meeting...", "info");
    });

    dailyCallObject.on("joined-meeting", async (event) => {
      log("Successfully joined meeting!", "success");
      addToChat("Connected! Waiting for Tavus agent...", "system");

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      if (startTavusOverlay) {
        startTavusOverlay.style.display = "none";
      }

      const localParticipant = event.participants.local;
      if (localParticipant) {
        const tracks = localParticipant.tracks;
        if (tracks.video) {
          updateVideoTrack(localParticipant.session_id, tracks.video, true);
        }
      }

      // Start transcription after successfully joining
      if (!transcriptionStarted) {
        transcriptionStarted = true;
        await startTranscription();
      }
    });

    dailyCallObject.on("participant-joined", (event) => {
      const participant = event.participant;
      const participantName =
        participant.user_name || participant.user_id || "Unknown";
      log(`Participant joined: ${participantName}`, "info");

      if (!participant.local) {
        addToChat("Tavus agent has joined the call!", "system");
        log("Tavus AI agent is now in the call", "success");
      }
    });

    dailyCallObject.on("participant-updated", (event) => {
      const participant = event.participant;
      const participantId = participant.session_id;
      const tracks = participant.tracks;

      if (tracks.video && tracks.video.state === "playable") {
        updateVideoTrack(participantId, tracks.video, participant.local);
      }

      if (
        !participant.local &&
        tracks.audio &&
        tracks.audio.state === "playable"
      ) {
        updateAudioTrack(participantId, tracks.audio);
      }
    });

    dailyCallObject.on("participant-left", (event) => {
      const participantId = event.participant.session_id;
      const participantName =
        event.participant.user_name || event.participant.user_id || "Unknown";
      log(`Participant left: ${participantName}`, "info");

      const videoWrapper = document.getElementById(
        `video-wrapper-${participantId}`,
      );
      if (videoWrapper) videoWrapper.remove();

      const audioEl = document.getElementById(`audio-${participantId}`);
      if (audioEl) audioEl.remove();
    });

    dailyCallObject.on("track-started", async (event) => {
      const trackType = event.track?.kind || "unknown";
      const participantId = event.participant?.session_id;
      log(`Track started: ${trackType} for ${participantId}`, "success");
    });

    dailyCallObject.on("track-stopped", (event) => {
      const trackType = event.track?.kind || "unknown";
      log(`Track stopped: ${trackType}`, "info");
    });

    dailyCallObject.on("left-meeting", (event) => {
      log("Left meeting", "info");
      addToChat("Call ended.", "system");
      cleanupDailyCall();
      resetTavusUI();
    });

    dailyCallObject.on("error", (event) => {
      const errorMsg =
        event?.errorMsg || event?.error?.msg || event?.error || "Unknown error";
      log(`Daily Error: ${errorMsg}`, "error");
      console.error("Daily Error:", event);
      addToChat(`Error: ${errorMsg}`, "system");
      cleanupDailyCall();
      resetTavusUI();
    });

    log("Joining Daily room...", "info");
    addToChat(
      "Connecting to video... Please allow Camera/Microphone access if prompted.",
      "system",
    );

    try {
      await dailyCallObject.join({
        url: data.conversation_url,
      });

      log("Join request completed", "success");
    } catch (joinError) {
      throw new Error(`Failed to join: ${joinError.message}`);
    }
  } catch (e) {
    console.error("Tavus session error:", e);
    log(`Tavus Error: ${e.message}`, "error");
    addToChat(`Error: ${e.message}`, "system");
    alert("Tavus Error: " + e.message);
    cleanupDailyCall();
    resetTavusUI();
  }
}

if (startTavusBtn) {
  startTavusBtn.addEventListener("click", startTavusSession);
}

function updateLiveView(url) {
  if (url) {
    liveViewFrame.src = url;
    liveViewFrame.classList.add("active");
    placeholder.style.display = "none";
    externalLink.href = url;
  }
}

async function handleInput() {
  const query = taskInput.value.trim();
  if (!query) return;

  addToChat(query, "user");
  taskInput.value = "";

  runBtn.disabled = true;
  runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';

  try {
    const intentResponse = await fetch("/api/process_intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query }),
    });

    const intent = await intentResponse.json();

    if (intent.type === "conversation") {
      addToChat(intent.message, "agent");
      runBtn.disabled = false;
      runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
    } else if (intent.type === "action") {
      addToChat(intent.message, "agent");
      log("Agent started action: " + intent.task, "info");
      await startTask(intent.task);
    }
  } catch (error) {
    log(`Error: ${error.message}`, "error");
    runBtn.disabled = false;
    runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
  }
}

async function startTask(taskDescription) {
  currentStatus.textContent = "Starting...";

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskDescription }),
    });

    if (!response.ok) throw new Error("Failed to start task");

    const data = await response.json();
    const taskId = data.taskId;
    const liveUrl = data.liveUrl;

    taskIdDisplay.textContent = taskId;
    log(`Task created. ID: ${taskId}`, "success");

    if (liveUrl) {
      log(`Live view available`, "info");
      updateLiveView(liveUrl);
    }

    pollStatus(taskId, data.sessionId);
  } catch (error) {
    log(`Error: ${error.message}`, "error");
    runBtn.disabled = false;
    runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
    currentStatus.textContent = "Error";
  }
}

async function pollStatus(taskId, sessionId) {
  pollingInterval = setInterval(async () => {
    try {
      const taskResponse = await fetch(`/api/task/${taskId}`);
      const data = await taskResponse.json();

      const status = data.status;
      currentStatus.textContent = status.toUpperCase();

      if (!liveViewFrame.src && sessionId) {
        const sessionResponse = await fetch(`/api/session/${sessionId}`);
        const sessionData = await sessionResponse.json();
        if (sessionData.liveUrl) {
          log(`Live view available: ${sessionData.liveUrl}`, "info");
          updateLiveView(sessionData.liveUrl);
        }
      }

      if (status === "finished" || status === "stopped") {
        clearInterval(pollingInterval);
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';

        if (data.output) {
          log("Task Completed!", "success");
          log(`Output: ${JSON.stringify(data.output, null, 2)}`, "success");
          addToChat("I've finished the task.", "agent");
        } else {
          log("Task Stopped.", "system");
        }
      } else if (status === "paused") {
        log("Task Paused.", "system");
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 2000);
}

runBtn.addEventListener("click", handleInput);

taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleInput();
  }
});
