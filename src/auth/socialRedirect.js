const stateKey = (provider) => `oauth_state_${provider}`;

const getBrowserWindow = () => (typeof window !== 'undefined' ? window : null);

const getConfig = (provider) => {
    const win = getBrowserWindow();
    const globalConfig = win?.__social_config?.[provider] || {};

    if (provider === 'kakao') {
        return {
            clientId: globalConfig.client_id || process.env.REACT_APP_KAKAO_CLIENT_ID,
            redirectUri: globalConfig.redirect_uri || process.env.REACT_APP_KAKAO_REDIRECT_URI,
        };
    }

    if (provider === 'naver') {
        return {
            clientId: globalConfig.client_id || process.env.REACT_APP_NAVER_CLIENT_ID,
            redirectUri: globalConfig.redirect_uri || process.env.REACT_APP_NAVER_REDIRECT_URI,
            state: globalConfig.state || process.env.REACT_APP_NAVER_STATE,
        };
    }

    return {};
};

const buildRedirectUri = (rawRedirectUri, provider) => {
    const win = getBrowserWindow();
    try {
        const url = new URL(rawRedirectUri, win?.location?.origin || undefined);
        if (!url.searchParams.get('provider')) {
            url.searchParams.set('provider', provider);
        }
        return url.toString();
    } catch (error) {
        throw new Error(`${provider} OAuth 리디렉션 URL이 유효하지 않습니다.`);
    }
};

const generateState = () => {
    const random = Math.random().toString(36).substring(2, 12);
    const timestamp = Date.now().toString(36);
    return `${random}_${timestamp}`;
};

export const redirectToKakao = () => {
    const config = getConfig('kakao');
    if (!config.clientId || !config.redirectUri) {
        throw new Error('Kakao OAuth 설정이 누락되었습니다.');
    }

    const redirectUri = buildRedirectUri(config.redirectUri, 'kakao');
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');

    const win = getBrowserWindow();
    win.location.assign(url.toString());
};

export const redirectToNaver = () => {
    const config = getConfig('naver');
    if (!config.clientId || !config.redirectUri) {
        throw new Error('Naver OAuth 설정이 누락되었습니다.');
    }

    const redirectUri = buildRedirectUri(config.redirectUri, 'naver');
    const url = new URL('https://nid.naver.com/oauth2.0/authorize');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');

    const state = config.state || generateState();
    if (state) {
        url.searchParams.set('state', state);
        const win = getBrowserWindow();
        try {
            win.sessionStorage.setItem(stateKey('naver'), state);
        } catch (error) {
            console.warn('Failed to persist Naver state', error);
        }
    }

    const win = getBrowserWindow();
    win.location.assign(url.toString());
};

export const clearStoredState = (provider) => {
    const win = getBrowserWindow();
    try {
        win.sessionStorage.removeItem(stateKey(provider));
    } catch (error) {
        // ignore
    }
};

export const getStoredState = (provider) => {
    const win = getBrowserWindow();
    try {
        return win.sessionStorage.getItem(stateKey(provider));
    } catch (error) {
        return null;
    }
};