(function autoplayGuardPageHook() {
  if (window.__autoplayGuardInstalled) {
    return;
  }

  window.__autoplayGuardInstalled = true;

  const state = {
    blocked: false,
    hasUserInteracted: false
  };

  const originalPlay = HTMLMediaElement.prototype.play;

  window.addEventListener("autoplay-guard:update", (event) => {
    state.blocked = Boolean(event.detail?.blocked);
    state.hasUserInteracted = Boolean(event.detail?.hasUserInteracted);
  });

  HTMLMediaElement.prototype.play = function autoplayGuardPlay(...args) {
    if (state.blocked && !state.hasUserInteracted) {
      return Promise.reject(createNotAllowedError());
    }

    return originalPlay.apply(this, args);
  };

  function createNotAllowedError() {
    try {
      return new DOMException(
        "Autoplay Guard blocked playback before user interaction.",
        "NotAllowedError"
      );
    } catch (error) {
      const fallback = new Error("Autoplay Guard blocked playback before user interaction.");
      fallback.name = "NotAllowedError";
      return fallback;
    }
  }
})();
