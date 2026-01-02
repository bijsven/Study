let ALLOWED_SITES = [];

fetch("https://study.bijsven.nl/allowed_sites.json")
  .then((res) => res.json())
  .then((data) => {
    ALLOWED_SITES = data;
  });

let sessionActive = false;
let overlayRoot = null;
let requestingActivity = false;
let overlayElements = null;
let checkInInterval = null;
let checkInState = {
  active: false,
  duration: 10,
  startedAt: 0,
  remaining: 10,
};
const isStudyurenPage =
  window.location.hostname.includes("study.bijsven.nl") ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

let lastActivity = Date.now();
const ACTIVITY_INTERVAL = 5000;
const CHECKIN_RADIUS = 20;
const CHECKIN_CIRCUMFERENCE = 2 * Math.PI * CHECKIN_RADIUS;

function ensureOverlay() {
  if (!overlayRoot) {
    showOverlay();
  }
  return overlayElements;
}

function clearCheckInInterval() {
  if (checkInInterval) {
    clearInterval(checkInInterval);
    checkInInterval = null;
  }
}

function computeCheckInRemaining() {
  const elapsed = (Date.now() - checkInState.startedAt) / 1000;
  const remaining = Math.max(0, Math.ceil(checkInState.duration - elapsed));
  checkInState.remaining = remaining;
  return remaining;
}

let lastSnapPosition = {
  top: "20px",
  left: "20px",
  right: "auto",
  bottom: "auto",
  borderRadius: "9999px",
};

function updateCheckInUI() {
  if (!overlayElements) return;
  const { container, checkinTimerCircle } = overlayElements;

  const shouldShowCheckin =
    checkInState.active && sessionActive && !isStudyurenPage;

  if (shouldShowCheckin) {
    if (!container.classList.contains("mode-checkin")) {
      container.classList.add("mode-checkin");
      container.style.top = "20%";
      container.style.left = "50%";
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.transform = "translate(-50%, 0)";
      container.style.borderRadius = "40px"; // Ronde kaart vorm
    }
  } else {
    if (container.classList.contains("mode-checkin")) {
      container.classList.remove("mode-checkin");
      // Terug naar de laatste snap positie
      applySnapPosition(container);
    }
  }

  // Timer logica blijft hetzelfde
  if (!shouldShowCheckin) return;

  const remaining = computeCheckInRemaining();
  const totalDuration = checkInState.duration;
  const percentage = Math.max(
    0,
    Math.min(1, (Date.now() - checkInState.startedAt) / 1000 / totalDuration),
  );

  // Zorg dat timer circle bestaat
  if (checkinTimerCircle) {
    const offset = CHECKIN_CIRCUMFERENCE * percentage;
    checkinTimerCircle.style.strokeDashoffset = `${offset}px`;
  }
}

function applySnapPosition(element) {
  element.style.transform = "translate(0, 0)"; // Reset transform
  element.style.top = lastSnapPosition.top;
  element.style.bottom = lastSnapPosition.bottom;
  element.style.left = lastSnapPosition.left;
  element.style.right = lastSnapPosition.right;

  // Kleine delay voor border-radius voor smooth effect
  element.style.borderRadius = lastSnapPosition.borderRadius;
}

function startCheckInFromExtension(data = {}) {
  if (isStudyurenPage) {
    window.postMessage({ type: "studyuren:check-in:start", data }, "*");
    return;
  }

  const duration = Number(data?.duration) || 10;
  const startedAt = Number(data?.startedAt) || Date.now();

  checkInState.active = true;
  checkInState.duration = duration;
  checkInState.startedAt = startedAt;
  computeCheckInRemaining();

  ensureOverlay();
  updateCheckInUI();
  clearCheckInInterval();

  checkInInterval = setInterval(() => {
    const remaining = computeCheckInRemaining();
    updateCheckInUI();

    if (remaining <= 0) {
      stopCheckInFromExtension();
    }
  }, 50); // Sneller interval voor soepelere animatie
}

function stopCheckInFromExtension() {
  checkInState.active = false;
  checkInState.remaining = checkInState.duration;
  clearCheckInInterval();
  updateCheckInUI();
}

function updateActivity() {
  lastActivity = Date.now();
  if (requestingActivity) {
    requestingActivity = false;
    updateOverlayState();
  }
  chrome.runtime.sendMessage({ type: "studyuren:user-active" });
}

window.addEventListener("mousemove", updateActivity);
window.addEventListener("keydown", updateActivity);
window.addEventListener("scroll", updateActivity);

setInterval(() => {
  if (Date.now() - lastActivity < ACTIVITY_INTERVAL) {
    chrome.runtime.sendMessage({ type: "studyuren:user-active" });
  }
}, 2000);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || !event.data.type) return;

  console.log("[Content] Received page message:", event.data.type, event.data);

  switch (event.data.type) {
    case "studyuren:start-session":
      if (isStudyurenPage) {
        const settings = event.data.strictnessSettings || {
          browserFocus: true,
          tabManagement: true,
          checkInMoments: true,
        };
        console.log(
          "[Content] Starting session with strictness settings:",
          settings,
        );
        console.log("[Content] - browserFocus:", settings.browserFocus);
        console.log("[Content] - tabManagement:", settings.tabManagement);
        console.log("[Content] - checkInMoments:", settings.checkInMoments);

        chrome.runtime.sendMessage({
          type: "studyuren:start-session",
          strictnessSettings: settings,
        });
      }
      break;
    case "studyuren:end-session":
      if (isStudyurenPage) {
        chrome.runtime.sendMessage({ type: "studyuren:end-session" });
      }
      break;
    case "studyuren:extension:request":
      chrome.runtime.sendMessage(
        { type: "studyuren:extension:request" },
        (response) => {},
      );
      break;
    case "studyuren:session:force-stop":
      console.log("sessie wordt geprobeerd te stoppen in content.js");
      chrome.runtime.sendMessage({ type: "studyuren:force-stop" });
      break;
    case "studyuren:check-in-start":
      chrome.runtime.sendMessage({
        type: "studyuren:check-in-start",
        data: {
          duration: event.data?.duration,
          startedAt: event.data?.startedAt,
        },
      });
      break;
    case "studyuren:check-in-end":
      chrome.runtime.sendMessage({ type: "studyuren:check-in-end" });
      stopCheckInFromExtension();
      break;
    case "studyuren:update-strictness":
      if (isStudyurenPage) {
        console.log(
          "[Content] Updating strictness settings:",
          event.data.strictnessSettings,
        );
        chrome.runtime.sendMessage({
          type: "studyuren:update-strictness",
          strictnessSettings: event.data.strictnessSettings,
        });
      }
      break;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case "studyuren:session:start":
      handleSessionStart();
      break;
    case "studyuren:session:end":
      handleSessionEnd();
      break;
    case "studyuren:session:active":
      requestingActivity = false;
      if (isStudyurenPage) {
        window.postMessage({ type: "studyuren:session:active" }, "*");
      }
      stopCheckInFromExtension();
      updateOverlayState();
      break;
    case "studyuren:website:blocked":
      if (isStudyurenPage) {
        window.postMessage(
          {
            type: "studyuren:website:blocked",
            data: { url: msg.data.url },
          },
          "*",
        );
      }
      break;
    case "studyuren:extension:response":
      window.postMessage(
        {
          type: "studyuren:extension:response",
          version: msg.version,
        },
        "*",
      );
      break;
    case "studyuren:session:force-stop":
      console.log("sessie wordt geprobeerd te stoppen in content.js");
      window.postMessage({ type: "studyuren:force-stop" }, "*");
      break;
    case "studyuren:activity-confirmed":
      requestingActivity = false;
      updateOverlayState();
      break;
    case "studyuren:check-in:start":
      startCheckInFromExtension(msg.data || {});
      break;
    case "studyuren:check-in:end":
      stopCheckInFromExtension();
      if (isStudyurenPage) {
        window.postMessage({ type: "studyuren:check-in:end" }, "*");
      }
      break;
  }
  return true;
});

if (!isStudyurenPage) {
  chrome.runtime.sendMessage({ type: "studyuren:check-session" });
}

function handleSessionStart() {
  if (sessionActive) return;

  sessionActive = true;
  lastActivity = Date.now();

  if (!isStudyurenPage) {
    isAllowedSite();
  }
}

function handleSessionEnd() {
  if (!sessionActive) {
    return;
  }
  sessionActive = false;
  requestingActivity = false;
  stopCheckInFromExtension();
  hideOverlay();
}

function isAllowedSite() {
  chrome.runtime.sendMessage(
    { type: "studyuren:is-allowed", url: window.location.href },
    (res) => {
      if (!res) return;

      if (!res.allowed && sessionActive) {
        chrome.runtime.sendMessage({
          type: "studyuren:block-site",
          data: { url: window.location.href },
        });
      } else {
        showOverlay();
      }
    },
  );
}

function showOverlay() {
  if (overlayRoot) return;

  const { host, refs } = createFocusOverlay();
  overlayRoot = host;
  overlayElements = refs;
  document.body.appendChild(host);
}

function hideOverlay() {
  if (overlayRoot) {
    overlayRoot.remove();
    overlayRoot = null;
    overlayElements = null;
  }
  stopCheckInFromExtension();
}

function updateOverlayState() {
  if (!overlayElements) return;

  const { pulseDot, shakeIcon } = overlayElements;

  if (pulseDot) {
    pulseDot.style.backgroundColor = "#10B981";
    pulseDot.style.animation = "pulse 2s infinite";
  }

  if (shakeIcon) {
    shakeIcon.style.display = "none";
  }

  updateCheckInUI();
}

function createFocusOverlay() {
  const shadowHost = document.createElement("div");
  shadowHost.style.cssText = `all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; width: 0; height: 0; pointer-events: none;`;
  const shadowRoot = shadowHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');

        * { box-sizing: border-box; font-family: "Google Sans", sans-serif !important; color: white !important; margin: 0; padding: 0; }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.5; }
        }

        .widget-container {
            all: initial;
            position: fixed;
            z-index: 2147483647;
            font-family: "Google Sans", sans-serif;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(14px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            transition:
                width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                top 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                left 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                border-radius 0.5s ease,
                background-color 0.3s ease;
            overflow: hidden;
            pointer-events: auto;
            cursor: grab;
            user-select: none;
            width: 160px;
            height: 48px;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .widget-container:active { cursor: grabbing; }

        .content-focus {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            padding: 0 20px;
            gap: 12px;
            opacity: 1;
            transition: opacity 0.3s ease;
        }

        .content-checkin {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding: 24px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease 0.1s;
        }

        .widget-container.mode-checkin {
            width: 384px;
            height: 100px;
            background: rgba(0, 0, 0, 0.85);
            cursor: default;
        }

        .widget-container.mode-checkin .content-focus { opacity: 0; pointer-events: none; }
        .widget-container.mode-checkin .content-checkin { opacity: 1; pointer-events: auto; }

        .pulse-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background-color: #10B981;
            animation: pulse 2s infinite;
            flex-shrink: 0;
        }

        .label { font-size: 14px; font-weight: 500; white-space: nowrap; }
        .checkin-text { display: flex; flex-direction: column; gap: 4px; }
        .checkin-title { font-size: 12px; opacity: 0.6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .checkin-subtitle { font-size: 13px; width: 240px; line-height: 1.4; color: rgba(255,255,255,0.9) !important; }
        .svg-container { transform: rotate(-90deg); margin-left: 10px; }
    `;
  shadowRoot.appendChild(style);

  const container = document.createElement("div");
  container.className = "widget-container";

  const focusContent = document.createElement("div");
  focusContent.className = "content-focus";

  const pulseDot = document.createElement("div");
  pulseDot.className = "pulse-dot";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "Focus sessie";

  focusContent.appendChild(pulseDot);
  focusContent.appendChild(label);

  const checkinContent = document.createElement("div");
  checkinContent.className = "content-checkin";
  checkinContent.innerHTML = `
        <div class="checkin-text">
            <div class="checkin-title">Ben je er nog?</div>
            <div class="checkin-subtitle">
                Beweeg je muis om door te gaan. Zonder actie stopt de sessie.
            </div>
        </div>
        <div class="svg-container">
             <svg width="44" height="44">
                <circle r="${CHECKIN_RADIUS}" cx="22" cy="22" stroke="white" stroke-width="3" opacity="0.2" fill="none" />
                <circle id="progress-circle" r="${CHECKIN_RADIUS}" cx="22" cy="22" stroke="white" stroke-width="3" fill="none"
                    stroke-dasharray="${CHECKIN_CIRCUMFERENCE}" stroke-dashoffset="0" stroke-linecap="round" />
            </svg>
        </div>
    `;

  container.appendChild(focusContent);
  container.appendChild(checkinContent);
  shadowRoot.appendChild(container);

  // --- Drag & Snap Logica met Click-fix ---
  let isDragging = false;
  let dragHasStarted = false; // Vlag om onderscheid te maken tussen klik en drag
  let startX, startY;
  let initialLeft, initialTop;
  const DRAG_THRESHOLD = 5; // Hoeveelheid pixels bewegen voor het telt als slepen

  container.addEventListener("mousedown", (e) => {
    if (container.classList.contains("mode-checkin")) return;

    startX = e.clientX;
    startY = e.clientY;

    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    isDragging = true;
    dragHasStarted = false; // Reset bij elke nieuwe klik
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Pas als we voorbij de drempel zijn, schakelen we de visuele drag in
    if (!dragHasStarted && distance > DRAG_THRESHOLD) {
      dragHasStarted = true;
      container.style.transition = "none";
      container.style.right = "auto";
      container.style.bottom = "auto";
      container.style.transform = "none";
    }

    if (dragHasStarted) {
      container.style.left = `${initialLeft + dx}px`;
      container.style.top = `${initialTop + dy}px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;

    // Alleen snappen als er daadwerkelijk gesleept is
    if (dragHasStarted) {
      container.style.transition = `
                width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                top 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                left 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                border-radius 0.3s ease
            `;

      const rect = container.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      const isLeft = rect.left + rect.width / 2 < winW / 2;
      const isTop = rect.top + rect.height / 2 < winH / 2;

      const SNAP_MARGIN = "0px";
      const DOCKED_RADIUS = "0px";
      const DEFAULT_RADIUS = "10px";

      lastSnapPosition = {
        top: "auto",
        bottom: "auto",
        left: "auto",
        right: "auto",
        borderRadius: DEFAULT_RADIUS,
      };

      if (isTop && isLeft) {
        lastSnapPosition.top = SNAP_MARGIN;
        lastSnapPosition.left = SNAP_MARGIN;
        lastSnapPosition.borderRadius = `${DOCKED_RADIUS} ${DEFAULT_RADIUS} ${DEFAULT_RADIUS} ${DEFAULT_RADIUS}`;
      } else if (isTop && !isLeft) {
        lastSnapPosition.top = SNAP_MARGIN;
        lastSnapPosition.right = SNAP_MARGIN;
        lastSnapPosition.borderRadius = `${DEFAULT_RADIUS} ${DOCKED_RADIUS} ${DEFAULT_RADIUS} ${DEFAULT_RADIUS}`;
      } else if (!isTop && isLeft) {
        lastSnapPosition.bottom = SNAP_MARGIN;
        lastSnapPosition.left = SNAP_MARGIN;
        lastSnapPosition.borderRadius = `${DEFAULT_RADIUS} ${DEFAULT_RADIUS} ${DEFAULT_RADIUS} ${DOCKED_RADIUS}`;
      } else {
        lastSnapPosition.bottom = SNAP_MARGIN;
        lastSnapPosition.right = SNAP_MARGIN;
        lastSnapPosition.borderRadius = `${DEFAULT_RADIUS} ${DEFAULT_RADIUS} ${DOCKED_RADIUS} ${DEFAULT_RADIUS}`;
      }

      applySnapPosition(container);
    }
  });

  container.addEventListener("click", (e) => {
    // Als we hebben gesleept, blokkeren we de klik-actie
    if (dragHasStarted) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!container.classList.contains("mode-checkin")) {
      chrome.runtime.sendMessage({ type: "studyuren:focus-studyuren-tab" });
    }
  });

  const progressCircle = checkinContent.querySelector("#progress-circle");

  return {
    host: shadowHost,
    refs: {
      pulseDot,
      label,
      shakeIcon: null,
      container: container,
      checkinTimerCircle: progressCircle,
      checkinTimerText: null,
    },
  };
}
