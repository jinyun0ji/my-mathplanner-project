import React from 'react';
import InternalMessengerPanel from '../components/messenger/InternalMessengerPanel';

export default function StaffMobileMessengerPage({
  userId,
  userRole,
  students = [],
  parents = [],
  classes = [],
  onLogout,
  profileDocId = '',
}) {
  return (
    <main className="flex h-[100dvh] min-h-0 flex-col bg-gray-50 text-gray-900 pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-bold text-gray-900">메신저</h1>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 active:bg-gray-100"
          >
            로그아웃
          </button>
        </div>
      </header>
      <section className="min-h-0 flex-1 px-0 py-0">
        <InternalMessengerPanel
          userId={userId}
          userRole={userRole}
          students={students}
          parents={parents}
          classes={classes}
          mobileMessengerOnly
          profileDocId={profileDocId}
        />
      </section>
    </main>
  );
}
