const getCapacitorBridge = () => window.Capacitor;

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

  const { App, Keyboard, SplashScreen, StatusBar } = capacitor.Plugins ?? {};

  callPluginMethod(StatusBar, 'setStyle', { style: 'DEFAULT' });
  callPluginMethod(SplashScreen, 'hide');
  callPluginMethod(Keyboard, 'setResizeMode', { mode: 'body' });

  App?.addListener?.('resume', () => {
    window.dispatchEvent(new Event('capacitor:resume'));
  });
}