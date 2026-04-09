const SETTINGS_FALLBACK = {
  blockedDomains: []
};

let isBlockedDomain = false;
let hasUserInteracted = false;
let pageHookInjected = false;

const hostname = normalizeDomain(window.location.hostname);

injectPageHook();
trackUserIntent();
observeStorageChanges();

initialize().catch(() => {
  applySettings(SETTINGS_FALLBACK);
  prepareExistingMediaElements();
  observeMutations();
});

async function initialize() {
  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  applySettings(settings);
  prepareExistingMediaElements();
  observeMutations();
}

function applySettings(settings) {
  const blockedDomains = Array.isArray(settings?.blockedDomains)
    ? settings.blockedDomains.map(normalizeDomain).filter(Boolean)
    : SETTINGS_FALLBACK.blockedDomains;

  isBlockedDomain = hostnameMatchesDomainList(hostname, blockedDomains);
  syncPageHookState();
}

function trackUserIntent() {
  const markUserIntent = () => {
    if (hasUserInteracted) {
      return;
    }

    hasUserInteracted = true;
    syncPageHookState();
  };

  document.addEventListener("pointerdown", markUserIntent, true);
  document.addEventListener("keydown", markUserIntent, true);
  document.addEventListener("touchstart", markUserIntent, true);
}

function observeStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.blockedDomains) {
      return;
    }

    applySettings({ blockedDomains: changes.blockedDomains.newValue || [] });

    if (isBlockedDomain) {
      prepareExistingMediaElements();
    }
  });
}

function observeMutations() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        collectMediaElements(node).forEach(prepareMediaElement);
      }
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });
}

function prepareExistingMediaElements() {
  document.querySelectorAll("video, audio").forEach(prepareMediaElement);
}

function collectMediaElements(node) {
  if (!(node instanceof Element)) {
    return [];
  }

  if (node.matches("video, audio")) {
    return [node];
  }

  return Array.from(node.querySelectorAll("video, audio"));
}

function prepareMediaElement(element) {
  if (!(element instanceof HTMLMediaElement)) {
    return;
  }

  element.autoplay = false;
  element.removeAttribute("autoplay");
}

function hostnameMatchesDomainList(currentHostname, domains) {
  return domains.some((domain) => {
    return currentHostname === domain || currentHostname.endsWith(`.${domain}`);
  });
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}

function injectPageHook() {
  if (pageHookInjected) {
    return;
  }

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-hook.js");
  script.dataset.autoplayGuard = "page-hook";
  script.onload = () => {
    syncPageHookState();
    script.remove();
  };

  (document.documentElement || document.head || document).appendChild(script);
  pageHookInjected = true;
}

function syncPageHookState() {
  window.dispatchEvent(
    new CustomEvent("autoplay-guard:update", {
      detail: {
        blocked: isBlockedDomain,
        hasUserInteracted
      }
    })
  );
}
