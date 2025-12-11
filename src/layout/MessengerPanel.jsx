// src/layout/MessengerPanel.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon, staffMembers } from '../utils/helpers';

// Mock Chat Data (학생, 학부모 포함)
const initialChatMessages = {
    'chat-staff-1': [
        { id: 1, sender: '김원장', text: '지난번 회의록 정리되었나요?', date: '2024-05-18', time: '14:20', isMe: false },
        { id: 2, sender: '나', text: '네, 거의 다 됐습니다.', date: '2024-05-18', time: '14:22', isMe: true },
    ],
    'chat-staff-2': [
        { id: 1, sender: '이실장', text: '이번 달 결제 내역 확인 부탁드립니다.', date: '2024-12-05', time: '09:00', isMe: false },
    ],
    'chat-student-1': [ // 학생 채팅 (김철수)
        { id: 1, sender: '김철수', text: '선생님, 오늘 클리닉 늦을 것 같아요 ㅠㅠ', date: '2024-12-05', time: '13:50', isMe: false },
        { id: 2, sender: '나', text: '알겠어. 몇 시쯤 도착하니?', date: '2024-12-05', time: '13:52', isMe: true },
    ],
    'chat-parent-1': [ // 학부모 채팅 (김철수 학부모)
        { id: 1, sender: '김철수 학부모', text: '선생님, 우리 철수 숙제는 잘 해가고 있나요?', date: '2024-12-01', time: '10:00', isMe: false },
        { id: 2, sender: '나', text: '네 어머니, 요즘 열심히 하고 있습니다.', date: '2024-12-01', time: '10:10', isMe: true },
    ],
};

const initialChatRooms = [
    { id: 'chat-student-1', contactId: 'student-1', name: '김철수 (학생)', lastMessage: '선생님, 오늘 클리닉 늦을 것 같아요 ㅠㅠ', time: '13:50', unread: 1 },
    { id: 'chat-parent-1', contactId: 'parent-1', name: '김철수 학부모', lastMessage: '네 알겠습니다.', time: '어제', unread: 0 },
    { id: 'chat-staff-1', contactId: 'staff-1', name: '김원장', lastMessage: '회의록 확인했습니다.', time: '10/25', unread: 0 },
];

// 토글 컴포넌트
const Accordion = ({ title, children, isOpen, toggleOpen, count, bgColor }) => (
    <div className="border-b border-gray-100">
        <button 
            onClick={toggleOpen}
            className={`flex justify-between items-center w-full px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors ${bgColor}`}
        >
            <span className="flex items-center">
                <Icon name={isOpen ? "chevronDown" : "chevronRight"} className="w-4 h-4 mr-2"/>
                {title}
            </span>
            <span className="text-xs font-normal text-gray-500">({count})</span>
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            {children}
        </div>
    </div>
);


export default function MessengerPanel({ isMessengerOpen, toggleMessenger, hasNewMessages, setHasNewMessages, isSidebarOpen, students, classes }) {
    const [activeTab, setActiveTab] = useState('contacts');
    const [selectedChatId, setSelectedChatId] = useState(null);
    const [allMessages, setAllMessages] = useState(initialChatMessages);
    const [chatRooms, setChatRooms] = useState(initialChatRooms);
    const [inputText, setInputText] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); 
    
    const [openCategories, setOpenCategories] = useState({
        staff: true,
        student: false,
        parent: false,
    });
    
    const messagesEndRef = useRef(null);
    const currentMessages = allMessages[selectedChatId] || [];

    // ✅ [수정] 실제 클래스명을 조회하는 로직
    const getClassNames = useCallback((classIds) => {
        if (!classIds || !Array.isArray(classIds) || !classes) return '클래스 없음';
        
        const names = classIds.map(id => {
            const cls = classes.find(c => c.id === id);
            return cls ? cls.name : null;
        }).filter(Boolean);

        if (names.length === 0) return '클래스 없음';
        return names.join(', ');
    }, [classes]);

    // 연락처 목록 생성 (직원, 학생, 학부모) - 상세 정보 포함
    const contactGroups = useMemo(() => {
        // 1. 직원
        const staffContacts = staffMembers.map(s => ({ 
            ...s, 
            type: 'staff',
            info1: s.role,
            info2: s.phone ? `T: ****${s.phone.slice(-4)}` : '전화번호 없음',
            searchField: `${s.name} ${s.role} ${s.phone}`
        }));
        
        // 2. 학생
        const studentContacts = students.map(s => ({
            id: `student-${s.id}`,
            originalId: s.id,
            name: s.name,
            role: '학생',
            type: 'student',
            info1: s.school || '학교 미등록', 
            // ✅ 실제 클래스명 함수 호출
            info2: `${getClassNames(s.classes)} | T: ****${s.phone ? s.phone.slice(-4) : '없음'}`,
            searchField: `${s.name} ${s.school} ${s.phone}`
        }));

        // 3. 학부모
        const parentContacts = students.map(s => ({
            id: `parent-${s.id}`,
            originalId: s.id,
            name: `${s.name} 학부모`,
            role: '학부모',
            type: 'parent',
            info1: `자녀: ${s.name} (${s.school || '학교 미등록'})`,
            // ✅ 실제 클래스명 함수 호출
            info2: `${getClassNames(s.classes)} | T: ****${s.parentPhone ? s.parentPhone.slice(-4) : '없음'}`,
            searchField: `${s.name} 학부모 ${s.school} ${s.parentPhone}`
        }));

        return {
            staff: staffContacts,
            student: studentContacts,
            parent: parentContacts
        };
    }, [students, getClassNames]);

    // 검색 필터링
    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contactGroups;

        const lowerCaseSearch = searchTerm.toLowerCase();
        
        const filter = (contacts) => 
            contacts.filter(contact => 
                contact.searchField && contact.searchField.toLowerCase().includes(lowerCaseSearch)
            );

        return {
            staff: filter(contactGroups.staff),
            student: filter(contactGroups.student),
            parent: filter(contactGroups.parent),
        };
    }, [contactGroups, searchTerm]);


    useEffect(() => {
        if (isMessengerOpen && selectedChatId) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [currentMessages, isMessengerOpen, selectedChatId]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedChatId) return;
        
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0]; 
        const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        
        const newMsg = {
            id: Date.now(),
            sender: '나',
            text: inputText,
            date: todayDate,
            time: timeString,
            isMe: true,
        };
        
        setAllMessages(prev => ({
            ...prev,
            [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
        }));
        
        setChatRooms(prev => {
            const existingRoom = prev.find(r => r.id === selectedChatId);
            if (existingRoom) {
                return prev.map(room => 
                    room.id === selectedChatId 
                        ? { ...room, lastMessage: newMsg.text, time: timeString }
                        : room
                );
            }
            return prev;
        });

        setInputText('');
    };

    const formatDateSeparator = (dateString) => {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return date.toLocaleDateString('ko-KR', options);
    };

    const renderMessages = () => {
        let lastDate = null;
        return currentMessages.map((msg) => {
            const showDateSeparator = msg.date !== lastDate;
            lastDate = msg.date;

            return (
                <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                        <div className="flex justify-center my-4">
                            <span className="bg-gray-200 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm">
                                {formatDateSeparator(msg.date)}
                            </span>
                        </div>
                    )}
                    <div className={`flex flex-col mb-3 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                        {!msg.isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender}</span>}
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm shadow-sm whitespace-pre-wrap ${
                            msg.isMe 
                            ? 'bg-yellow-400 text-gray-900 rounded-br-none' 
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 mx-1">{msg.time}</span>
                    </div>
                </React.Fragment>
            );
        });
    };

    const panelClass = isMessengerOpen ? 'translate-x-0' : 'translate-x-full';

    const currentChatName = selectedChatId 
        ? (chatRooms.find(c => c.id === selectedChatId)?.name || '채팅') 
        : '';

    const openChat = (roomOrContactId, name, isContact = false) => {
        let roomId;
        let roomExists = chatRooms.find(r => r.id === roomOrContactId);

        if (isContact) {
            roomId = `chat-${roomOrContactId}`;
            roomExists = chatRooms.find(r => r.id === roomId); 
            
            if (!roomExists) {
                const newRoom = { 
                    id: roomId, 
                    contactId: roomOrContactId, 
                    name: name, 
                    lastMessage: '대화를 시작해보세요.', 
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), 
                    unread: 0 
                };
                setChatRooms(prev => [newRoom, ...prev]);
                setAllMessages(prev => ({ ...prev, [roomId]: [] }));
            }
        } else {
            roomId = roomOrContactId; 
        }

        setSelectedChatId(roomId);
        
        setChatRooms(prev => prev.map(room => 
            room.id === roomId ? { ...room, unread: 0 } : room
        ));

        setHasNewMessages(false);
    }
    
    const handleBackToList = () => {
        setSelectedChatId(null);
    }

    const toggleCategory = (category) => {
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
    }

    const renderContactList = (contacts, name, categoryKey, bgColor) => (
        <Accordion
            title={name}
            isOpen={openCategories[categoryKey]}
            toggleOpen={() => toggleCategory(categoryKey)}
            count={contacts.length}
            bgColor={bgColor}
        >
            <ul className="bg-white">
                {contacts.map(contact => (
                    <li 
                        key={contact.id} 
                        onClick={() => openChat(contact.id, contact.name, true)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center border-b border-gray-50 last:border-b-0"
                    >
                        <div className={`w-9 h-9 rounded-full ${bgColor.replace('-50', '-100').replace('-400', '-100')} flex items-center justify-center text-sm font-bold mr-3`}>
                            {contact.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{contact.name}</p>
                            <p className="text-xs text-gray-500 truncate">{contact.info1}</p>
                            <p className="text-xs text-gray-500 truncate">{contact.info2}</p>
                        </div>
                    </li>
                ))}
                {contacts.length === 0 && (
                    <li className="px-4 py-3 text-center text-gray-400 text-xs">검색 결과가 없습니다.</li>
                )}
            </ul>
        </Accordion>
    );

    return (
        <>
            {!isMessengerOpen && !isSidebarOpen && (
                <div 
                    onClick={toggleMessenger}
                    className="fixed bottom-24 right-6 cursor-pointer p-3 rounded-full text-white transition-all duration-300 ease-in-out bg-yellow-400 hover:bg-yellow-500 shadow-xl z-50 flex items-center justify-center"
                    title="메신저 열기"
                >
                    <div className="relative">
                        <Icon name="messageSquare" className="w-6 h-6 text-white"/>
                        
                        {hasNewMessages && (
                            <>
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1 animate-ping"></span>
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1"></span>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className={`fixed right-0 top-0 h-full w-80 bg-gray-100 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col ${panelClass}`}>
                
                <div className="bg-white p-3 flex justify-between items-center shadow-sm z-10">
                    {selectedChatId ? (
                        <div className="flex items-center">
                            <button onClick={handleBackToList} className="mr-2 text-gray-600 hover:bg-gray-100 p-1 rounded-full">
                                <Icon name="arrow-left" className="w-5 h-5"/>
                            </button>
                            <h3 className="font-bold text-gray-800 text-lg truncate w-48">{currentChatName}</h3>
                        </div>
                    ) : (
                        <h3 className="font-bold flex items-center text-lg text-gray-800 pl-2">
                            <Icon name="messageSquare" className="w-5 h-5 mr-2 text-yellow-500"/>
                            메신저
                        </h3>
                    )}
                    <button onClick={toggleMessenger} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                        <Icon name="x" className="w-6 h-6"/>
                    </button>
                </div>

                {selectedChatId ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-100"> 
                            {renderMessages()}
                            <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex items-center space-x-2">
                            <input 
                                type="text" 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="메시지 입력"
                                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all"
                            />
                            <button 
                                type="submit" 
                                disabled={!inputText.trim()}
                                className={`p-2 rounded-full transition-colors ${inputText.trim() ? 'bg-yellow-400 hover:bg-yellow-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                            >
                                <Icon name="send" className="w-5 h-5"/>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex border-b bg-white">
                            <button 
                                onClick={() => setActiveTab('contacts')}
                                className={`flex-1 py-3 text-sm font-bold text-center ${activeTab === 'contacts' ? 'border-b-2 border-yellow-400 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                연락처
                            </button>
                            <button 
                                onClick={() => setActiveTab('chats')}
                                className={`flex-1 py-3 text-sm font-bold text-center ${activeTab === 'chats' ? 'border-b-2 border-yellow-400 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                채팅
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-gray-100">
                            {activeTab === 'contacts' ? (
                                <>
                                    <div className="p-3 bg-white border-b sticky top-0 z-10">
                                        <div className="relative">
                                            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                                            <input
                                                type="text"
                                                placeholder="이름, 학교, 번호로 검색..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-gray-100 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2">
                                        {renderContactList(
                                            filteredContacts.staff, 
                                            '직원', 
                                            'staff', 
                                            'bg-indigo-50 text-indigo-700'
                                        )}

                                        {renderContactList(
                                            filteredContacts.student, 
                                            '학생', 
                                            'student', 
                                            'bg-green-50 text-green-700'
                                        )}

                                        {renderContactList(
                                            filteredContacts.parent, 
                                            '학부모', 
                                            'parent', 
                                            'bg-yellow-50 text-yellow-700'
                                        )}
                                    </div>
                                </>
                            ) : (
                                <ul>
                                    {chatRooms.map(room => (
                                        <li 
                                            key={room.id} 
                                            onClick={() => openChat(room.id, room.name)}
                                            className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer flex items-center bg-white"
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mr-3 ${room.contactId?.startsWith('staff') ? 'bg-indigo-400' : room.contactId?.startsWith('student') ? 'bg-green-400' : 'bg-yellow-400'}`}>
                                                {room.name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="text-sm font-bold text-gray-900">{room.name}</span>
                                                    <span className="text-xs text-gray-400">{room.time}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">{room.lastMessage}</p>
                                            </div>
                                            {room.unread > 0 && (
                                                <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {room.unread}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                    {chatRooms.length === 0 && (
                                        <p className="text-center text-gray-400 text-sm py-10">진행 중인 대화가 없습니다.<br/>연락처에서 대화를 시작해보세요.</p>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};