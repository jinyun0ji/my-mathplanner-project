import React from 'react';
import InternalMessengerPanel from '../components/messenger/InternalMessengerPanel';

export default function StaffMobileMessengerPage({
  userId,
  userRole,
  students = [],
  parents = [],
  classes = [],
  onLogout,
}) {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900">메신저</h1>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm active:bg-gray-100"
          >
            로그아웃
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-3 py-3">
        <InternalMessengerPanel
          userId={userId}
          userRole={userRole}
          students={students}
          parents={parents}
          classes={classes}
          mobileMessengerOnly
        />
      </section>
    </main>
  );
}
