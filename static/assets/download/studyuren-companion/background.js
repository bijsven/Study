// Studyuren Companion Extension - Background Service Worker
// Version 0.6.0

console.log("[Background] Service worker started");

let ALLOWED_SITES = [];
let allowedSitesReady = false;

fetch("https://study.bijsven.nl/allowed_sites.json")
  .then((res) => res.json())
  .then((data) => {
    ALLOWED_SITES = data;
    allowedSitesReady = true;
    console.log("[Background] Allowed sites loaded:", ALLOWED_SITES);
  })
  .catch(() => {
    ALLOWED_SITES = ["itslearning.com", "somtoday.nl"];
    allowedSitesReady = true;
    console.log("[Background] Using fallback allowed sites:", ALLOWED_SITES);
  });

// Session state
let sessionActive = false;
let studyurenTabId = null;
let stoppedDueToAppSwitch = false;
let lastFocusedWindowId = null;

// Strictness settings - defaults to strict mode
let strictnessSettings = {
  browserFocus: true,
  tabManagement: true,
  checkInMoments: true,
};

// Main message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Background] Message received:", msg.type, msg);

  switch (msg.type) {
    case "studyuren:extension:request":
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "studyuren:extension:response",
          version: chrome.runtime.getManifest().version,
        });
      }
      sendResponse({ success: true });
      return true;

    case "studyuren:start-session":
      handleStartSession(msg, sender);
      sendResponse({ success: true });
      return true;

    case "studyuren:end-session":
      handleEndSession();
      sendResponse({ success: true });
      return true;

    case "studyuren:check-session":
      if (sender.tab?.id && sender.tab.id !== studyurenTabId) {
        sendSessionState(sender.tab.id);
      }
      sendResponse({ sessionActive });
      return true;

    case "studyuren:block-site":
      // Only block sites if tab management is enabled
      if (strictnessSettings.tabManagement && sender.tab?.id) {
        blockSiteAndNotify(sender.tab.id, msg.data?.url || sender.tab.url);
      } else {
        console.log(
          "[Background] Block request ignored - tabManagement is disabled",
        );
      }
      sendResponse({ success: true });
      return true;

    case "studyuren:focus-studyuren-tab":
      focusStudyurenTab();
      sendResponse({ success: true });
      return true;

    case "studyuren:check-in-start":
      broadcastCheckIn(true, msg.data);
      focusStudyurenTab();
      sendResponse({ success: true });
      return true;

    case "studyuren:check-in-end":
      broadcastCheckIn(false, msg.data);
      sendResponse({ success: true });
      return true;

    case "studyuren:update-strictness":
      handleUpdateStrictness(msg);
      sendResponse({ success: true });
      return true;

    case "studyuren:user-active":
      if (studyurenTabId) {
        chrome.tabs.sendMessage(studyurenTabId, {
          type: "studyuren:session:active",
        });
      }
      broadcastActivityConfirmed();
      sendResponse({ success: true });
      return true;

    case "studyuren:is-allowed":
      // If tab management is disabled, all sites are allowed
      if (!strictnessSettings.tabManagement) {
        console.log(
          "[Background] is-allowed: tabManagement disabled, allowing all sites",
        );
        sendResponse({ allowed: true });
        return true;
      }
      if (!allowedSitesReady) {
        sendResponse({ allowed: true });
        return true;
      }
      try {
        const hostname = new URL(msg.url).hostname;
        const allowed = ALLOWED_SITES.some((site) => hostname.includes(site));
        sendResponse({ allowed });
      } catch {
        sendResponse({ allowed: true });
      }
      return true;

    case "studyuren:force-stop":
      handleEndSession();
      sendResponse({ success: true });
      return true;
  }

  return false;
});

function handleStartSession(msg, sender) {
  sessionActive = true;
  studyurenTabId = sender.tab?.id || null;
  stoppedDueToAppSwitch = false;

  console.log("[Background] === SESSION STARTED ===");
  console.log("[Background] Studyuren tab ID:", studyurenTabId);
  console.log(
    "[Background] Received strictness settings:",
    msg.strictnessSettings,
  );

  // Update strictness settings if provided
  if (msg.strictnessSettings) {
    strictnessSettings = {
      browserFocus: Boolean(msg.strictnessSettings.browserFocus),
      tabManagement: Boolean(msg.strictnessSettings.tabManagement),
      checkInMoments: Boolean(msg.strictnessSettings.checkInMoments),
    };
  }

  console.log(
    "[Background] Active strictness settings:",
    JSON.stringify(strictnessSettings),
  );
  console.log("[Background] - browserFocus:", strictnessSettings.browserFocus);
  console.log(
    "[Background] - tabManagement:",
    strictnessSettings.tabManagement,
  );
  console.log(
    "[Background] - checkInMoments:",
    strictnessSettings.checkInMoments,
  );

  // Close non-allowed tabs if tab management is enabled
  if (strictnessSettings.tabManagement) {
    console.log(
      "[Background] Tab management ENABLED - closing non-allowed tabs",
    );
    closeExistingBlockedTabs();
  } else {
    console.log("[Background] Tab management DISABLED - all tabs allowed");
  }

  broadcastSessionState();
}

function handleEndSession() {
  console.log("[Background] === SESSION ENDED ===");
  sessionActive = false;
  broadcastSessionState();
}

function handleUpdateStrictness(msg) {
  if (!msg.strictnessSettings) return;

  const oldTabManagement = strictnessSettings.tabManagement;

  strictnessSettings = {
    browserFocus: Boolean(msg.strictnessSettings.browserFocus),
    tabManagement: Boolean(msg.strictnessSettings.tabManagement),
    checkInMoments: Boolean(msg.strictnessSettings.checkInMoments),
  };

  console.log(
    "[Background] Strictness settings UPDATED:",
    JSON.stringify(strictnessSettings),
  );

  // If tab management was just enabled during active session, clean up tabs
  if (sessionActive && !oldTabManagement && strictnessSettings.tabManagement) {
    console.log(
      "[Background] Tab management just enabled - closing non-allowed tabs",
    );
    closeExistingBlockedTabs();
  }
}

function broadcastActivityConfirmed() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || tab.id === studyurenTabId) return;
      chrome.tabs
        .sendMessage(tab.id, { type: "studyuren:activity-confirmed" })
        .catch(() => {});
    });
  });
}

function broadcastCheckIn(isActive, data = {}) {
  console.log(
    "[Background] Broadcasting check-in:",
    isActive ? "START" : "END",
  );

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || tab.id === studyurenTabId) return;
      chrome.tabs
        .sendMessage(tab.id, {
          type: isActive
            ? "studyuren:check-in:start"
            : "studyuren:check-in:end",
          data,
        })
        .catch(() => {});
    });
  });
}

function broadcastSessionState() {
  console.log(
    "[Background] Broadcasting session state:",
    sessionActive ? "ACTIVE" : "INACTIVE",
  );

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || tab.id === studyurenTabId) return;
      chrome.tabs
        .sendMessage(tab.id, {
          type: sessionActive
            ? "studyuren:session:start"
            : "studyuren:session:end",
        })
        .catch(() => {});
    });
  });
}

function sendSessionState(tabId) {
  if (!tabId || tabId === studyurenTabId) return;
  chrome.tabs
    .sendMessage(tabId, {
      type: sessionActive ? "studyuren:session:start" : "studyuren:session:end",
    })
    .catch(() => {});
}

function blockSiteAndNotify(blockedTabId, blockedUrl) {
  console.log("[Background] Blocking site:", blockedUrl);

  chrome.tabs.query({}, (tabs) => {
    const studyTab = tabs.find(
      (t) =>
        t.url &&
        (t.url.includes("study.bijsven.nl") || t.url.includes("localhost")),
    );

    if (studyTab && studyTab.id) {
      chrome.windows.update(studyTab.windowId, { focused: true });
      chrome.tabs.update(studyTab.id, { active: true });
      chrome.tabs.remove(blockedTabId);

      chrome.tabs
        .sendMessage(studyTab.id, {
          type: "studyuren:website:blocked",
          data: { url: blockedUrl },
        })
        .catch(() => {});
    } else {
      sessionActive = false;
      broadcastSessionState();
      chrome.tabs.remove(blockedTabId);
    }
  });
}

function focusStudyurenTab() {
  console.log("[Background] Focusing Studyuren tab");

  chrome.tabs.query({}, (tabs) => {
    const studyTab = tabs.find(
      (t) =>
        t.url &&
        (t.url.includes("study.bijsven.nl") || t.url.includes("localhost")),
    );

    if (studyTab && studyTab.id) {
      chrome.windows.update(studyTab.windowId, { focused: true });
      chrome.tabs.update(studyTab.id, { active: true });
      console.log("[Background] Focused on tab:", studyTab.id);
    } else {
      console.log("[Background] Studyuren tab not found");
    }
  });
}

function closeExistingBlockedTabs() {
  if (!allowedSitesReady) {
    console.log("[Background] Allowed sites not ready, retrying in 1s");
    setTimeout(closeExistingBlockedTabs, 1000);
    return;
  }

  console.log("[Background] Checking all tabs for non-allowed sites...");

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.url || !tab.id) return;
      if (tab.id === studyurenTabId) return;

      try {
        const url = new URL(tab.url);
        const hostname = url.hostname;

        // Skip chrome:// and extension pages
        if (url.protocol === "chrome:" || url.protocol === "chrome-extension:")
          return;

        const isAllowed = ALLOWED_SITES.some((site) => hostname.includes(site));

        if (!isAllowed) {
          console.log(
            "[Background] Closing non-allowed tab:",
            hostname,
            tab.id,
          );

          if (studyurenTabId) {
            chrome.tabs
              .sendMessage(studyurenTabId, {
                type: "studyuren:website:blocked",
                data: { url: tab.url },
              })
              .catch(() => {});
          }
          chrome.tabs.remove(tab.id);
        }
      } catch (e) {
        console.log("[Background] Could not parse URL:", tab.url);
      }
    });
  });
}

function checkAndBlockTab(tab) {
  if (!sessionActive) return;
  if (!strictnessSettings.tabManagement) return;
  if (!allowedSitesReady) return;
  if (!tab.url || !tab.id) return;
  if (tab.id === studyurenTabId) return;

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;

    if (url.protocol === "chrome:" || url.protocol === "chrome-extension:")
      return;

    const isAllowed = ALLOWED_SITES.some((site) => hostname.includes(site));

    if (!isAllowed) {
      console.log("[Background] Blocking new non-allowed tab:", hostname);
      blockSiteAndNotify(tab.id, tab.url);
    }
  } catch (e) {
    console.log("[Background] Could not parse URL:", tab.url);
  }
}

// Monitor new tabs being created
chrome.tabs.onCreated.addListener((tab) => {
  if (!sessionActive || !strictnessSettings.tabManagement) return;

  console.log("[Background] New tab created:", tab.id);

  // Wait for URL to load
  setTimeout(() => {
    chrome.tabs.get(tab.id, (updatedTab) => {
      if (chrome.runtime.lastError) return;
      checkAndBlockTab(updatedTab);
    });
  }, 500);
});

// Monitor tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!sessionActive || !strictnessSettings.tabManagement) return;
  if (!changeInfo.url) return;

  console.log("[Background] Tab URL changed:", tabId, changeInfo.url);
  checkAndBlockTab(tab);
});

// Monitor tab being closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === studyurenTabId) {
    console.log("[Background] Studyuren tab closed - ending session");
    sessionActive = false;
    studyurenTabId = null;
    broadcastSessionState();
  }
});

// Check for browser focus every second
setInterval(async () => {
  if (!sessionActive) return;

  try {
    const windows = await chrome.windows.getAll();
    const focusedWindow = windows.find((w) => w.focused) || null;

    // Track window focus changes
    if (focusedWindow?.id !== lastFocusedWindowId) {
      console.log(
        "[Background] Window focus changed:",
        lastFocusedWindowId,
        "->",
        focusedWindow?.id,
      );
      lastFocusedWindowId = focusedWindow?.id ?? null;
    }

    // Check if Chrome lost focus (user switched to another app)
    if (!focusedWindow) {
      console.log(
        "[Background] No Chrome window focused. browserFocus setting:",
        strictnessSettings.browserFocus,
      );

      if (strictnessSettings.browserFocus) {
        console.log(
          "[Background] Browser lost focus with browserFocus ENABLED - STOPPING SESSION",
        );

        sessionActive = false;
        stoppedDueToAppSwitch = true;
        broadcastSessionState();

        // Notify all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (!tab.id) return;
            chrome.tabs
              .sendMessage(tab.id, { type: "studyuren:session:force-stop" })
              .catch(() => {});
          });
        });
      }
    }

    // Handle returning from app switch
    if (!sessionActive && stoppedDueToAppSwitch && focusedWindow) {
      console.log("[Background] Returned from app switch");
      stoppedDueToAppSwitch = false;
    }
  } catch (e) {
    console.log("[Background] Error in focus check:", e);
  }
}, 1000);

// Periodic session check
setInterval(() => {
  if (!sessionActive) return;

  chrome.tabs.query({}, (tabs) => {
    const studyTab = tabs.find(
      (t) =>
        t.url &&
        (t.url.includes("study.bijsven.nl") || t.url.includes("localhost")),
    );

    if (!studyTab) {
      console.log("[Background] Studyuren tab lost - ending session");
      sessionActive = false;
      studyurenTabId = null;
      broadcastSessionState();
    } else if (studyTab.id !== studyurenTabId) {
      console.log(
        "[Background] Studyuren tab ID updated:",
        studyurenTabId,
        "->",
        studyTab.id,
      );
      studyurenTabId = studyTab.id;
    }
  });
}, 2000);

console.log("[Background] Service worker initialized");
