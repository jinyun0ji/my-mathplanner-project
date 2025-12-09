import React from 'react';
import { Icon } from '../../utils/helpers';

export default function Messenger() {
    return (
        <div className="bg-white p-6 rounded-xl shadow-md h-[70vh] flex items-center justify-center">
            <div className='text-center space-y-2'>
                <Icon name="send" className="w-8 h-8 mx-auto text-gray-400"/>
                <p className="text-lg text-gray-500 font-semibold">내부 메신저</p>
                <p className='text-sm text-gray-500'>교직원 간 1:1 채팅 및 그룹 채팅 기능은 곧 추가될 예정입니다.</p>
            </div>
        </div>
    );
};