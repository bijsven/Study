let ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com", "claude.ai"];

fetch("https://studyuren.bijsven.nl/allowed_sites.json")
    .then(res => res.json())
    .then(data => {
        ALLOWED_SITES = data;
    })
    .catch(() => { });

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

const isStudyurenPage =
    window.location.hostname.includes("studyuren.bijsven.nl") ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

let lastActivity = Date.now();
const ACTIVITY_INTERVAL = 5000;
const CHECKIN_RADIUS = 20;
const CHECKIN_CIRCUMFERENCE = 2 * Math.PI * CHECKIN_RADIUS;

/* ---------------- Overlay helpers ---------------- */

function ensureOverlay() {
    if (!overlayRoot) showOverlay();
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
    checkInState.remaining = Math.max(0, Math.ceil(checkInState.duration - elapsed));
    return checkInState.remaining;
}

function updateCheckInUI() {
    if (!overlayElements) return;

    const { checkinCard, checkinTimerCircle, checkinTimerText } = overlayElements;
    const shouldShow = checkInState.active && sessionActive && !isStudyurenPage;

    if (checkinCard) checkinCard.style.display = shouldShow ? "flex" : "none";
    if (!shouldShow) return;

    const remaining = computeCheckInRemaining();
    const progress = remaining / Math.max(checkInState.duration, 1);
    const offset = CHECKIN_CIRCUMFERENCE * (1 - progress);

    checkinTimerCircle.style.strokeDashoffset = `${offset}px`;
    checkinTimerText.textContent = `${remaining}s`;
}

/* ---------------- Check-in logic ---------------- */

function startCheckInFromExtension(data = {}) {
    if (isStudyurenPage) {
        window.postMessage({ type: "studyuren:check-in:start", data }, "*");
        return;
    }

    checkInState.active = true;
    checkInState.duration = Number(data.duration) || 10;
    checkInState.startedAt = Number(data.startedAt) || Date.now();

    ensureOverlay();
    updateCheckInUI();
    clearCheckInInterval();

    checkInInterval = setInterval(() => {
        if (computeCheckInRemaining() <= 0) {
            stopCheckInFromExtension();
        }
        updateCheckInUI();
    }, 250);
}

function stopCheckInFromExtension() {
    checkInState.active = false;
    clearCheckInInterval();
    updateCheckInUI();
}

/* ---------------- Activity ---------------- */

function updateActivity() {
    lastActivity = Date.now();
    chrome.runtime.sendMessage({ type: "studyuren:user-active" });
}

["mousemove", "keydown", "scroll"].forEach(e =>
    window.addEventListener(e, updateActivity)
);

/* ---------------- Overlay lifecycle ---------------- */

function showOverlay() {
    if (overlayRoot) return;
    const { host, refs } = createFocusOverlay();
    overlayRoot = host;
    overlayElements = refs;
    document.body.appendChild(host);
}

function hideOverlay() {
    if (overlayRoot) overlayRoot.remove();
    overlayRoot = null;
    overlayElements = null;
    stopCheckInFromExtension();
}

/* ---------------- Overlay UI ---------------- */

function createFocusOverlay() {
    const shadowHost = document.createElement("div");
    shadowHost.style.cssText =
        "all:initial;position:fixed;top:0;left:0;z-index:2147483647;width:0;height:0;pointer-events:none;";
    const shadowRoot = shadowHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { font-family: system-ui; color: white; box-sizing: border-box; }

        .session-overlay {
            position: fixed;
            top: 48px;
            left: 48px;
            cursor: grab;
            display: flex;
            gap: 8px;
            align-items: center;
            background: rgba(0,0,0,.75);
            height: 48px;
            padding: 0 20px;
            border-radius: 9999px;
            pointer-events: auto;
            transition: background .2s ease, transform .2s ease;
            box-shadow: 0 16px 50px rgba(0,0,0,.35);
        }

        .session-overlay:active {
            cursor: grabbing;
        }

        .session-overlay:hover {
            background: rgba(0,0,0,.85);
            transform: scale(1.05);
        }
    `;
    shadowRoot.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "session-overlay";

    /* ---------- DRAG LOGIC ---------- */
    let dragging = false;
    let startX, startY, startLeft, startTop;

    overlay.addEventListener("mousedown", e => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const r = overlay.getBoundingClientRect();
        startLeft = r.left;
        startTop = r.top;
        e.preventDefault();
    });

    window.addEventListener("mousemove", e => {
        if (!dragging) return;
        overlay.style.left = startLeft + (e.clientX - startX) + "px";
        overlay.style.top = startTop + (e.clientY - startY) + "px";
    });

    window.addEventListener("mouseup", () => dragging = false);
    /* ---------- END DRAG LOGIC ---------- */

    const dot = document.createElement("div");
    dot.style.cssText =
        "width:8px;height:8px;border-radius:50%;background:#10B981;";

    const label = document.createElement("span");
    label.textContent = "Studyuren Sessie";

    overlay.append(dot, label);
    shadowRoot.appendChild(overlay);

    return {
        host: shadowHost,
        refs: {
            pulseDot: dot,
            label
        }
    };
}
