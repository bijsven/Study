const ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com"];

let sessionActive = false;
let studyurenTabId = null;

// Luister naar berichten van content scripts en tabs
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Background] Ontvangen:', msg.type, 'van tab', sender.tab?.id);

    switch (msg.type) {
        case "studyuren:extension:request":
            // Stuur direct terug naar de tab die het vraagt
            if (sender.tab?.id) {
                console.log('[Background] Stuur extensie response naar tab', sender.tab.id);
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: "studyuren:extension:response",
                    version: chrome.runtime.getManifest().version
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('[Background] Error bij sturen response:', chrome.runtime.lastError);
                    }
                });
            }
            sendResponse({ success: true });
            return true; // Houd message channel open
            break;

        case "studyuren:start-session":
            sessionActive = true;
            studyurenTabId = sender.tab?.id || null;
            console.log('[Background] Sessie gestart, Studyuren tab:', studyurenTabId);
            closeExistingBlockedTabs();
            broadcastSessionState();
            break;

        case "studyuren:end-session":
            sessionActive = false;
            console.log('[Background] Sessie gestopt');
            broadcastSessionState();
            break;

        case "studyuren:check-session":
            // Stuur huidige status terug naar de vragende tab
            if (sender.tab?.id) {
                sendSessionState(sender.tab.id);
            }
            break;

        case "studyuren:block-site":
            // Blokkeer een site en stuur melding naar Studyuren tab
            if (sender.tab?.id) {
                blockSiteAndNotify(sender.tab.id, msg.data?.url || sender.tab.url);
            }
            break;
            
        case "studyuren:focus-studyuren-tab":
            // Focus op de Studyuren tab
            focusStudyurenTab();
            break;
    }
});

// Broadcast sessie status naar alle tabs (BEHALVE Studyuren zelf)
function broadcastSessionState() {
    console.log('[Background] Broadcasting sessie status:', sessionActive ? 'START' : 'END');
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.id) return;
            
            // Skip de Studyuren tab zelf
            if (tab.id === studyurenTabId) {
                console.log('[Background] Skip Studyuren tab', tab.id);
                return;
            }
            
            chrome.tabs.sendMessage(tab.id, {
                type: sessionActive ? "studyuren:session:start" : "studyuren:session:end"
            }, () => {
                // Negeer errors (tab kan gesloten zijn of geen content script hebben)
                if (chrome.runtime.lastError) return;
            });
        });
    });
}

// Stuur sessie status naar specifieke tab
function sendSessionState(tabId) {
    if (!tabId) return;
    
    // Als het de Studyuren tab is, stuur geen sessie status terug
    if (tabId === studyurenTabId) {
        console.log('[Background] Skip sessie status naar Studyuren tab zelf');
        return;
    }
    
    console.log('[Background] Stuur sessie status naar tab', tabId, ':', sessionActive ? 'ACTIEF' : 'NIET ACTIEF');
    
    chrome.tabs.sendMessage(tabId, {
        type: sessionActive ? "studyuren:session:start" : "studyuren:session:end"
    }, () => {
        if (chrome.runtime.lastError) return;
    });
}

// Blokkeer site en stuur melding naar Studyuren
function blockSiteAndNotify(blockedTabId, blockedUrl) {
    console.log('[Background] Blokkeren:', blockedUrl);
    
    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (studyTab && studyTab.id) {
            chrome.windows.update(studyTab.windowId, { focused: true });
            chrome.tabs.update(studyTab.id, { active: true });
            chrome.tabs.remove(blockedTabId);

            chrome.tabs.sendMessage(studyTab.id, {
                type: "studyuren:website:blocked",
                data: { url: blockedUrl }
            });
        } else {
            sessionActive = false;
            broadcastSessionState();
            if (blockedTabId) {
                chrome.tabs.remove(blockedTabId);
            }
        }
    });
}

function focusStudyurenTab() {
    console.log('[Background] Focus naar Studyuren tab');
    
    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (studyTab && studyTab.id) {
            chrome.windows.update(studyTab.windowId, { focused: true });
            chrome.tabs.update(studyTab.id, { active: true });
            console.log('[Background] Gefocust op tab', studyTab.id);
        } else {
            console.log('[Background] Studyuren tab niet gevonden');
        }
    });
}

setInterval(() => {
    if (!sessionActive) return;

    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (!studyTab) {
            console.log('[Background] Studyuren tab niet gevonden, sessie stoppen');
            sessionActive = false;
            studyurenTabId = null;
            broadcastSessionState();
        } else if (studyTab.id !== studyurenTabId) {
            console.log('[Background] Studyuren tab ID update:', studyurenTabId, '->', studyTab.id);
            studyurenTabId = studyTab.id;
        }
    });
}, 2000);

// Luister naar gesloten tabs
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === studyurenTabId) {
        console.log('[Background] Studyuren tab gesloten, sessie stoppen');
        sessionActive = false;
        studyurenTabId = null;
        broadcastSessionState();
    }
});

function closeExistingBlockedTabs() {    
    console.log('[Background] Check alle bestaande tabs voor niet-toegestane sites');
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.url || !tab.id) return;
            
            if (tab.id === studyurenTabId) return;
            
            try {
                const url = new URL(tab.url);
                const hostname = url.hostname;
                
                const isAllowed = ALLOWED_SITES.some(site => hostname.includes(site));
                
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') return;
                
                if (!isAllowed) {
                    console.log('[Background] Sluit bestaande niet-toegestane tab:', hostname);
                    
                    if (studyurenTabId) {
                        chrome.tabs.sendMessage(studyurenTabId, {
                            type: "studyuren:website:blocked",
                            data: { url: tab.url }
                        }, () => {
                            chrome.tabs.remove(tab.id);
                        });
                    } else {
                        chrome.tabs.remove(tab.id);
                    }
                }
            } catch (e) {
                console.log('[Background] Kan URL niet parsen:', tab.url);
            }
        });
    });
}

let lastFocusedWindowId = null;

setInterval(async () => {
    const windows = await chrome.windows.getAll({populate: false});
    const focusedWindow = windows.find(w => w.focused);

    chrome.tabs.query({}, (tabs) => {
    if (!focusedWindow) {
        
        console.log('[Background] Geen gefocuste window');
        if (sessionActive) {
            console.log('[Background] ⚠️ Browser window verloor focus, stop sessie');
            const studyTab = tabs.find(t => 
                t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
            );

            sessionActive = false;

            chrome.tabs.sendMessage(studyTab.id, {
                type: "studyuren:session:force-stop"
            }, () => {
                if (chrome.runtime.lastError) {
                    console.log('[Background] Kon stop bericht niet sturen');
                }
            });

            broadcastSessionState();
        }
    } else if (focusedWindow.id !== lastFocusedWindowId) {
        console.log('[Background] Nieuwe gefocuste window:', focusedWindow.id);
        lastFocusedWindowId = focusedWindow.id;
    }
    });

}, 1000);
