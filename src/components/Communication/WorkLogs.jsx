import React, { useState, useMemo } from 'react';
import { Icon } from '../../utils/helpers';
import { Modal } from '../../components/common/Modal'; // 경로 수정

export default function WorkLogs({ logs, handleSaveLog, handleDeleteLog }) { 
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState(null);
    const [newContent, setNewContent] = useState('');

    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [logs]);

    const handleEdit = (log) => {
        setLogToEdit(log);
        setNewContent(log.content);
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newContent) return;

        const logData = {
            id: logToEdit ? logToEdit.id : null,
            content: newContent,
        };

        handleSaveLog(logData, !!logToEdit);
        setNewContent('');
        setIsModalOpen(false);
        setLogToEdit(null);
    };

    return (
        <div className="space-y-6">
            <div className='flex justify-end'>
                <button 
                    onClick={() => { setLogToEdit(null); setNewContent(''); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center shadow-md transition duration-150"
                >
                    <Icon name="plus" className="w-5 h-5 mr-2" />
                    새 근무 일지 작성
                </button>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h4 className="text-xl font-bold mb-4 border-b pb-2">전체 근무 일지</h4>
                
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {sortedLogs.map(log => (
                        <div key={log.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{log.date} by <span className="text-gray-800">{log.author}</span></p>
                                </div>
                                <div className='flex space-x-2'>
                                    <button onClick={() => handleEdit(log)} className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-100" title="수정"><Icon name="edit" className="w-4 h-4"/></button>
                                    <button onClick={() => { if(window.confirm('정말 이 일지를 삭제하시겠습니까?')) handleDeleteLog(log.id); }} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" title="삭제"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{log.content}</p>
                        </div>
                    ))}
                    {logs.length === 0 && <p className="text-sm text-gray-500 p-4 text-center">작성된 근무 일지가 없습니다.</p>}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={logToEdit ? '근무 일지 수정' : '새 근무 일지 작성'} maxWidth="max-w-xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows="8" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="오늘 수행한 업무, 학생 특이사항, 다음 근무자에게 전달할 내용 등을 작성하세요."></textarea>
                    </div>
                    <div className="pt-4 border-t flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150">
                            취소
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-150 shadow-md">
                            {logToEdit ? '수정 사항 저장' : '등록하기'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};