import React, { useState } from 'react';
import { Icon } from '../../../utils/helpers';
import CampaignIcon from '@mui/icons-material/Campaign'; 
import ModalPortal from '../../common/ModalPortal';

export default function BoardTab({ notices }) {
    const [selectedNotice, setSelectedNotice] = useState(null);
    const safeNotices = Array.isArray(notices) ? notices : [];

    const splitNotices = (items) => {
        const pinned = items
            .filter((n) => n.isPinned)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const general = items
            .filter((n) => !n.isPinned)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return { pinned, general };
    };

    const allSections = splitNotices(safeNotices);

    const renderSection = (title, section, tone = 'gray') => {
        const accent = tone === 'danger'
            ? { badge: 'text-red-500 bg-red-50 border-red-200', dot: 'bg-red-300', title: 'text-red-500' }
            : { badge: 'text-blue-500 bg-blue-50 border-blue-200', dot: 'bg-blue-300', title: 'text-gray-900' };

        return (
            <div className="space-y-3">
                <h3 className={`text-sm font-bold px-1 flex items-center gap-2 ${accent.title}`}>
                    <span className={`w-2 h-2 rounded-full ${accent.dot}`}></span>
                    {title}
                </h3>

                {section.pinned.length > 0 && (
                    <div className="space-y-3">
                        {section.pinned.map((notice) => (
                            <div
                                key={notice.id}
                                onClick={() => setSelectedNotice(notice)}
                                className="bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm flex flex-col justify-between cursor-pointer"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-white text-red-500 text-[10px] px-2 py-0.5 rounded font-bold border border-red-200 shadow-sm flex items-center gap-1">필독</span>
                                        <span className="text-xs text-red-400 font-medium">{notice.date}</span>
                                    </div>
                                    <h4 className="font-bold text-lg text-gray-900 leading-tight line-clamp-2 mt-1">{notice.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="space-y-3">
                    {section.general.length > 0 ? section.general.map((notice) => (
                        <div
                            key={notice.id}
                            onClick={() => setSelectedNotice(notice)}
                            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center cursor-pointer active:bg-gray-50 transition-colors"
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    {notice.isPinned && <CampaignIcon className="w-4 h-4 text-red-500 shrink-0" />}
                                    <h4 className="text-sm font-bold truncate text-gray-900">{notice.title}</h4>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <span>{notice.author}</span>
                                    <span className="w-0.5 h-2 bg-gray-300"></span>
                                    <span>{notice.date}</span>
                                </div>
                            </div>
                            <Icon name="chevronRight" className="w-4 h-4 text-gray-300 shrink-0" />
                        </div>
                    )) : (
                        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">등록된 게시글이 없습니다.</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            {renderSection('전체 글', allSections, 'primary')}
            {selectedNotice && <ModalPortal><div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedNotice(null)}><div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fade-in-up max-h-[80vh] overflow-y-auto custom-scrollbar relative" onClick={e => e.stopPropagation()}><button onClick={() => setSelectedNotice(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100"><Icon name="x" className="w-6 h-6" /></button><div className="mb-4 pr-8"><div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-white bg-brand-main px-2 py-1 rounded-full">{selectedNotice.author}</span><span className="text-xs text-gray-500">{selectedNotice.date}</span></div><h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedNotice.title}</h3></div><div className="prose prose-sm max-w-none text-gray-800 leading-relaxed border-t border-gray-100 pt-4 min-h-[100px]"><div dangerouslySetInnerHTML={{ __html: selectedNotice.content }} /></div>{selectedNotice.attachments && selectedNotice.attachments.length > 0 && (<div className="mt-6 pt-4 border-t border-gray-100"><p className="text-xs font-bold text-gray-500 mb-2">첨부파일</p><div className="flex flex-wrap gap-2">{selectedNotice.attachments.map((file, idx) => (<button key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm text-brand-main hover:bg-gray-100 transition-colors"><Icon name="fileText" className="w-4 h-4" />{file}</button>))}</div></div>)}</div></div></ModalPortal>}
        </div>
    );
};