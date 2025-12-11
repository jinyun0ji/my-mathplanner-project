// src/utils/modals/TextbookModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';

export const TextbookModal = ({ isOpen, onClose, onSave, textbook = null }) => {
    const [name, setName] = useState('');
    const [publisher, setPublisher] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [type, setType] = useState('진도교재');

    useEffect(() => {
        if (textbook) {
            setName(textbook.name);
            setPublisher(textbook.publisher);
            setPrice(textbook.price);
            setStock(textbook.stock);
            setType(textbook.type);
        } else {
            setName('');
            setPublisher('');
            setPrice('');
            setStock('');
            setType('진도교재');
        }
    }, [textbook, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: textbook ? textbook.id : null,
            name,
            publisher,
            price: Number(price),
            stock: Number(stock),
            type
        }, !!textbook);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={textbook ? '교재 정보 수정' : '새 교재 등록'} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">교재명*</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded-md p-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">출판사</label>
                        <input type="text" value={publisher} onChange={e => setPublisher(e.target.value)} className="w-full border rounded-md p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">구분</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-md p-2 bg-white">
                            <option value="진도교재">진도교재</option>
                            <option value="숙제교재">숙제교재</option>
                            <option value="부교재">부교재</option>
                            <option value="기타">기타</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">단가(원)*</label>
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} required className="w-full border rounded-md p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">재고(권)*</label>
                        <input type="number" value={stock} onChange={e => setStock(e.target.value)} required className="w-full border rounded-md p-2" />
                    </div>
                </div>
                <div className="pt-4 flex justify-end space-x-2 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm">취소</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">저장</button>
                </div>
            </form>
        </Modal>
    );
};