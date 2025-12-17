import React from 'react';
import { Icon } from '../../utils/helpers';

export default function ClassTab({ myClasses, setSelectedClassId }) {
    return (
        <div className="space-y-6 animate-fade-in-up pb-24">
            <h2 className="text-2xl font-bold text-gray-900 px-1">나의 강의실</h2>
            <div className="grid grid-cols-1 gap-4">
                {myClasses.map(cls => (
                    <div key={cls.id} onClick={() => setSelectedClassId(cls.id)} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform active:bg-gray-50">
                        <div className="flex gap-4 items-center"><div className="bg-brand-light/20 w-14 h-14 rounded-2xl flex items-center justify-center text-brand-main font-bold text-xl shrink-0">{cls.name.charAt(0)}</div><div><h4 className="font-bold text-gray-900 text-lg mb-1">{cls.name}</h4><p className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-md inline-flex items-center gap-1"><Icon name="users" className="w-3 h-3" /> {cls.teacher} 선생님</p><p className="text-xs text-gray-400 mt-1 ml-0.5">{cls.schedule.days.join(', ')} {cls.schedule.time}</p></div></div><div className="text-gray-300"><Icon name="chevronRight" className="w-6 h-6" /></div>
                    </div>
                ))}
            </div>
        </div>
    );
};