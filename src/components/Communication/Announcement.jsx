import React, { useState, useMemo } from 'react';
import { Icon } from '../../utils/helpers';
import { AnnouncementModal } from '../../utils/modals/AnnouncementModal'; // 경로 수정

export default function Announcement({ announcements, handleSaveAnnouncement, handleDeleteAnnouncement, allClasses, allStudents }) {
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [announcementToEdit, setAnnouncementToEdit] = useState(null);
    
    // 예약된 공지 (예정 시간 기준), 고정 공지, 일반 공지 분리
    const sortedAnnouncements = useMemo(() => {
        const now = new Date();
        const future = announcements.filter(a => a.scheduleTime && new Date(a.scheduleTime) > now);
        const active = announcements.filter(a => !a.scheduleTime || new Date(a.scheduleTime) <= now);
        
        const pinned = active.filter(a => a.isPinned);
        const general = active.filter(a => !a.isPinned).sort((a, b) => new Date(b.date) - new Date(a.date));

        future.sort((a, b) => new Date(a.scheduleTime) - new Date(b.scheduleTime));

        return { pinned, general, future };
    }, [announcements]);

    const handleEdit = (announcement) => {
        setAnnouncementToEdit(announcement);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 이 공지사항을 삭제하시겠습니까?')) {
            await handleDeleteAnnouncement(id);
        }
    };
    
    const getClassNames = (classIds) => {
        return classIds.map(id => allClasses.find(c => c.id === id)?.name).join(', ') || '전체';
    };

    return (
        <div className="space-y-6">
            <div className='flex justify-end'>
                <button 
                    onClick={() => {setAnnouncementToEdit(null); setIsModalOpen(true);}}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    새 공지 작성
                </button>
            </div>
            
            {/* 예약 공지 */}
            {sortedAnnouncements.future.length > 0 && (
                <div className="border border-yellow-400 bg-yellow-50 p-4 rounded-xl shadow-md space-y-3">
                    <h4 className="text-lg font-bold text-yellow-800 flex items-center">
                        <Icon name="clock" className="w-5 h-5 mr-2"/>
                        예약된 공지 ({sortedAnnouncements.future.length}건)
                    </h4>
                    {sortedAnnouncements.future.map(a => (
                        <div key={a.id} className="p-3 border rounded-lg bg-white flex justify-between items-center">
                            <div>
                                <p className="text-sm font-semibold">{a.title}</p>
                                <p className="text-xs text-orange-600 mt-1">
                                    <Icon name="bell" className="w-3 h-3 inline mr-1"/>
                                    {a.scheduleTime.replace('T', ' ')} 발송 예정 ({getClassNames(a.targetClasses)})
                                </p>
                            </div>
                            <button onClick={() => handleEdit(a)} className="text-sm text-blue-600 hover:underline">수정</button>
                        </div>
                    ))}
                </div>
            )}

            {/* 고정 및 일반 공지 */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h4 className="text-xl font-bold mb-4 border-b pb-2">게시된 공지사항</h4>
                
                {/* 고정 공지 */}
                {sortedAnnouncements.pinned.map(a => (
                    <div key={a.id} className="p-4 border-b border-yellow-200 bg-yellow-50 last:border-b-0 rounded-lg mb-2 shadow-sm flex flex-col space-y-2">
                        <div className='flex justify-between items-start'>
                            <h5 className="text-base font-bold text-yellow-800 flex items-center">
                                <Icon name="pin" className="w-4 h-4 mr-2 text-yellow-600"/>
                                {a.title}
                            </h5>
                            <div className='flex space-x-2 text-sm text-gray-500'>
                                <p className='text-xs text-yellow-700 font-medium'>[대상: {getClassNames(a.targetClasses)}]</p>
                                <p className='text-xs'>{a.date} by {a.author}</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-700 ml-6" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                        <div className='flex justify-end space-x-3 pt-2 border-t border-yellow-200'>
                             <button onClick={() => handleEdit(a)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"><Icon name="edit" className="w-3 h-3 mr-1"/>수정</button>
                             <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-800 flex items-center"><Icon name="trash" className="w-3 h-3 mr-1"/>삭제</button>
                        </div>
                    </div>
                ))}
                
                {/* 일반 공지 */}
                {sortedAnnouncements.general.map(a => (
                    <div key={a.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50 flex flex-col space-y-2">
                        <div className='flex justify-between items-start'>
                            <h5 className="text-base font-medium text-gray-800">{a.title}</h5>
                            <div className='flex space-x-3 text-sm text-gray-500'>
                                <p className='text-xs text-blue-700 font-medium'>[대상: {getClassNames(a.targetClasses)}]</p>
                                <p className='text-xs'>{a.date} by {a.author}</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-700 ml-1" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                        <div className='flex justify-end space-x-3 pt-2 border-t mt-2'>
                             <button onClick={() => handleEdit(a)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"><Icon name="edit" className="w-3 h-3 mr-1"/>수정</button>
                             <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:text-red-800 flex items-center"><Icon name="trash" className="w-3 h-3 mr-1"/>삭제</button>
                        </div>
                    </div>
                ))}

                {sortedAnnouncements.pinned.length === 0 && sortedAnnouncements.general.length === 0 && (
                    <p className="text-sm text-gray-500 p-4 text-center">현재 게시된 공지사항이 없습니다.</p>
                )}
            </div>

            <AnnouncementModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveAnnouncement}
                announcementToEdit={announcementToEdit}
                allClasses={allClasses}
                allStudents={allStudents}
            />
        </div>
    );
};