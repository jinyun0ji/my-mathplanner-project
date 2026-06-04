import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../utils/helpers';
import ParentAccountPage from './ParentAccountPage';
import ParentLegalPage from './ParentLegalPage';
import AccountDeletionRequestButton from '../../components/common/AccountDeletionRequestButton';
import { termsContent } from '../../content/legal/terms';
import { privacyContent } from '../../content/legal/privacy';

const stripHtml = (value) => String(value || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();

const getNoticeDate = (notice) => {
  const value = notice?.date || notice?.createdAt || notice?.updatedAt || notice?.publishedAt;
  if (!value) return '-';
  if (typeof value === 'string') return value;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getNoticeAuthor = (notice) => notice?.author || notice?.authorName || notice?.createdByName || '채수용 수학';

const ShortcutCard = ({ icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[116px] flex-col items-start rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.98] hover:border-gray-300 hover:bg-gray-50"
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

const ParentNoticesPage = ({ notices = [] }) => (
  <section className="space-y-3">
    {notices.length > 0 ? (
      <div className="space-y-3">
        {notices.map((notice, index) => {
          const content = stripHtml(notice?.summary || notice?.content || notice?.body || notice?.text);
          const excerpt = content.length > 120 ? `${content.slice(0, 120)}...` : content;
          return (
            <article key={notice?.id || `${notice?.title || 'notice'}-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900">{notice?.title || '제목 없음'}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{excerpt || '내용이 없습니다.'}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>{getNoticeAuthor(notice)}</span>
                <span>{getNoticeDate(notice)}</span>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        등록된 공지사항이 없습니다.
      </div>
    )}
  </section>
);

const ParentMoreMenu = ({ onChangeView, onOpenNotifications, onOpenMessages, onLogout, onAfterDeletionRequested }) => (
  <section className="space-y-6">
    {/* <header className="px-1 pt-1">
      <h1 className="text-2xl font-extrabold text-gray-900">전체</h1>
      <p className="mt-1 text-sm text-gray-500">필요한 메뉴와 설정을 한 곳에서 확인하세요.</p>
    </header> */}

    <section className="grid grid-cols-3 gap-3">
      <ShortcutCard icon="fileText" title="게시판" description="학원에서 전달한 게시글" onClick={() => onChangeView('board')} />
      <ShortcutCard icon="bell" title="알림센터" description="읽지 않은 알림 확인" onClick={onOpenNotifications} />
      <ShortcutCard icon="messageSquare" title="메시지" description="연구소/강사와 대화" onClick={onOpenMessages} />
    </section>

    <SectionCard title="계정">
      <MenuRow icon="user" title="계정 정보" description="학부모 및 학생 정보" onClick={() => onChangeView('account')} />
    </SectionCard>

    <SectionCard title="고객 지원">
      <MenuRow icon="fileText" title="이용약관" description="서비스 이용 기준과 권리 안내" onClick={() => onChangeView('terms')} />
      <MenuRow icon="lock" title="개인정보처리방침" description="개인정보 수집 및 보호 안내" onClick={() => onChangeView('privacy')} />
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
          onAfterRequested={onAfterDeletionRequested}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-semibold text-rose-500 underline-offset-2 hover:text-rose-600 hover:underline active:text-rose-700"
        />
      </div>
    </div>
  </section>
);

const getViewTitle = (view) => {
  if (view === 'account') return '계정 정보';
  if (view === 'terms') return '이용약관';
  if (view === 'privacy') return '개인정보처리방침';
  if (view === 'board') return '게시판';
  return '전체';
};

const ParentMorePage = ({
  moreView = 'menu',
  onChangeView,
  notices = [],
  activeChild,
  currentParent,
  accountInfo,
  myClasses = [],
  ongoingClasses = [],
  onOpenNotifications,
  onOpenMessages,
  onLogout,
}) => {
  const navigate = useNavigate();
  const isMenu = moreView === 'menu';
  const handleAfterDeletionRequested = async () => {
    await onLogout?.();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-4 bg-gray-50 pb-6">
      {!isMenu && (
        <header className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => onChangeView('menu')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm active:scale-95"
            aria-label="전체 메뉴로 돌아가기"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{getViewTitle(moreView)}</h1>
        </header>
      )}

      {moreView === 'menu' && (
        <ParentMoreMenu
          onChangeView={onChangeView}
          onOpenNotifications={onOpenNotifications}
          onOpenMessages={onOpenMessages}
          onLogout={onLogout}
          onAfterDeletionRequested={handleAfterDeletionRequested}
        />
      )}
      {moreView === 'board' && <ParentNoticesPage notices={notices} />}
      {moreView === 'account' && (
        <ParentAccountPage
          activeChild={activeChild}
          currentParent={currentParent}
          accountInfo={accountInfo}
          myClasses={myClasses}
          ongoingClasses={ongoingClasses}
        />
      )}
      {moreView === 'terms' && <ParentLegalPage content={termsContent} />}
      {moreView === 'privacy' && <ParentLegalPage content={privacyContent} />}
    </div>
  );
};

export default ParentMorePage;