// src/layout/MessengerPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../utils/helpers';

export default function MessengerPanel({ isMessengerOpen, toggleMessenger, hasNewMessages, setHasNewMessages }) {
    // 채팅 메시지 Mock Data
    const [messages, setMessages] = useState([
        { id: 1, sender: '김원장', text: '오늘 오후 3시 전체 회의 잊지 마세요.', time: '10:30', isMe: false },
        { id: 2, sender: '나', text: '네, 자료 준비해서 참석하겠습니다.', time: '10:32', isMe: true },
        { id: 3, sender: '이실장', text: '회의실 예약해뒀습니다.', time: '10:45', isMe: false },
    ]);
    const [inputText, setInputText] = useState('');
    
    // 스크롤 자동 이동을 위한 Ref
    const messagesEndRef = useRef(null);

    // 메시지 추가되거나 패널 열릴 때 스크롤 하단으로 이동
    useEffect(() => {
        if (isMessengerOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isMessengerOpen]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        
        const newMsg = {
            id: Date.now(),
            sender: '나',
            text: inputText,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            isMe: true
        };
        
        setMessages([...messages, newMsg]);
        setInputText('');
    };

    // 패널 열림/닫힘 클래스
    const panelClass = isMessengerOpen ? 'translate-x-0' : 'translate-x-full';

    return (
        <>
            {/* 1. 메신저 토글 버튼 (알림 버튼 위에 위치: bottom-24) */}
            {!isMessengerOpen && (
                <div 
                    onClick={() => { toggleMessenger(); setHasNewMessages(false); }}
                    className="fixed bottom-24 right-6 cursor-pointer p-3 rounded-full text-white transition-all duration-300 ease-in-out bg-indigo-500 hover:bg-indigo-600 shadow-xl z-50 flex items-center justify-center"
                    title="메신저 열기"
                >
                    <div className="relative">
                        <Icon name="messageSquare" className="w-6 h-6 text-white"/>
                        
                        {/* 새 메시지 배지 */}
                        {hasNewMessages && (
                            <>
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1 animate-ping"></span>
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1"></span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 2. 메신저 패널 (우측 슬라이딩) */}
            <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col ${panelClass}`}>
                
                {/* 헤더 */}
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md">
                    <h3 className="font-bold flex items-center text-lg">
                        <Icon name="messageSquare" className="w-5 h-5 mr-2"/>
                        교직원 메신저
                    </h3>
                    <button onClick={toggleMessenger} className="hover:bg-indigo-700 p-1 rounded-full transition-colors">
                        <Icon name="x" className="w-6 h-6 text-white"/>
                    </button>
                </div>

                {/* 메시지 리스트 영역 */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                            {!msg.isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender}</span>}
                            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                                msg.isMe 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                            }`}>
                                {msg.text}
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 mx-1">{msg.time}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* 메시지 입력창 영역 */}
                <form onSubmit={handleSendMessage} className="p-3 border-t bg-white flex items-center space-x-2">
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button 
                        type="submit" 
                        disabled={!inputText.trim()}
                        className={`p-2 rounded-full transition-colors ${inputText.trim() ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                        <Icon name="send" className="w-5 h-5"/>
                    </button>
                </form>
            </div>
        </>
    );
};