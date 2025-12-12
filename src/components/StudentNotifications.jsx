// src/components/StudentNotifications.jsx
import React, { useEffect, useRef } from 'react';
import { Icon } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CampaignIcon from '@mui/icons-material/Campaign'; // ✅ [추가]

export default function StudentNotifications({ isOpen, onClose, notices = [], onDelete, onNoticeClick }) {
    const panelRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const sortedNotices = [...notices].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
        return new Date(b.date) - new Date(a.date);
    });

    return (
        <div className={`fixed inset-0 z-[60] overflow-hidden pointer-events-none`}>
            <div 
                className={`absolute inset-0 bg-black/30 transition-opacity duration-500 ease-in-out pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose}
            />

            <div 
                ref={panelRef}
                className={`absolute top-0 right-0 h-full w-full md:w-96 max-w-full bg-brand-bg shadow-2xl pointer-events-auto flex flex-col 
                transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* 헤더 */}
                <div className="bg-white px-5 py-4 flex justify-between items-center border-b border-brand-gray/30 shadow-sm shrink-0">
                    <h3 className="font-bold text-brand-black text-lg flex items-center gap-2">
                        <div className="bg-brand-red/10 text-brand-red p-1.5 rounded-lg flex items-center justify-center">
                            <NotificationsIcon className="w-5 h-5" style={{ fontSize: 20 }} />
                        </div>
                        알림 센터
                    </h3>
                    <button onClick={onClose} className="p-2 text-brand-gray hover:text-brand-black rounded-full hover:bg-brand-bg transition-colors">
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>

                {/* 알림 리스트 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-bg custom-scrollbar">
                    {sortedNotices.length > 0 ? sortedNotices.map((notice) => (
                        <div 
                            key={notice.id} 
                            onClick={onNoticeClick}
                            className={`bg-white p-4 rounded-2xl shadow-sm border transition-all hover:shadow-md cursor-pointer group relative ${notice.isPinned ? 'border-brand-main/30 bg-brand-light/10' : 'border-brand-gray/20'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {notice.isPinned && (
                                        <span className="bg-brand-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                            {/* ✅ [수정] 알림 리스트에서도 확성기 아이콘 사용 */}
                                            <CampaignIcon style={{ fontSize: 14 }} /> 필독
                                        </span>
                                    )}
                                    <span className="text-xs text-brand-gray font-medium bg-brand-bg px-2 py-0.5 rounded">
                                        {notice.author}
                                    </span>
                                </div>
                                <span className="text-xs text-brand-gray">{notice.date}</span>
                            </div>
                            <h4 className="font-bold text-brand-black mb-1 text-base">{notice.title}</h4>
                            <div 
                                className="text-sm text-gray-700 line-clamp-2 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: notice.content }}
                            />
                            
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    onDelete(notice.id);
                                }}
                                className="absolute top-3 right-3 p-1.5 text-brand-gray hover:text-brand-red hover:bg-brand-red/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Icon name="trash" className="w-4 h-4" />
                            </button>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center h-64 text-brand-gray space-y-3">
                            <div className="bg-white p-4 rounded-full shadow-sm">
                                <NotificationsIcon className="w-8 h-8 opacity-30" style={{ fontSize: 32 }} />
                            </div>
                            <p>새로운 알림이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}