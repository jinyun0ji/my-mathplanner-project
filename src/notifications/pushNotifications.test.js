import { createPushTokenRegistry } from './pushNotifications';

const canonicalUid = 'firebase-auth-uid';

describe('push token registry', () => {
  test('native success saves the FCM token under the canonical auth UID', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const registry = createPushTokenRegistry({ isNative: () => true, getNativeToken: async () => 'fcm-token', save });
    await expect(registry.register(canonicalUid)).resolves.toBe('fcm-token');
    expect(save).toHaveBeenCalledWith(canonicalUid, 'fcm-token', 'ios');
  });

  test.each(['permission denied', 'registration error', 'timeout'])(
    '%s does not save a native token',
    async () => {
      const save = jest.fn();
      const registry = createPushTokenRegistry({ isNative: () => true, getNativeToken: async () => null, save });
      await expect(registry.register(canonicalUid)).resolves.toBeNull();
      expect(save).not.toHaveBeenCalled();
    },
  );

  test('web registration continues to save a web token', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const registry = createPushTokenRegistry({ isNative: () => false, getWebToken: async () => 'web-token', save });
    await expect(registry.register(canonicalUid)).resolves.toBe('web-token');
    expect(save).toHaveBeenCalledWith(canonicalUid, 'web-token', 'web');
  });

  test('unregister deletes the same canonical UID and token path', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const registry = createPushTokenRegistry({ remove });
    await registry.unregister(canonicalUid, 'fcm-token');
    expect(remove).toHaveBeenCalledWith(canonicalUid, 'fcm-token');
  });
});
