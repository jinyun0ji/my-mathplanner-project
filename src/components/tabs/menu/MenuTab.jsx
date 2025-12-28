import React, { useState } from 'react';
import { Icon, formatTime } from '../../../utils/helpers';
import CampaignIcon from '@mui/icons-material/Campaign'; 
import NoteAltIcon from '@mui/icons-material/NoteAlt'; 
import TuneIcon from '@mui/icons-material/Tune'; 
import ModalPortal from '../../common/ModalPortal';

export default function MenuTab({ student, onUpdateStudent, onLogout, videoBookmarks, lessonLogs, onLinkToMemo, notices, setActiveTab, isParent = false }) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMemosOpen, setIsMemosOpen] = useState(false); 
    const [editData, setEditData] = useState({ school: '', grade: '', phone: '' });
    const [notifications, setNotifications] = useState({ all: true, post: true, homework: true, clinic: true, class_update: true });

    if (!student) return null;

    const handleOpenProfile = () => { if (student) setEditData({ school: student.school || '', grade: student.grade || '', phone: student.phone || '' }); setIsProfileOpen(true); };
    const handleSaveProfile = () => {
        if (!editData.school || !editData.grade || !editData.phone) { alert('모든 정보를 입력해주세요.'); return; }
        let normalizedSchool = editData.school.trim();
        if (normalizedSchool.endsWith('고등학교')) normalizedSchool = normalizedSchool.replace('고등학교', '고');
        onUpdateStudent({ ...student, ...editData, school: normalizedSchool }, true);
        setIsProfileOpen(false); alert('정보가 수정되었습니다.');
    };
    const toggleNotification = (key) => { setNotifications(prev => { if (key === 'all') { const newValue = !prev.all; return { all: newValue, post: newValue, homework: newValue, clinic: newValue, class_update: newValue }; } const newSettings = { ...prev, [key]: !prev[key] }; if (!newSettings[key]) newSettings.all = false; else if (newSettings.post && newSettings.homework && newSettings.clinic && newSettings.class_update) newSettings.all = true; return newSettings; }); };

    const getMyMemos = () => {
        if (!student || !videoBookmarks || !videoBookmarks[student.id]) return [];
        const myBookmarks = videoBookmarks[student.id];
        const allMemos = [];
        Object.keys(myBookmarks).forEach(lessonId => {
            const lessonIdNum = parseInt(lessonId, 10);
            const lesson = lessonLogs?.find(l => l.id === lessonIdNum);
            const bookmarks = myBookmarks[lessonId];
            if (lesson && bookmarks && bookmarks.length > 0) {
                bookmarks.forEach(bm => {
                    allMemos.push({ ...bm, lessonTitle: lesson.progress, lessonDate: lesson.date, classId: lesson.classId, lessonId: lessonIdNum });
                });
            }
        });
        return allMemos.sort((a, b) => b.id - a.id);
    };
    const myMemos = getMyMemos();

    return (
        <div className="space-y-6 animate-fade-in-up pb-24">
            <h2 className="text-2xl font-bold text-gray-900 px-1">더보기</h2>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                    {isParent ? '👪' : '😎'}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{student.name}</h3>
                    {/* ✅ [수정] 학년 표시: {student.grade}만 사용 ("고" 중복 제거) */}
                    <p className="text-sm text-gray-500">{student.school} | {student.grade}</p>
                </div>
                {/* ✅ [수정] 학부모 모드에선 수정 버튼 숨김 */}
                {!isParent && (
                    <button onClick={() => setIsProfileOpen(true)} className="ml-auto text-xs bg-gray-100 px-3 py-1.5 rounded-lg text-gray-600 font-bold active:bg-gray-200 transition-colors">수정</button>
                )}
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                <button onClick={() => { if(setActiveTab) setActiveTab('board'); }} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3"><div className="bg-brand-light/20 p-2 rounded-lg text-brand-main"><CampaignIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">공지사항 / 게시판</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
                </button>
                
                {/* ✅ [수정] 학부모 모드에선 학습 메모 메뉴 숨김 */}
                {!isParent && (
                    <button onClick={() => setIsMemosOpen(true)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3"><div className="bg-yellow-50 p-2 rounded-lg text-yellow-600"><NoteAltIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">나의 학습 메모</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
                    </button>
                )}

                <button onClick={() => setIsSettingsOpen(true)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3"><div className="bg-gray-50 p-2 rounded-lg text-gray-500"><TuneIcon className="w-5 h-5" /></div><span className="font-bold text-gray-800">알림 설정</span></div><Icon name="chevronRight" className="w-4 h-4 text-gray-300" />
                </button>
            </div>
            <button onClick={onLogout} className="w-full py-4 text-gray-400 text-sm font-medium underline active:text-gray-600">로그아웃</button>
            
            {/* 모달들 (프로필 수정, 메모 등)은 isParent가 아닐 때만 렌더링되거나 호출됨 */}
            {isProfileOpen && !isParent && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-brand-black">내 정보 수정</h3><button onClick={() => setIsProfileOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="space-y-4"><div><label className="block text-xs font-bold text-brand-gray mb-1">이름</label><input type="text" value={student?.name || ''} disabled className="w-full bg-brand-bg/50 border border-brand-gray/30 rounded-lg px-3 py-2 text-sm text-brand-gray cursor-not-allowed" /></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학교</label><input type="text" value={editData.school} onChange={(e) => setEditData({...editData, school: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: 서울고" /><p className="text-[10px] text-brand-gray mt-1 ml-1">* '고등학교'는 자동으로 '고'로 저장됩니다.</p></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학년</label><select value={editData.grade} onChange={(e) => setEditData({...editData, grade: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none appearance-none bg-white"><option value="" disabled>학년을 선택하세요</option><option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option></select></div><div><label className="block text-xs font-bold text-brand-gray mb-1">전화번호</label><input type="text" value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="010-0000-0000" /></div><button onClick={handleSaveProfile} className="w-full bg-brand-main hover:bg-brand-dark text-white font-bold py-3 rounded-xl mt-4 transition-colors active:scale-95">저장하기</button></div></div></div></ModalPortal>}
            {isSettingsOpen && !isParent && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-brand-black">알림 설정</h3><button onClick={() => setIsSettingsOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="space-y-4"><div className="flex items-center justify-between py-2 border-b border-brand-gray/10"><span className="font-bold text-brand-black">전체 알림</span><button onClick={() => toggleNotification('all')} className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${notifications.all ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${notifications.all ? 'translate-x-6' : 'translate-x-0'}`} /></button></div><div className="space-y-3 pt-2"><div className="flex items-center justify-between"><span className="text-sm text-brand-black">게시글(공지사항) 알림</span><button onClick={() => toggleNotification('post')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.post ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.post ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">과제 마감 알림</span><button onClick={() => toggleNotification('homework')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.homework ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.homework ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">클리닉 예약 알림</span><button onClick={() => toggleNotification('clinic')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.clinic ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.clinic ? 'translate-x-5' : 'translate-x-0'}`} /></button></div><div className="flex items-center justify-between"><span className="text-sm text-brand-black">수업 후 자료/성적 알림</span><button onClick={() => toggleNotification('class_update')} className={`w-10 h-5 rounded-full p-0.5 transition-colors ${notifications.class_update ? 'bg-brand-main' : 'bg-brand-gray/30'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${notifications.class_update ? 'translate-x-5' : 'translate-x-0'}`} /></button></div></div></div></div></div></ModalPortal>}
            {isMemosOpen && !isParent && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsMemosOpen(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-0 shadow-2xl animate-fade-in-up overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center p-5 border-b border-brand-gray/20"><h3 className="text-lg font-bold text-brand-black flex items-center gap-2"><NoteAltIcon className="text-brand-main" /> 나의 학습 메모</h3><button onClick={() => setIsMemosOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="overflow-y-auto p-5 space-y-3 custom-scrollbar">{myMemos.length > 0 ? myMemos.map(memo => (<div key={memo.id} onClick={() => { setIsMemosOpen(false); onLinkToMemo(memo.classId, memo.lessonId, memo.time); }} className="bg-brand-bg/50 p-4 rounded-xl cursor-pointer hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-main/30 group"><div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-sm text-brand-black">{memo.lessonTitle}</h4><p className="text-xs text-brand-gray mt-0.5">{memo.lessonDate}</p></div><span className="text-xs font-mono font-bold text-brand-main bg-white px-2 py-1 rounded border border-brand-gray/20">{formatTime(memo.time)}</span></div><p className="text-sm text-brand-dark/80 line-clamp-2">{memo.note}</p><div className="text-right mt-2 text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">강의 보러가기 &rarr;</div></div>)) : (<div className="text-center py-10 text-brand-gray text-sm">저장된 메모가 없습니다.<br/>강의 수강 중 중요한 부분에 메모를 남겨보세요.</div>)}</div></div></div></ModalPortal>}
        </div>
    );
};