// src/components/StudentMessenger.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../utils/helpers';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';

export default function StudentMessenger({ 
    studentId, 
    teacherName = "채수용T",
    messages = [], 
    onSendMessage,
    onOpenChat,
    isHidden = false,
    bottomPosition = "bottom-24",
    isFloating = true // ✅ [추가] true면 기존처럼 고정, false면 부모 요소의 정렬을 따름
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [activeChannel, setActiveChannel] = useState('teacher-room');
    const messagesEndRef = useRef(null);
    const lastOpenedChannelRef = useRef(null);

    const currentMessages = messages.filter(msg => msg.roomId === activeChannel);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen, activeChannel]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSendMessage(inputText, activeChannel);
        setInputText('');
    };

    const toggleMessenger = () => setIsOpen(!isOpen);

    useEffect(() => {
        if (!isOpen) {
            lastOpenedChannelRef.current = null;
            return;
        }

        if (onOpenChat && lastOpenedChannelRef.current !== activeChannel) {
            lastOpenedChannelRef.current = activeChannel;
            onOpenChat(activeChannel);
        }
    }, [isOpen, activeChannel, onOpenChat]);

    const resolveDisplayName = (msg) => {
        if (msg.senderRole === 'staff') {
            return '채수용 연구소';
        }
        if (msg.displayName) {
            return msg.displayName;
        }
        if (msg.senderRole === 'teacher') {
            return teacherName;
        }
        return '';
    };

    // ✅ [추가] 날짜 포맷팅 함수 (YYYY년 M월 D일 요일)
    const formatDateDivider = (dateString) => {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return date.toLocaleDateString('ko-KR', options);
    };

    return (
        <>
            {/* ✅ [수정] isFloating 값에 따라 position 클래스 적용 여부 결정
               - isFloating이 false면 fixed 위치 값들을 제거하여 부모 컨테이너(flex)의 정렬을 따르게 함
            */}
            <div className={`${isFloating ? `fixed ${bottomPosition} right-5` : ''} z-[60] transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isHidden ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
                {!isOpen && (
                    <button 
                        onClick={toggleMessenger}
                        className="bg-brand-main hover:bg-brand-dark text-white w-12 h-12 rounded-full shadow-brand transition-transform active:scale-90 flex items-center justify-center"
                    >
                        <Icon name="messageSquare" className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* 패널 */}
            <div className={`fixed inset-0 z-[70] overflow-hidden pointer-events-none`}>
                <div 
                    className={`absolute inset-0 bg-black/40 transition-opacity duration-700 ease-in-out pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                    onClick={toggleMessenger}
                />

                <div 
                    className={`absolute top-0 right-0 h-full w-full md:w-96 max-w-full bg-brand-bg shadow-2xl pointer-events-auto flex flex-col 
                    transform transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    {/* 헤더 */}
                    <div className="bg-white pt-4 pb-0 flex flex-col border-b border-brand-gray/30 shadow-sm shrink-0">
                        <div className="px-4 flex justify-between items-center mb-3">
                            <h3 className="font-bold text-brand-black text-lg">메시지</h3>
                            <button onClick={toggleMessenger} className="p-2 text-brand-gray hover:text-brand-dark rounded-full hover:bg-brand-bg">
                                <Icon name="x" className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex px-4 gap-4">
                            <button 
                                onClick={() => setActiveChannel('teacher-room')}
                                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                    activeChannel === 'teacher-room' ? 'text-brand-main border-brand-main' : 'text-brand-gray border-transparent hover:text-brand-black'
                                }`}
                            >
                                <SchoolIcon style={{ fontSize: 18 }} /> 채수용T
                            </button>
                            <button 
                                onClick={() => setActiveChannel('staff-room')}
                                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                                    activeChannel === 'staff-room' ? 'text-brand-main border-brand-main' : 'text-brand-gray border-transparent hover:text-brand-black'
                                }`}
                            >
                                <ScienceIcon style={{ fontSize: 18 }} /> 채수용 연구소
                            </button>
                        </div>
                    </div>

                    {/* 메시지 리스트 */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-bg custom-scrollbar">
                        <div className="text-center py-4">
                            <p className="text-xs text-brand-gray bg-white/50 inline-block px-3 py-1 rounded-full shadow-sm">
                                {activeChannel === 'teacher-room' ? teacherName : '채수용 연구소'}와의 대화입니다.
                            </p>
                        </div>

                        {currentMessages.length > 0 ? (
                            currentMessages.map((msg, index) => {
                                // ✅ 날짜 구분선 로직
                                const showDateDivider = index === 0 || currentMessages[index - 1].date !== msg.date;
                                
                                return (
                                    <React.Fragment key={msg.id}>
                                        {/* 날짜 구분선 렌더링 */}
                                        {showDateDivider && (
                                            <div className="flex justify-center my-4">
                                                <span className="text-[10px] font-bold text-brand-gray/70 bg-brand-gray/10 px-3 py-1 rounded-full">
                                                    {formatDateDivider(msg.date)}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!msg.isMe && (
                                                <div className="mr-2 shrink-0 mt-1 flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-brand-light/30 flex items-center justify-center text-brand-dark font-bold text-xs">
                                                        {resolveDisplayName(msg)?.[0] || '•'}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex flex-col max-w-[75%]">
                                                {!msg.isMe && (
                                                    <span className="text-[10px] text-brand-gray mb-1 ml-1">
                                                        {resolveDisplayName(msg)}
                                                    </span>
                                                )}
                                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
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
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <div className="text-center py-10 text-brand-gray text-xs">
                                <p>궁금한 점이 있다면<br/>언제든 물어보세요! 👋</p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-brand-gray/30 flex gap-2 shrink-0 pb-6 md:pb-3">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={activeChannel === 'teacher-room' ? "채수용T께 메시지 보내기..." : "연구소에 문의하기..."}
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