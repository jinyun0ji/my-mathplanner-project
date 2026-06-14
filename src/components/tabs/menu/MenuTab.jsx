import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, formatTime, formatClassScheduleKo } from '../../../utils/helpers';
import ModalPortal from '../../common/ModalPortal';
import AccountDeletionRequestButton from '../../common/AccountDeletionRequestButton';
import ParentLegalPage from '../../../pages/parent/ParentLegalPage';
import ParentBoardPage from '../../../pages/parent/ParentBoardPage';
import { termsContent } from '../../../content/legal/terms';
import { privacyContent } from '../../../content/legal/privacy';


const ShortcutCard = ({ icon, title, description, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-start rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm active:scale-[0.98]"
    >
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-700">
            <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-gray-900">{title}</span>
        <span className="mt-1 text-xs leading-5 text-gray-500">{description}</span>
    </button>
);

const MenuRow = ({ icon, title, description, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left last:border-b-0 active:bg-gray-50"
    >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-700">
            <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">{title}</span>
            {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
        </span>
        <Icon name="chevronRight" className="h-4 w-4 text-gray-300" />
    </button>
);

const SectionCard = ({ title, children }) => (
    <section className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {children}
        </div>
    </section>
);

const emptyValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
};

const firstValue = (...values) => values.find((value) => value !== null && value !== undefined && value !== '') || '';

const getClassName = (classItem) => firstValue(classItem?.name, classItem?.title, classItem?.className, classItem?.subject, '클래스명 미정');
const getClassTeacherName = (classItem) => firstValue(classItem?.teacherName, classItem?.teacher, classItem?.tutorName, classItem?.tutor, classItem?.instructorName, classItem?.instructor, '담당 선생님 미정');
const getClassTimeLabel = (classItem) => firstValue(classItem?.timeLabel, classItem?.scheduleLabel, classItem?.dayTime, classItem?.daysText, formatClassScheduleKo(classItem));

const AccountInfoRow = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
        <dt className="shrink-0 text-sm font-semibold text-gray-500">{label}</dt>
        <dd className="text-right text-sm font-medium text-gray-900 break-all">{emptyValue(value)}</dd>
    </div>
);

const StudentAccountPage = ({ student, myClasses = [] }) => {
    const classesToShow = Array.isArray(myClasses) ? myClasses : [];
    return (
        <section className="space-y-4">
            <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-bold text-gray-900">학생 정보</h3>
                <dl>
                    <AccountInfoRow label="이름" value={student?.name} />
                    <AccountInfoRow label="Google 이메일" value={student?.email || student?.googleEmail || student?.loginEmail} />
                    <AccountInfoRow label="전화번호" value={student?.phone} />
                    <AccountInfoRow label="학교" value={student?.school} />
                    <AccountInfoRow label="학년" value={student?.grade} />
                </dl>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-gray-900">현재 수강 클래스</h3>
                {classesToShow.length > 0 ? (
                    <div className="space-y-2">
                        {classesToShow.map((classItem, index) => (
                            <div key={classItem?.id || classItem?.classId || `${getClassName(classItem)}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                <p className="text-sm font-semibold text-gray-900">{getClassName(classItem)}</p>
                                <p className="mt-1 text-xs text-gray-500">담당: {getClassTeacherName(classItem)}</p>
                                <p className="mt-1 text-xs text-gray-500">요일/시간: {emptyValue(getClassTimeLabel(classItem))}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                        현재 수강 중인 클래스가 없습니다.
                    </p>
                )}
            </article>
        </section>
    );
};

const getViewTitle = (view) => {
    if (view === 'account') return '계정 정보';
    if (view === 'terms') return '이용약관';
    if (view === 'privacy') return '개인정보처리방침';
    if (view === 'board') return '게시판';
    return '전체';
};

export default function MenuTab({ student, onUpdateStudent, onLogout, videoMemos, lessonLogs, onLinkToMemo, onOpenFormulaBook, notices, onOpenNotifications, onOpenMessages, isParent = false, studentAuthUid = '', myClasses = [] }) {
    const [moreView, setMoreView] = useState('menu');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMemosOpen, setIsMemosOpen] = useState(false);
    const [editData, setEditData] = useState({ school: '', grade: '', phone: '' });
    const navigate = useNavigate();

    const handleSaveProfile = () => {
        if (!editData.school || !editData.grade || !editData.phone) { alert('모든 정보를 입력해주세요.'); return; }
        let normalizedSchool = editData.school.trim();
        if (normalizedSchool.endsWith('고등학교')) normalizedSchool = normalizedSchool.replace('고등학교', '고');
        onUpdateStudent({ ...student, ...editData, school: normalizedSchool }, true);
        setIsProfileOpen(false);
        alert('정보가 수정되었습니다.');
    };
    const handleAfterDeletionRequested = async () => {
        await onLogout?.();
        navigate('/login', { replace: true });
    };

    const toMillis = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (value instanceof Date) return value.getTime();
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        return 0;
    };

    const getMyMemos = () => {
        const memoKeys = [studentAuthUid, student?.authUid, student?.uid, student?.studentUid, student?.id]
            .filter(Boolean)
            .map(String);
        if (!memoKeys.length || !videoMemos) return [];

        const seen = new Set();
        const memos = memoKeys.flatMap((memoKey) => (Array.isArray(videoMemos[memoKey]) ? videoMemos[memoKey] : []))
            .filter((memo) => {
                const key = memo?.id || `${memo?.lessonId || ''}-${memo?.time || ''}-${memo?.note || ''}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        return memos
            .map((memo) => {
                const lesson = lessonLogs?.find((l) => String(l.id) === String(memo.lessonId));
                return {
                    ...memo,
                    lessonTitle: lesson?.progress || lesson?.title || memo?.lessonTitle || '강의 메모',
                    lessonDate: lesson?.date || lesson?.lessonDate || memo?.lessonDate || '',
                    classId: lesson?.classId || memo?.classId || memo?.classDocId,
                    lessonId: lesson?.id || memo.lessonId,
                    updatedAtMs: toMillis(memo.updatedAt) || 0,
                };
            })
            .filter((memo) => memo.classId && memo.lessonId)
            .sort((a, b) => (b.updatedAtMs - a.updatedAtMs) || ((Number(b.time) || 0) - (Number(a.time) || 0)));
    };
    const myMemos = getMyMemos();
    const isMenu = moreView === 'menu';

    return (
        <div className="space-y-4 bg-gray-50 pb-24 animate-fade-in-up">
            {!isMenu && (
                <header className="flex items-center gap-3 px-1">
                    <button
                        type="button"
                        onClick={() => setMoreView('menu')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm active:scale-95"
                        aria-label="전체 메뉴로 돌아가기"
                    >
                        <Icon name="chevronLeft" className="h-5 w-5" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">{getViewTitle(moreView)}</h1>
                </header>
            )}

            {moreView === 'menu' && (
                <section className="space-y-6">
                    <section className="grid grid-cols-3 gap-3">
                        <ShortcutCard icon="fileText" title="게시판" description="학원에서 전달한 게시글" onClick={() => setMoreView('board')} />
                        <ShortcutCard icon="bell" title="알림센터" description="읽지 않은 알림 확인" onClick={onOpenNotifications} />
                        <ShortcutCard icon="messageSquare" title="메시지" description="연구소/강사와 대화" onClick={onOpenMessages} />
                    </section>

                    <SectionCard title="계정">
                        <MenuRow icon="user" title="계정 정보" description="학생 정보 확인 및 수정" onClick={() => setMoreView('account')} />
                    </SectionCard>

                    {!isParent && (
                        <SectionCard title="학습">
                            <MenuRow icon="pen" title="나의 학습 메모" description="강의 수강 중 저장한 메모" onClick={() => setIsMemosOpen(true)} />
                            <MenuRow icon="fileText" title="수학 공식집" description="과목별 핵심 개념과 영상" onClick={onOpenFormulaBook} />
                        </SectionCard>
                    )}

                    <SectionCard title="고객 지원">
                        <MenuRow icon="fileText" title="이용약관" description="서비스 이용 기준과 권리 안내" onClick={() => setMoreView('terms')} />
                        <MenuRow icon="lock" title="개인정보처리방침" description="개인정보 수집 및 보호 안내" onClick={() => setMoreView('privacy')} />
                    </SectionCard>

                    <div className="space-y-3 pt-1">
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <button
                                type="button"
                                onClick={onLogout}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-700 active:bg-gray-50"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                                    <Icon name="logOut" className="h-4 w-4" />
                                </span>
                                로그아웃
                            </button>
                        </div>
                        <div className="pt-3 text-center">
                            <AccountDeletionRequestButton
                                onAfterRequested={handleAfterDeletionRequested}
                                className="inline-flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-semibold text-rose-500 underline-offset-2 hover:text-rose-600 hover:underline active:text-rose-700"
                            />
                        </div>
                    </div>
                </section>
            )}
            {moreView === 'board' && <ParentBoardPage notices={notices} onBack={() => setMoreView('menu')} />}
            {moreView === 'account' && <StudentAccountPage student={student} myClasses={myClasses} />}
            {moreView === 'terms' && <ParentLegalPage content={termsContent} />}
            {moreView === 'privacy' && <ParentLegalPage content={privacyContent} />}

            {isProfileOpen && !isParent && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)}><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-brand-black">내 정보 수정</h3><button onClick={() => setIsProfileOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="space-y-4"><div><label className="block text-xs font-bold text-brand-gray mb-1">이름</label><input type="text" value={student?.name || ''} disabled className="w-full bg-brand-bg/50 border border-brand-gray/30 rounded-lg px-3 py-2 text-sm text-brand-gray cursor-not-allowed" /></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학교</label><input type="text" value={editData.school} onChange={(e) => setEditData({...editData, school: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="예: 서울고" /><p className="text-[10px] text-brand-gray mt-1 ml-1">* '고등학교'는 자동으로 '고'로 저장됩니다.</p></div><div><label className="block text-xs font-bold text-brand-gray mb-1">학년</label><select value={editData.grade} onChange={(e) => setEditData({...editData, grade: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none appearance-none bg-white"><option value="" disabled>학년을 선택하세요</option><option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option></select></div><div><label className="block text-xs font-bold text-brand-gray mb-1">전화번호</label><input type="text" value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="w-full border border-brand-gray/30 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none" placeholder="010-0000-0000" /></div></div><button onClick={handleSaveProfile} className="w-full mt-6 bg-brand-main text-white py-3 rounded-xl font-bold shadow-md active:scale-95 transition-transform">저장하기</button></div></div></ModalPortal>}
            {isMemosOpen && !isParent && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsMemosOpen(false)}><div className="bg-white rounded-2xl w-full max-w-lg p-0 shadow-2xl animate-fade-in-up overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center p-5 border-b border-brand-gray/20"><h3 className="text-lg font-bold text-brand-black flex items-center gap-2"><Icon name="pen" className="text-brand-main" /> 나의 학습 메모</h3><button onClick={() => setIsMemosOpen(false)} className="text-brand-gray hover:text-brand-black"><Icon name="x" className="w-6 h-6" /></button></div><div className="overflow-y-auto p-5 space-y-3 custom-scrollbar">{myMemos.length > 0 ? myMemos.map(memo => (<div key={memo.id} onClick={() => { setIsMemosOpen(false); onLinkToMemo(memo.classId, memo.lessonId, memo.time); }} className="bg-brand-bg/50 p-4 rounded-xl cursor-pointer hover:bg-brand-bg transition-colors border border-transparent hover:border-brand-main/30 group"><div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-sm text-brand-black">{memo.lessonTitle}</h4><p className="text-xs text-brand-gray mt-0.5">{memo.lessonDate}</p></div><span className="text-xs font-mono font-bold text-brand-main bg-white px-2 py-1 rounded border border-brand-gray/20">{formatTime(memo.time)}</span></div><p className="text-sm text-brand-dark/80 line-clamp-2">{memo.note}</p><div className="text-right mt-2 text-xs text-brand-main opacity-0 group-hover:opacity-100 transition-opacity">강의 보러가기 &rarr;</div></div>)) : (<div className="text-center py-10 text-brand-gray text-sm">저장된 메모가 없습니다.<br/>강의 수강 중 중요한 부분에 메모를 남겨보세요.</div>)}</div></div></div></ModalPortal>}
        </div>
    );
}
