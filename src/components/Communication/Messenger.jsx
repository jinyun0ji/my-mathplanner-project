import React from 'react';
import { FEATURES } from '../../config/features';
import InternalMessengerPanel from '../messenger/InternalMessengerPanel';

export default function Messenger({ userId, userRole, students = [], parents = [], classes = [] }) {
    if (!FEATURES.ENABLE_INTERNAL_MESSENGER) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md h-[70vh] flex items-center justify-center">
                <p className="text-sm text-gray-500">내부 메신저 기능이 비활성화되어 있습니다.</p>
            </div>
        );
    }

    return <InternalMessengerPanel userId={userId} userRole={userRole} students={students} parents={parents} classes={classes} />;
}