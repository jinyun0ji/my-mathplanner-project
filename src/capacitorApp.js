const getCapacitorBridge = () => window.Capacitor;

const isDevelopment = process.env.NODE_ENV === 'development';

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

  App?.addListener?.('resume', () => {
    window.dispatchEvent(new Event('capacitor:resume'));
  });
}