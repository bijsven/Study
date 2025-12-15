let ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com", "claude.ai"];

fetch("https://studyuren.bijsven.nl/allowed_sites.json")
    .then(res => res.json())
    .then(data => {
        ALLOWED_SITES = data;
    })
    .catch(() => {
        // keep fallback list on failure
    });

let sessionActive = false;
let overlayRoot = null;
let requestingActivity = false; // reserved for future use; check-ins now follow website events
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
    if (sessionActive) {
        return;
    }
    sessionActive = true;
    lastActivity = Date.now(); // Reset activity timer

    if (!isStudyurenPage && isAllowedSite()) {
        showOverlay();
    }
    
    if (!isStudyurenPage && !isAllowedSite()) {
        chrome.runtime.sendMessage({
            type: "studyuren:block-site",
            data: { url: window.location.href }
        });
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
    return ALLOWED_SITES.some(site => window.location.hostname.includes(site));
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
        * {
            font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            color: white !important;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.5; }
        }
        @keyframes urgentPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            25% { transform: scale(1.5); opacity: 0.7; }
            50% { transform: scale(1); opacity: 1; }
            75% { transform: scale(1.5); opacity: 0.7; }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0) rotate(-15deg); }
            25% { transform: translateX(-3px) rotate(-20deg); }
            50% { transform: translateX(3px) rotate(-10deg); }
            75% { transform: translateX(-3px) rotate(-20deg); }
        }
        .session-overlay {
            all: initial;
            position: fixed;
            top: 48px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            cursor: pointer;
            display: flex;
            gap: 8px;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(14px);
            height: 48px;
            padding: 0 20px;
            border-radius: 9999px;
            pointer-events: auto;
            font-size: 14px;
            transition: all 0.2s ease;
            animation: fadeIn 0.3s ease;
            box-shadow: 0 16px 50px rgba(0,0,0,0.35);
        }
        .session-overlay:hover {
            background: rgba(0, 0, 0, 0.85);
            transform: translateX(-50%) scale(1.05);
        }
        .checkin-card {
            all: initial;
            position: fixed;
            top: 96px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            display: flex;
            gap: 14px;
            align-items: center;
            justify-content: space-between;
            width: 380px;
            padding: 16px 18px;
            height: 110px;
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(18px);
            border-radius: 32px;
            pointer-events: auto;
            box-shadow: 0 16px 50px rgba(0,0,0,0.35);
        }
        .checkin-text {
            all: initial;
            display: block;
            color: rgba(255,255,255,0.85) !important;
            font-size: 12px;
            line-height: 1.5;
            max-width: 250px;
        }
        .checkin-title {
            all: initial;
            display: block;
            color: rgba(255,255,255,0.6) !important;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .checkin-remaining {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: white !important;
        }
        .checkin-svg {
            transform: rotate(-90deg);
        }
    `;
    shadowRoot.appendChild(style);

    const container = document.createElement("div");
    container.style.cssText = `all: initial; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none;`;

    const overlay = document.createElement("div");
    overlay.className = "session-overlay";
    overlay.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "studyuren:focus-studyuren-tab" });
    });

    const pulseDot = document.createElement("div");
    pulseDot.className = 'pulse-dot';
    pulseDot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10B981;
        animation: pulse 2s infinite;
        flex-shrink: 0;
    `;

    const shakeIcon = document.createElement("div");
    shakeIcon.className = 'shake-icon';
    shakeIcon.style.cssText = `
        display: none;
        font-size: 16px;
        animation: shake 0.5s infinite;
    `;
    shakeIcon.textContent = '🖱️';

    const label = document.createElement("p");
    label.className = 'label';
    label.style.cssText = 'margin: 0; font-weight: 500; white-space: nowrap;';
    label.textContent = "Studyuren Sessie";

    overlay.appendChild(pulseDot);
    overlay.appendChild(shakeIcon);
    overlay.appendChild(label);

    const checkinCard = document.createElement("div");
    checkinCard.className = "checkin-card";
    checkinCard.style.display = "none";
    checkinCard.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "studyuren:focus-studyuren-tab" });
    });

    const textWrap = document.createElement("div");
    textWrap.style.cssText = "display: flex; flex-direction: column; gap: 4px; pointer-events: none;";

    const title = document.createElement("span");
    title.className = "checkin-title";
    title.textContent = "Ben je er nog?";

    const bodyText = document.createElement("span");
    bodyText.className = "checkin-text";
    bodyText.textContent = "Beweeg met je muis om door te gaan, zonder interactie stopt de sessie.";

    textWrap.appendChild(title);
    textWrap.appendChild(bodyText);

    const timerWrapper = document.createElement("div");
    timerWrapper.style.cssText = "position: relative; width: 64px; height: 64px; flex-shrink: 0; pointer-events: none;";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "64");
    svg.setAttribute("height", "64");
    svg.classList.add("checkin-svg");

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("r", `${CHECKIN_RADIUS}`);
    bgCircle.setAttribute("cx", "32");
    bgCircle.setAttribute("cy", "32");
    bgCircle.setAttribute("stroke", "white");
    bgCircle.setAttribute("stroke-width", "4");
    bgCircle.setAttribute("opacity", "0.15");
    bgCircle.setAttribute("fill", "none");

    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("r", `${CHECKIN_RADIUS}`);
    progressCircle.setAttribute("cx", "32");
    progressCircle.setAttribute("cy", "32");
    progressCircle.setAttribute("stroke", "white");
    progressCircle.setAttribute("stroke-width", "4");
    progressCircle.setAttribute("fill", "none");
    progressCircle.setAttribute("stroke-linecap", "round");
    progressCircle.setAttribute("stroke-dasharray", `${CHECKIN_CIRCUMFERENCE}`);
    progressCircle.style.strokeDashoffset = `${CHECKIN_CIRCUMFERENCE}`;
    progressCircle.style.transition = "stroke-dashoffset 0.3s linear";

    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);

    const timerLabel = document.createElement("div");
    timerLabel.className = "checkin-remaining";
    timerLabel.textContent = `${checkInState.remaining}s`;

    timerWrapper.appendChild(svg);
    timerWrapper.appendChild(timerLabel);

    checkinCard.appendChild(textWrap);
    checkinCard.appendChild(timerWrapper);

    container.appendChild(checkinCard);
    container.appendChild(overlay);
    shadowRoot.appendChild(container);

    return {
        host: shadowHost,
        refs: {
            pulseDot,
            label,
            shakeIcon,
            checkinCard,
            checkinTimerCircle: progressCircle,
            checkinTimerText: timerLabel
        }
    };
}

if (!isStudyurenPage && !isAllowedSite()) {
    chrome.runtime.sendMessage({ type: "studyuren:check-session" });
    
    setTimeout(() => {
        if (sessionActive) {
            chrome.runtime.sendMessage({
                type: "studyuren:block-site",
                data: { url: window.location.href }
            });
        }
    }, 500);
}