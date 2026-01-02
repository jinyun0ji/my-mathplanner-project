import React from 'react';

import Sidebar from '../layout/Sidebar';
import Header from '../layout/Header';
import NotificationPanel from '../layout/NotificationPanel';
import MessengerPanel from '../layout/MessengerPanel';
import { Icon } from '../utils/helpers';

export default function AppShell({
  page,
  notifications,
  students,
  classes,
  isSidebarOpen,
  isMessengerOpen,
  hasNewNotifications,
  hasNewMessages,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setHasNewNotifications,
  setHasNewMessages,
  toggleSidebar,
  toggleMessenger,
  handlePageChange,
  handleLogout,
  children,
}) {
  return (
    <div className="flex h-screen bg-gray-100 font-sans text-base relative">
      <div className="md:hidden fixed top-3 left-4 z-40">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-white rounded-lg shadow-md text-indigo-900 hover:bg-gray-50 border border-gray-100"
        >
          <Icon name="menu" className="w-6 h-6" />
        </button>
      </div>

      <Sidebar
        page={page}
        setPage={(p, id, r) => {
          handlePageChange(p, id, r);
          setIsMobileMenuOpen(false);
        }}
        onLogout={handleLogout}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ✅ FIX: Sidebar가 md에서 static으로 레이아웃 폭을 차지하므로 md:ml-64 제거 */}
      <div
        className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${
          isSidebarOpen || isMessengerOpen ? 'mr-80' : 'mr-0'
        }`}
      >
        <Header page={page} />
        <main id="main-content" className="overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6 min-w-0">
          {children}
        </main>
      </div>

      <NotificationPanel
        notifications={notifications}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        hasNewNotifications={hasNewNotifications}
        setHasNewNotifications={setHasNewNotifications}
      />

      <MessengerPanel
        isMessengerOpen={isMessengerOpen}
        toggleMessenger={toggleMessenger}
        hasNewMessages={hasNewMessages}
        setHasNewMessages={setHasNewMessages}
        isSidebarOpen={isSidebarOpen}
        students={students}
        classes={classes}
      />
    </div>
  );
}