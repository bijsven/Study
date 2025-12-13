const ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com", "claude.ai"];

let sessionActive = false;
let overlayRoot = null;
const isStudyurenPage = window.location.hostname.includes('studyuren.bijsven.nl') || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';

console.log('[Content] Script geladen op:', window.location.hostname, 'isStudyuren:', isStudyurenPage);

// Luister naar berichten van de pagina zelf
window.addEventListener("message", (event) => {
    // Check of bericht van deze pagina komt (niet van iframe)
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    console.log('[Content] Bericht van pagina:', event.data.type);

    switch (event.data.type) {
        case "studyuren:start-session":
            if (isStudyurenPage) {
                console.log('[Content] Start sessie - stuur naar background');
                chrome.runtime.sendMessage({ type: "studyuren:start-session" });
            }
            break;
        case "studyuren:end-session":
            if (isStudyurenPage) {
                console.log('[Content] Stop sessie - stuur naar background');
                chrome.runtime.sendMessage({ type: "studyuren:end-session" });
            }
            break;
        case "studyuren:extension:request":
            console.log('[Content] Extension request ontvangen, doorsturen naar background');
            chrome.runtime.sendMessage({ type: "studyuren:extension:request" }, (response) => {
                console.log('[Content] Response van background:', response);
            });
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
            // window.postMessage({ type: "studyuren:force-stop" }, "*");
            chrome.runtime.sendMessage({ type: "studyuren:force-stop" });
            break;
    }
});

// Luister naar berichten van background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Content] Bericht van background:', msg.type);

    switch (msg.type) {
        case "studyuren:session:start":
            handleSessionStart();
            break;
        case "studyuren:session:end":
            handleSessionEnd();
            break;
        case "studyuren:website:blocked":
            // Alleen Studyuren pagina ontvangt dit
            if (isStudyurenPage) {
                window.postMessage({
                    type: "studyuren:website:blocked",
                    data: { url: msg.data.url }
                }, "*");
            }
            break;
        case "studyuren:extension:response":
            // Stuur door naar pagina (werkt op alle pagina's)
            window.postMessage({
                type: "studyuren:extension:response",
                version: msg.version
            }, "*");
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
            window.postMessage({ type: "studyuren:force-stop" }, "*");
            break;
    }
    return true;
});

// Vraag bij load meteen status op (alleen als het NIET de Studyuren pagina is)
if (!isStudyurenPage) {
    console.log('[Content] Vraag sessie status op...');
    chrome.runtime.sendMessage({ type: "studyuren:check-session" });
} else {
    console.log('[Content] Dit is Studyuren pagina, geen sessie status nodig');
}

function handleSessionStart() {
    if (sessionActive) {
        console.log('[Content] Sessie al actief');
        return;
    }
    sessionActive = true;
    console.log('[Content] ✅ Sessie GESTART op:', window.location.hostname);

    // Alleen overlay tonen op toegestane sites (niet op Studyuren zelf)
    if (!isStudyurenPage && isAllowedSite()) {
        console.log('[Content] Toon overlay');
        showOverlay();
    }
    
    // Als we op een niet-toegestane site zijn, blokkeer deze
    if (!isStudyurenPage && !isAllowedSite()) {
        console.log('[Content] 🚫 Blokkeer niet-toegestane site');
        chrome.runtime.sendMessage({
            type: "studyuren:block-site",
            data: { url: window.location.href }
        });
    }
}

function handleSessionEnd() {
    if (!sessionActive) {
        console.log('[Content] Sessie al gestopt');
        return;
    }
    sessionActive = false;
    console.log('[Content] ❌ Sessie GESTOPT op:', window.location.hostname);
    hideOverlay();
}

function isAllowedSite() {
    return ALLOWED_SITES.some(site => window.location.hostname.includes(site));
}

function showOverlay() {
    if (overlayRoot) return; // Al zichtbaar
    
    overlayRoot = createFocusOverlay();
    document.body.appendChild(overlayRoot);
}

function hideOverlay() {
    if (overlayRoot) {
        overlayRoot.remove();
        overlayRoot = null;
    }
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
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    shadowRoot.appendChild(style);

    const overlay = document.createElement("div");
    overlay.style.cssText = `
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
        backdrop-filter: blur(10px);
        height: 48px;
        width: 192px;
        border-radius: 9999px;
        pointer-events: auto;
        font-size: 14px;
        transition: all 0.2s ease;
        animation: fadeIn 0.3s ease;
    `;

    overlay.addEventListener('mouseenter', () => {
        overlay.style.background = 'rgba(0, 0, 0, 0.85)';
        overlay.style.transform = 'translateX(-50%) scale(1.05)';
    });

    overlay.addEventListener('mouseleave', () => {
        overlay.style.background = 'rgba(0, 0, 0, 0.75)';
        overlay.style.transform = 'translateX(-50%) scale(1)';
    });

    overlay.addEventListener('click', () => {
        console.log('[Content] Overlay geklikt - focus naar Studyuren tab');
        // Vraag background om Studyuren tab te focussen
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
    label.style.cssText = 'margin: 0; font-weight: 500;';
    label.textContent = "Focus sessie";

    overlay.appendChild(pulseDot);
    overlay.appendChild(label);
    shadowRoot.appendChild(overlay);

    return shadowHost;
}

// Check of site is toegestaan, anders blokkeren
if (!isStudyurenPage && !isAllowedSite()) {
    console.log('[Content] ⚠️ Niet-toegestane site gedetecteerd:', window.location.hostname);
    
    // Wacht op sessie status
    chrome.runtime.sendMessage({ type: "studyuren:check-session" });
    
    // Check na 500ms of we in sessie zijn en moeten blokkeren
    setTimeout(() => {
        console.log('[Content] Check blokkeren - sessionActive:', sessionActive);
        if (sessionActive) {
            console.log('[Content] 🚫 BLOKKEREN van:', window.location.href);
            chrome.runtime.sendMessage({
                type: "studyuren:block-site",
                data: { url: window.location.href }
            });
        }
    }, 500);
} else {
    console.log('[Content] ✅ Site is toegestaan of Studyuren zelf');
}