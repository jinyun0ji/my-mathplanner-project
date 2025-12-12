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
            {!isOpen && (
                // 버튼 색상: Brand Main (#475FE9)
                <button 
                    onClick={toggleMessenger}
                    className="fixed bottom-24 right-5 z-50 bg-brand-main hover:bg-brand-dark text-white p-3.5 rounded-full shadow-brand transition-transform active:scale-90 flex items-center justify-center"
                >
                    <Icon name="messageSquare" className="w-6 h-6" />
                </button>
            )}

            <div className={`fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="absolute inset-0 bg-black/30 md:bg-transparent" onClick={toggleMessenger}></div>

                <div className="absolute bottom-0 right-0 w-full md:w-96 h-[80vh] md:h-[600px] md:bottom-24 md:right-5 bg-brand-bg md:rounded-2xl shadow-2xl flex flex-col overflow-hidden rounded-t-2xl" onClick={e => e.stopPropagation()}>
                    
                    <div className="bg-white px-4 py-3 flex justify-between items-center border-b border-brand-gray/30 shadow-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-light/30 flex items-center justify-center text-brand-dark font-bold">
                                {teacherName[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-brand-black text-sm">{teacherName}</h3>
                                <p className="text-xs text-green-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    답변 가능
                                </p>
                            </div>
                        </div>
                        <button onClick={toggleMessenger} className="p-2 text-brand-gray hover:text-brand-dark rounded-full hover:bg-brand-bg">
                            <Icon name="x" className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-bg">
                        {messages.length > 0 ? (
                            messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                    {!msg.isMe && (
                                        <div className="w-8 h-8 rounded-full bg-brand-light/30 flex items-center justify-center text-[10px] text-brand-dark font-bold mr-2 shrink-0 mt-1">
                                            {msg.sender[0]}
                                        </div>
                                    )}
                                    {/* 내 메시지: Brand Main (#475FE9) / 상대 메시지: White */}
                                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        msg.isMe 
                                        ? 'bg-brand-main text-white rounded-tr-none' 
                                        : 'bg-white text-brand-black rounded-tl-none border border-brand-gray/30'
                                    }`}>
                                        {msg.text}
                                        <p className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-white/70' : 'text-brand-gray'}`}>
                                            {msg.time}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-brand-gray text-xs">
                                <p>궁금한 점이 있다면<br/>언제든 선생님께 물어보세요! 👋</p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-brand-gray/30 flex gap-2 shrink-0 pb-6 md:pb-3">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="메시지를 입력하세요..."
                            className="flex-1 bg-brand-bg rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main transition-all"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()}
                            className={`p-2.5 rounded-full transition-colors shrink-0 ${
                                inputText.trim() 
                                ? 'bg-brand-main text-white shadow-brand hover:bg-brand-dark' 
                                : 'bg-brand-gray/50 text-white'
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