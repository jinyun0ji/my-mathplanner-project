import { useEffect, useState } from 'react';
import { subscribeRoomMessages } from '../services/messageService';

export const useRoomMessages = (roomId) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!roomId) return undefined;
        setLoading(true);
        let fallbackUnsub = null;
        const handleNext = (snap) => {
            setMessages(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
            setLoading(false);
            setError('');
        };
        const unsub = subscribeRoomMessages({
            roomId,
            onNext: handleNext,
            onError: (err) => {
                fallbackUnsub = subscribeRoomMessages({ roomId, onNext: handleNext, onError: () => setError('메시지를 불러오지 못했습니다.'), withOrderBy: false });
            },
        });
        return () => { unsub && unsub(); fallbackUnsub && fallbackUnsub(); };
    }, [roomId]);
    return { messages, loading, error };
};
