// src/notifications/NotificationList.jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Icon } from '../utils/helpers';
import NotificationsIcon from '@mui/icons-material/Notifications';

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().toLocaleDateString('ko-KR');
  if (timestamp instanceof Date) return timestamp.toLocaleDateString('ko-KR');
  return '';
};

export default function NotificationList({
  isOpen,
  onClose,
  notifications = [],
  onNotificationClick,
  onMarkAllRead,
  unreadCount = 0,
  isLoading = false,
  lastReadAt = null,
}) {
  // ✅ Hooks는 조건 없이 항상 호출
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
  }, [notifications]);

  // ✅ 렌더만 분기
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {/* 배경 */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        role="button"
        tabIndex={-1}
      />

      {/* 패널 */}
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-full md:w-96 max-w-full bg-brand-bg shadow-2xl flex flex-col"
      >
        <div className="bg-white px-5 py-4 flex justify-between items-center border-b border-brand-gray/30 shadow-sm shrink-0">
          <h3 className="font-bold text-brand-black text-lg flex items-center gap-2">
            <div className="bg-brand-red/10 text-brand-red p-1.5 rounded-lg flex items-center justify-center">
              <NotificationsIcon className="w-5 h-5" style={{ fontSize: 20 }} />
            </div>
            알림 센터
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={!onMarkAllRead || unreadCount === 0}
              className="text-xs font-semibold text-brand-main bg-brand-light/60 border border-brand-main/20 px-3 py-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              모두 읽음
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-brand-gray hover:text-brand-black rounded-full hover:bg-brand-bg transition-colors"
            >
              <Icon name="x" className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-brand-bg custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-brand-gray">
              알림을 불러오는 중...
            </div>
          ) : sortedNotifications.length > 0 ? (
            sortedNotifications.map((notification) => {
              const createdAt = notification.createdAt;
              const isUnread =
                !notification.readAt &&
                (!lastReadAt ||
                  (createdAt?.toMillis &&
                    lastReadAt?.toMillis &&
                    createdAt.toMillis() > lastReadAt.toMillis()));

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => onNotificationClick?.(notification)}
                  className={`w-full text-left bg-white p-4 rounded-2xl shadow-sm border transition-all hover:shadow-md group ${
                    isUnread ? 'border-brand-main/40 bg-brand-light/10' : 'border-brand-gray/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-brand-gray font-medium bg-brand-bg px-2 py-0.5 rounded">
                      {notification.type || '알림'}
                    </span>
                    <span className="text-xs text-brand-gray">{formatDate(notification.createdAt)}</span>
                  </div>
                  <h4 className="font-bold text-brand-black mb-1 text-base">{notification.title}</h4>
                  <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{notification.body}</p>
                  {isUnread && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-red font-semibold">
                      <span className="w-1.5 h-1.5 bg-brand-red rounded-full" />
                      새로운 알림
                    </span>
                  )}
                </button>
              );
            })
          ) : (
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