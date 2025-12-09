import React from 'react';
import { Icon } from '../utils/helpers'; // Icon Import 경로 수정

export default function NotificationPanel({ notifications, isSidebarOpen, toggleSidebar, hasNewNotifications, setHasNewNotifications }) {
  
  const sidebarWidthClass = isSidebarOpen ? 'w-80 p-4' : 'w-0 p-0';

  return (
    <>
      {/* 1. 알림 토글 버튼: 화면 오른쪽 하단에 고정 (fixed) */}
      {!isSidebarOpen && (
        <div 
          onClick={toggleSidebar} 
          className={`fixed bottom-6 right-6 cursor-pointer p-3 rounded-full text-white transition-all duration-300 ease-in-out bg-indigo-600 hover:bg-indigo-700 shadow-xl z-50`}
          title="알림 패널 열기"
        >
          <div className="relative">
            <Icon name="bell" className="w-6 h-6 text-white"/>
            
            {/* 새로운 알림 표시 (빨간색 점) */}
            {hasNewNotifications && (
              <>
                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1 animate-ping"></span>
                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1"></span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. 메인 알림 패널 (열렸을 때만 내용 표시) */}
      <div 
        className={`fixed right-0 top-0 h-full bg-white shadow-2xl transition-all duration-300 ease-in-out z-50 flex-shrink-0 
                    ${sidebarWidthClass} ${isSidebarOpen ? 'opacity-100' : 'opacity-0'} overflow-hidden`} 
      >
        
        {isSidebarOpen && (
          <div className="flex flex-col h-full">
            {/* 닫기 버튼 (패널 내부에 위치) */}
            <div className="flex justify-between items-center border-b pb-3 mb-3">
                <h3 className="text-xl font-bold flex items-center text-gray-800">
                  <Icon name="bell" className="w-6 h-6 mr-2 text-yellow-600"/>
                  알림
                </h3>
                <button
                    onClick={toggleSidebar}
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
                    title="닫기"
                >
                    <Icon name="x" className="w-6 h-6"/>
                </button>
            </div>
            
            {/* 알림 목록 */}
            <div className="space-y-3 flex-grow overflow-y-auto pr-2">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">새로운 알림이 없습니다.</p>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`p-3 rounded-lg border text-sm ${
                    n.type === 'success' ? 'bg-green-50 border-green-200' :
                    n.type === 'warning' ? 'bg-red-50 border-red-200' :
                    n.type === 'scheduled' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}>
                    <p className="font-semibold">{n.message}</p>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{n.details}</p>
                    <p className="text-xs text-right text-gray-400 mt-1">{n.timestamp}</p>
                  </div>
                ))
              )}
            </div>
            {/* 알림 확인 상태로 변경하는 버튼 */}
            <button 
                onClick={() => {setHasNewNotifications(false);}} 
                className="mt-4 w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
                모든 알림 확인 처리
            </button>
          </div>
        )}
        
      </div>
    </>
  );
};