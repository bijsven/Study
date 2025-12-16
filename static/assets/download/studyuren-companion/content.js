let ALLOWED_SITES = [];

fetch("https://studyuren.bijsven.nl/allowed_sites.json")
    .then(res => res.json())
    .then(data => {
        ALLOWED_SITES = data;
    })

let sessionActive = false;
let overlayRoot = null;
let requestingActivity = false;
let overlayElements = null;
let checkInInterval = null;
let checkInState = {
    active: false,
    duration: 10,
    startedAt: 0,
    remaining: 10
};
const isStudyurenPage = window.location.hostname.includes('studyuren.bijsven.nl') || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';


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

function updateCheckInUI() {
    if (!overlayElements) return;
    const { checkinCard, checkinTimerCircle, checkinTimerText } = overlayElements;

    const shouldShow = checkInState.active && sessionActive && !isStudyurenPage;
    if (checkinCard) {
        checkinCard.style.display = shouldShow ? "flex" : "none";
    }
    if (!shouldShow) return;

    const remaining = computeCheckInRemaining();
    const progress = Math.max(
        0,
        Math.min(remaining / Math.max(checkInState.duration, 1), 1)
    );
    const offset = CHECKIN_CIRCUMFERENCE * (1 - progress);

    if (checkinTimerCircle) {
        checkinTimerCircle.style.strokeDashoffset = `${offset}px`;
    }
    if (checkinTimerText) {
        checkinTimerText.textContent = `${remaining}s`;
    }
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
    }, 250);
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

    switch (event.data.type) {
        case "studyuren:start-session":
            if (isStudyurenPage) {
                chrome.runtime.sendMessage({ type: "studyuren:start-session" });
            }
            break;
        case "studyuren:end-session":
            if (isStudyurenPage) {
                chrome.runtime.sendMessage({ type: "studyuren:end-session" });
            }
            break;
        case "studyuren:extension:request":
            chrome.runtime.sendMessage({ type: "studyuren:extension:request" }, (response) => {
            });
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
            chrome.runtime.sendMessage({ type: "studyuren:force-stop" });
            break;
        case "studyuren:check-in-start":
            chrome.runtime.sendMessage({
                type: "studyuren:check-in-start",
                data: {
                    duration: event.data?.duration,
                    startedAt: event.data?.startedAt
                }
            });
            break;
        case "studyuren:check-in-end":
            chrome.runtime.sendMessage({ type: "studyuren:check-in-end" });
            stopCheckInFromExtension();
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
                window.postMessage({
                    type: "studyuren:website:blocked",
                    data: { url: msg.data.url }
                }, "*");
            }
            break;
        case "studyuren:extension:response":
            window.postMessage({
                type: "studyuren:extension:response",
                version: msg.version
            }, "*");
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
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
                    data: { url: window.location.href }
                });
            } else {
                showOverlay();
            }
        }
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

    const { pulseDot, label, shakeIcon } = overlayElements;

    if (pulseDot) {
        pulseDot.style.backgroundColor = '#10B981';
        pulseDot.style.animation = 'pulse 2s infinite';
    }

    if (label) {
        label.textContent = 'Studyuren Sessie';
    }

    if (shakeIcon) {
        shakeIcon.style.display = 'none';
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
        

        * { box-sizing: border-box; font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; color: white !important; margin: 0; padding: 0; }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.5; }
        }
        .session-overlay {
            all: initial;
            position: fixed;
            cursor: grab;
            display: flex;
            gap: 8px;
            align-items: center;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(14px);
            height: 48px;
            padding: 0 20px;
            border-radius: 9999px;
            pointer-events: auto;
            font-size: 14px;
            user-select: none;
        }
        .session-overlay:active { cursor: grabbing; }
    `;
    shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.style.cssText = `all: initial; position: fixed; inset: 0; pointer-events: none;`;

    const overlay = document.createElement("div");
    overlay.className = "session-overlay";

    // ── Drag vs click detection ──
    let isDragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let currentX = window.innerWidth / 2;
    let currentY = 48;
    const DRAG_THRESHOLD = 5; // px

    const updatePosition = () => {
        overlay.style.left = `${currentX}px`;
        overlay.style.top = `${currentY}px`;
        overlay.style.transform = `translate(-50%, -50%)`;
    };
    updatePosition();

    overlay.addEventListener("mousedown", (e) => {
        isDragging = true;
        moved = false;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const nextX = e.clientX - startX;
        const nextY = e.clientY - startY;

        if (
            Math.abs(nextX - currentX) > DRAG_THRESHOLD ||
            Math.abs(nextY - currentY) > DRAG_THRESHOLD
        ) {
            moved = true;
        }

        currentX = nextX;
        currentY = nextY;
        updatePosition();
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    overlay.addEventListener("click", (e) => {
        if (moved) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        chrome.runtime.sendMessage({ type: "studyuren:focus-studyuren-tab" });
    });

    const pulseDot = document.createElement("div");
    pulseDot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10B981;
        animation: pulse 2s infinite;
    `;

    const label = document.createElement("p");
    label.textContent = "Focus sessie";
    label.style.cssText = "margin: 0; font-weight: 500; white-space: nowrap;";

    overlay.appendChild(pulseDot);
    overlay.appendChild(label);

    container.appendChild(overlay);
    shadowRoot.appendChild(container);

    return {
        host: shadowHost,
        refs: {
            pulseDot,
            label,
            shakeIcon: null,
            checkinCard: null,
            checkinTimerCircle: null,
            checkinTimerText: null
        }
    };
}