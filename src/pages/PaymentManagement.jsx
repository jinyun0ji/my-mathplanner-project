import React, { useState } from 'react';
import { Icon } from '../utils/helpers'; // 경로 수정

export default function PaymentManagement() { 
    
    const initialBookList = [
        { id: 1, name: 'RPM 수학(상)', price: 15000, stock: 50 },
        { id: 2, name: '블랙라벨 수학(상)', price: 17000, stock: 35 },
        { id: 3, name: '개념원리 수학I', price: 18000, stock: 20 },
        { id: 4, name: '고1 정석', price: 22000, stock: 10 },
    ];
    const [bookList, setBookList] = useState(initialBookList);
    const [newBook, setNewBook] = useState({ name: '', price: 0, stock: 0 });
    const [activeTab, setActiveTab] = useState('stock');

    const handleAddBook = (e) => {
        e.preventDefault();
        if (newBook.name && newBook.price > 0 && newBook.stock >= 0) {
            const id = bookList.reduce((max, b) => Math.max(max, b.id), 0) + 1;
            setBookList(prev => [...prev, { ...newBook, id }]);
            setNewBook({ name: '', price: 0, stock: 0 });
        }
    };
    
    return (
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-800">교재 및 수납 관리</h3>
            
            <div className="flex border-b">
                {['stock', 'payment'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-lg font-medium transition duration-150 ${
                            activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab === 'stock' ? '교재 재고 관리' : '수납 현황 (미구현)'}
                    </button>
                ))}
            </div>
            
            {activeTab === 'stock' && (
                <div className="bg-white p-6 rounded-xl shadow-md grid grid-cols-2 gap-8">
                    {/* 교재 등록 폼 */}
                    <div>
                        <h4 className="text-xl font-bold mb-4 border-b pb-2 text-gray-800">새 교재 등록</h4>
                        <form onSubmit={handleAddBook} className="space-y-3 p-4 border rounded-lg bg-gray-50">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">교재명</label>
                                <input type="text" value={newBook.name} onChange={e => setNewBook({...newBook, name: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">단가 (원)</label>
                                    <input type="number" value={newBook.price} onChange={e => setNewBook({...newBook, price: Number(e.target.value)})} required min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">초기 재고</label>
                                    <input type="number" value={newBook.stock} onChange={e => setNewBook({...newBook, stock: Number(e.target.value)})} required min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition duration-150">
                                <Icon name="plus" className="w-5 h-5 mr-2" />
                                교재 등록
                            </button>
                        </form>
                    </div>

                    {/* 현재 재고 현황 */}
                    <div>
                        <h4 className="text-xl font-bold mb-4 border-b pb-2 text-gray-800">현재 교재 재고</h4>
                        <div className="overflow-y-auto max-h-96 rounded-lg border">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['교재명', '단가', '재고'].map(header => (
                                            <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {bookList.map(book => (
                                        <tr key={book.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.price.toLocaleString()}원</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${book.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>
                                                {book.stock}권
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'payment' && (
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <p className="text-gray-500">수납 현황 기능은 다음 업데이트에서 구현될 예정입니다.</p>
                </div>
            )}
        </div>
    );
};