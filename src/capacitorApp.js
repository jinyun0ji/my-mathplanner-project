const getCapacitorBridge = () => window.Capacitor;

const isDevelopment = process.env.NODE_ENV === 'development';

const setKeyboardHeight = (height = 0) => {
  document.documentElement.style.setProperty('--app-keyboard-height', `${Math.max(0, Number(height) || 0)}px`);
};

const syncVisualViewportHeight = () => {
  const height = window.visualViewport?.height || window.innerHeight;
  if (height) {
    document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
  }
};

const callPluginMethod = async (plugin, method, options) => {
  try {
    if (plugin?.[method]) {
      await plugin[method](options);
    }
  } catch (error) {
    // Native plugin calls are best-effort during bootstrap and should not
    // affect the existing web application flow.
  }
};

export function setupCapacitorApp() {
  const capacitor = getCapacitorBridge();

  if (!capacitor?.isNativePlatform?.()) {
    return;
  }

  document.documentElement.classList.add('capacitor-native');
  document.body?.classList.add('capacitor-native');
  setKeyboardHeight(0);
  syncVisualViewportHeight();
  window.visualViewport?.addEventListener?.('resize', syncVisualViewportHeight);
  window.visualViewport?.addEventListener?.('scroll', syncVisualViewportHeight);
  window.addEventListener('resize', syncVisualViewportHeight);

  if (isDevelopment) {
    console.log('[capacitor] native class applied');
    requestAnimationFrame(() => {
      const safeTopValue = getComputedStyle(document.documentElement).getPropertyValue('--app-safe-top').trim();
      console.log('[capacitor] safeTop value', safeTopValue || '0px');
    });
  }

  const { App, Keyboard, SplashScreen, StatusBar } = capacitor.Plugins ?? {};

  if (capacitor.getPlatform?.() === 'ios') {
    callPluginMethod(StatusBar, 'setOverlaysWebView', { overlay: false });
    callPluginMethod(StatusBar, 'setStyle', { style: 'DEFAULT' });
  }
  callPluginMethod(SplashScreen, 'hide');
  callPluginMethod(Keyboard, 'setResizeMode', { mode: 'body' });
  const handleKeyboardShow = (event) => {
    setKeyboardHeight(event?.keyboardHeight || 0);
    syncVisualViewportHeight();
  };
  const handleKeyboardHide = () => {
    setKeyboardHeight(0);
    syncVisualViewportHeight();
  };
  Keyboard?.addListener?.('keyboardWillShow', handleKeyboardShow);
  Keyboard?.addListener?.('keyboardDidShow', handleKeyboardShow);
  Keyboard?.addListener?.('keyboardWillHide', handleKeyboardHide);
  Keyboard?.addListener?.('keyboardDidHide', handleKeyboardHide);

  App?.addListener?.('resume', () => {
    window.dispatchEvent(new Event('capacitor:resume'));
  });
}