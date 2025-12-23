const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const buildErrorResponse = (res, status, message) => res.status(status).json({ error: message });

const getKakaoConfig = () => {
    const kakao = functions.config().kakao || {};
    return {
        clientId: kakao.client_id || kakao.rest_key,
        clientSecret: kakao.client_secret,
        redirectUri: kakao.redirect_uri,
    };
};

exports.kakaoLogin = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { code } = req.body || {};
    if (!code) return buildErrorResponse(res, 400, 'Missing authorization code');

    const kakaoConfig = getKakaoConfig();
    if (!kakaoConfig.clientId || !kakaoConfig.redirectUri) {
        return buildErrorResponse(res, 500, 'Kakao OAuth configuration is missing');
    }

    try {
        const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: kakaoConfig.clientId,
                redirect_uri: kakaoConfig.redirectUri,
                code,
                client_secret: kakaoConfig.clientSecret,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            return buildErrorResponse(res, 400, `Failed to exchange Kakao token: ${errorBody}`);
        }

        const tokenPayload = await tokenResponse.json();
        const accessToken = tokenPayload.access_token;
        if (!accessToken) return buildErrorResponse(res, 400, 'Kakao access token missing');

        const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResponse.ok) {
            const errorBody = await userResponse.text();
            return buildErrorResponse(res, 400, `Failed to fetch Kakao user: ${errorBody}`);
        }

        const userPayload = await userResponse.json();
        const kakaoUserId = userPayload?.id;
        if (!kakaoUserId) return buildErrorResponse(res, 400, 'Kakao user id missing');

        const uid = `kakao:${kakaoUserId}`;
        const customToken = await admin.auth().createCustomToken(uid);
        return res.json({ token: customToken });
    } catch (error) {
        console.error('Kakao auth error', error);
        return buildErrorResponse(res, 500, 'Internal error during Kakao auth');
    }
});