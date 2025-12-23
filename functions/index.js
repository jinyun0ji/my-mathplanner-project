const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const fetch = require('node-fetch');

admin.initializeApp();

const app = express();
app.use(express.json());

const buildErrorResponse = (res, status, message) => res.status(status).json({ error: message });

const getKakaoConfig = () => {
    const kakao = functions.config().kakao || {};
    return {
        clientId: kakao.client_id || kakao.rest_key,
        clientSecret: kakao.client_secret,
        redirectUri: kakao.redirect_uri,
    };
};

const getNaverConfig = () => {
    const naver = functions.config().naver || {};
    return {
        clientId: naver.client_id,
        clientSecret: naver.client_secret,
        redirectUri: naver.redirect_uri,
        state: naver.state,
    };
};

app.post('/auth/kakao', async (req, res) => {
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

app.post('/auth/naver', async (req, res) => {
    const { code, state } = req.body || {};
    if (!code) return buildErrorResponse(res, 400, 'Missing authorization code');

    const naverConfig = getNaverConfig();
    if (!naverConfig.clientId || !naverConfig.clientSecret || !naverConfig.redirectUri) {
        return buildErrorResponse(res, 500, 'Naver OAuth configuration is missing');
    }

    try {
        const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: naverConfig.clientId,
                client_secret: naverConfig.clientSecret,
                redirect_uri: naverConfig.redirectUri,
                code,
                state: state || naverConfig.state,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            return buildErrorResponse(res, 400, `Failed to exchange Naver token: ${errorBody}`);
        }

        const tokenPayload = await tokenResponse.json();
        const accessToken = tokenPayload.access_token;
        if (!accessToken) return buildErrorResponse(res, 400, 'Naver access token missing');

        const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResponse.ok) {
            const errorBody = await userResponse.text();
            return buildErrorResponse(res, 400, `Failed to fetch Naver user: ${errorBody}`);
        }

        const userPayload = await userResponse.json();
        const naverUserId = userPayload?.response?.id;
        if (!naverUserId) return buildErrorResponse(res, 400, 'Naver user id missing');

        const uid = `naver:${naverUserId}`;
        const customToken = await admin.auth().createCustomToken(uid);
        return res.json({ token: customToken });
    } catch (error) {
        console.error('Naver auth error', error);
        return buildErrorResponse(res, 500, 'Internal error during Naver auth');
    }
});

exports.api = functions.https.onRequest(app);