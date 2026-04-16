import React from 'react';
import { Icon } from '../utils/helpers';
import InternalMessengerPanel from '../components/messenger/InternalMessengerPanel';
import { FEATURES } from '../config/features';
import { isStaffOrTeachingRole } from '../constants/roles';

export default function MessengerPanel({
    isMessengerOpen,
    toggleMessenger,
    hasNewMessages,
    setHasNewMessages,
    isSidebarOpen,
    userId,
    userRole,
    students = [],
    parents = [],
    classes = [],
}) {
    const canUseInternalMessenger = FEATURES.ENABLE_INTERNAL_MESSENGER && isStaffOrTeachingRole(userRole);

    if (!canUseInternalMessenger) {
        return null;
    }

    const handleToggleMessenger = () => {
        if (!isMessengerOpen) {
            setHasNewMessages(false);
        }
        toggleMessenger();
    };

    return (
        <>
            {!isMessengerOpen && !isSidebarOpen && (
                <button
                    type="button"
                    onClick={handleToggleMessenger}
                    className="fixed bottom-24 right-6 cursor-pointer p-3 rounded-full text-white transition-all duration-300 ease-in-out bg-yellow-400 hover:bg-yellow-500 shadow-xl z-50 flex items-center justify-center"
                    title="메신저 열기"
                >
                <span className="relative">
                        <Icon name="messageSquare" className="w-6 h-6 text-white" />
                        {hasNewMessages && (
                            <>
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1 animate-ping" />
                                <span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 transform translate-x-1 -translate-y-1" />
                            </>
                        )}
                    </span>
                </button>
            )}

            <div className={`fixed right-0 top-0 h-full w-[28rem] max-w-full bg-gray-100 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col ${isMessengerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="bg-white p-3 flex justify-between items-center shadow-sm z-10 border-b border-gray-200">
                    <h3 className="font-bold flex items-center text-lg text-gray-800 pl-2">
                        <Icon name="messageSquare" className="w-5 h-5 mr-2 text-yellow-500" />
                        내부 메신저
                    </h3>
                    <button type="button" onClick={handleToggleMessenger} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                        <Icon name="x" className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <InternalMessengerPanel
                        userId={userId}
                        userRole={userRole}
                        students={students}
                        parents={parents}
                        classes={classes}
                    />
                </div>
            </div>
        </>
    );
};