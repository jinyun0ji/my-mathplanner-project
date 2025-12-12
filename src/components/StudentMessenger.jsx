// src/components/StudentMessenger.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../utils/helpers';

export default function StudentMessenger({ 
    studentId, 
    teacherName = "채수용 선생님", 
    messages = [], 
    onSendMessage 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef(null);

    // 메시지 스크롤 하단 고정
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        
        onSendMessage(inputText);
        setInputText('');
    };

    const toggleMessenger = () => setIsOpen(!isOpen);

    return (
        <>
            {/* 1. 플로팅 버튼 (메신저 열기) */}
            {!isOpen && (
                <button 
                    onClick={toggleMessenger}
                    className="fixed bottom-24 right-5 z-50 bg-yellow-400 hover:bg-yellow-500 text-white p-3.5 rounded-full shadow-lg transition-transform active:scale-90 flex items-center justify-center"
                >
                    <Icon name="messageSquare" className="w-6 h-6" />
                    {/* 안 읽은 메시지 배지 예시 (필요시 로직 추가) */}
                    {/* <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span> */}
                </button>
            )}

            {/* 2. 대화창 패널 (모바일 전체화면 느낌 or 슬라이드 패널) */}
            <div className={`fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                {/* 배경 클릭 시 닫기 (PC 버전 고려) */}
                <div className="absolute inset-0 bg-black/30 md:bg-transparent" onClick={toggleMessenger}></div>

                {/* 실제 메신저 UI */}
                <div className="absolute bottom-0 right-0 w-full md:w-96 h-[80vh] md:h-[600px] md:bottom-24 md:right-5 bg-gray-50 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden rounded-t-2xl" onClick={e => e.stopPropagation()}>
                    
                    {/* 헤더 */}
                    <div className="bg-white px-4 py-3 flex justify-between items-center border-b border-gray-100 shadow-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {teacherName[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm">{teacherName}</h3>
                                <p className="text-xs text-green-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    답변 가능
                                </p>
                            </div>
                        </div>
                        <button onClick={toggleMessenger} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                            <Icon name="x" className="w-6 h-6" />
                        </button>
                    </div>

                    {/* 메시지 리스트 */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5]">
                        {messages.length > 0 ? (
                            messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                    {!msg.isMe && (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] text-indigo-600 font-bold mr-2 shrink-0 mt-1">
                                            {msg.sender[0]}
                                        </div>
                                    )}
                                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        msg.isMe 
                                        ? 'bg-yellow-400 text-gray-900 rounded-tr-none' 
                                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                                    }`}>
                                        {msg.text}
                                        <p className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-yellow-800/60' : 'text-gray-400'}`}>
                                            {msg.time}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400 text-xs">
                                <p>궁금한 점이 있다면<br/>언제든 선생님께 물어보세요! 👋</p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 입력창 */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0 pb-6 md:pb-3">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()}
                            className={`p-2.5 rounded-full transition-colors shrink-0 ${
                                inputText.trim() 
                                ? 'bg-yellow-400 text-white shadow-md hover:bg-yellow-500' 
                                : 'bg-gray-200 text-gray-400'
                            }`}
                        >
                            <Icon name="send" className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}