import React, { useState, useMemo } from 'react';
import { Icon } from '../utils/helpers';
import { Modal } from '../components/common/Modal'; 
import { PaymentNotificationModal } from '../utils/modals/PaymentNotificationModal'; // ✅ 신규 모달 import

export default function PaymentManagement({ students, classes, logNotification }) { 

    // --- 1. 초기 데이터 및 상태 ---
    const initialBookList = [
        { id: 1, name: 'RPM 수학(상)', price: 15000, stock: 50, type: '숙제교재' },
        { id: 2, name: '블랙라벨 수학(상)', price: 17000, stock: 35, type: '숙제교재' },
        { id: 3, name: '개념원리 수학I', price: 18000, stock: 20, type: '진도교재' },
        { id: 4, name: '고1 정석', price: 22000, stock: 10, type: '진도교재' },
        { id: 5, name: '오답노트 전용 바인더', price: 5000, stock: 100, type: '기타' },
    ];

    const initialClassBookMap = {
        1: [1, 2], 
        2: [3],    
    };

    const initialPaymentLogs = [
        { id: 1, date: '2025-11-20', studentName: '김민준', studentId: 1, bookId: 1, bookName: 'RPM 수학(상)', amount: 15000, method: '카드', type: '현장결제' },
    ];

    const [bookList, setBookList] = useState(initialBookList);
    const [paymentLogs, setPaymentLogs] = useState(initialPaymentLogs);
    const [classBookMap, setClassBookMap] = useState(initialClassBookMap);
    
    const [activeTab, setActiveTab] = useState('classStatus'); 

    // 모달 상태
    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isClassSettingModalOpen, setIsClassSettingModalOpen] = useState(false);
    
    // ✅ 알림 모달 상태 추가
    const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
    const [notificationTargets, setNotificationTargets] = useState([]); // 알림 보낼 대상 목록

    // 폼 상태
    const [newBook, setNewBook] = useState({ name: '', price: 0, stock: 0, type: '진도교재' });
    const [paymentForm, setPaymentForm] = useState({
        studentId: '',
        bookId: '',
        method: '카드',
        channel: '현장결제',
    });
    
    const [viewClassId, setViewClassId] = useState(classes && classes.length > 0 ? classes[0].id : null);
    const [selectedClassForSetting, setSelectedClassForSetting] = useState(classes && classes.length > 0 ? classes[0].id : null);

    // ✅ 체크박스 선택 상태 (studentId 목록)
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);


    // --- 2. 로직 및 헬퍼 함수 ---

    // [로직] 특정 반의 학생별 납부 현황 계산
    const classPaymentStatus = useMemo(() => {
        if (!viewClassId) return [];

        const targetClass = classes.find(c => c.id === viewClassId);
        if (!targetClass) return [];

        const requiredBookIds = classBookMap[viewClassId] || [];
        const requiredBooks = bookList.filter(b => requiredBookIds.includes(b.id));
        const totalRequiredAmount = requiredBooks.reduce((sum, b) => sum + b.price, 0);

        return targetClass.students.map(studentId => {
            const student = students.find(s => s.id === studentId);
            if (!student) return null;

            const paidBookIds = paymentLogs
                .filter(log => log.studentId === studentId)
                .map(log => log.bookId);

            const unpaidBooks = requiredBooks.filter(b => !paidBookIds.includes(b.id));
            const unpaidAmount = unpaidBooks.reduce((sum, b) => sum + b.price, 0);
            const isFullyPaid = unpaidBooks.length === 0;

            return {
                student,
                requiredBooks,
                unpaidBooks,
                totalRequiredAmount,
                unpaidAmount,
                isFullyPaid
            };
        }).filter(item => item !== null);

    }, [viewClassId, classes, students, classBookMap, bookList, paymentLogs]);

    // [체크박스 핸들러] 전체 선택/해제
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // 미납이 있는 학생만 선택
            const unpaidStudentIds = classPaymentStatus
                .filter(s => !s.isFullyPaid)
                .map(s => s.student.id);
            setSelectedStudentIds(unpaidStudentIds);
        } else {
            setSelectedStudentIds([]);
        }
    };

    // [체크박스 핸들러] 개별 선택/해제
    const handleSelectStudent = (studentId) => {
        setSelectedStudentIds(prev => 
            prev.includes(studentId) 
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    // [알림 핸들러] 개별 알림 버튼 클릭
    const openSingleNotification = (status) => {
        setNotificationTargets([status]);
        setIsNotifModalOpen(true);
    };

    // [알림 핸들러] 일괄 알림 버튼 클릭
    const openBulkNotification = () => {
        const targets = classPaymentStatus.filter(s => selectedStudentIds.includes(s.student.id));
        if (targets.length === 0) return;
        setNotificationTargets(targets);
        setIsNotifModalOpen(true);
    };


    // [핸들러] 교재 등록
    const handleAddBook = (e) => {
        e.preventDefault();
        if (newBook.name && newBook.price > 0) {
            const id = bookList.reduce((max, b) => Math.max(max, b.id), 0) + 1;
            setBookList(prev => [...prev, { ...newBook, id }]);
            setNewBook({ name: '', price: 0, stock: 0, type: '진도교재' });
            setIsBookModalOpen(false);
            if(logNotification) logNotification('success', '교재 등록 완료', `${newBook.name}이 등록되었습니다.`);
        }
    };

    // [핸들러] 수납 처리
    const handlePaymentSubmit = (e) => {
        e.preventDefault();
        if (!paymentForm.studentId || !paymentForm.bookId) return;

        const selectedBook = bookList.find(b => b.id === Number(paymentForm.bookId));
        const selectedStudent = students.find(s => s.id === Number(paymentForm.studentId));

        if (selectedBook.stock <= 0) {
            alert('재고가 부족합니다.');
            return;
        }

        const newLog = {
            id: Date.now(),
            date: new Date().toISOString().slice(0, 10),
            studentName: selectedStudent.name,
            studentId: selectedStudent.id,
            bookName: selectedBook.name,
            bookId: selectedBook.id,
            amount: selectedBook.price,
            method: paymentForm.method,
            type: paymentForm.channel,
        };
        setPaymentLogs(prev => [newLog, ...prev]);
        setBookList(prev => prev.map(book => book.id === selectedBook.id ? { ...book, stock: book.stock - 1 } : book));
        
        setIsPaymentModalOpen(false);
        setPaymentForm({ ...paymentForm, bookId: '' }); 
        if(logNotification) logNotification('success', '결제 완료', `${selectedStudent.name} - ${selectedBook.name} 결제 처리됨`);
    };

    const toggleClassBook = (classId, bookId) => {
        setClassBookMap(prev => {
            const currentBooks = prev[classId] || [];
            if (currentBooks.includes(bookId)) {
                return { ...prev, [classId]: currentBooks.filter(id => id !== bookId) };
            } else {
                return { ...prev, [classId]: [...currentBooks, bookId] };
            }
        });
    };

    const recommendedBooks = useMemo(() => {
        if (!paymentForm.studentId) return [];
        const student = students.find(s => s.id === Number(paymentForm.studentId));
        if (!student) return [];
        
        const neededBookIds = new Set();
        student.classes.forEach(clsId => {
            (classBookMap[clsId] || []).forEach(bId => neededBookIds.add(bId));
        });
        return bookList.filter(b => neededBookIds.has(b.id));
    }, [paymentForm.studentId, students, classBookMap, bookList]);


    return (
        <div className="space-y-6">
            {/* 상단 탭 네비게이션 */}
            <div className="flex justify-between items-end border-b pb-1">
                <div className="flex space-x-1">
                    {[
                        { id: 'classStatus', label: '🏫 반별 수납 현황', icon: 'users' },
                        { id: 'stock', label: '📚 교재 재고 관리', icon: 'book' },
                        { id: 'payment', label: '💳 결제 내역 조회', icon: 'list' },
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center px-5 py-3 text-sm font-bold transition-all duration-200 rounded-t-lg ${
                                activeTab === tab.id 
                                    ? 'bg-white border-t border-l border-r border-gray-200 text-indigo-600 shadow-[0_2px_0_0_white]' 
                                    : 'bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <Icon name={tab.icon} className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex space-x-2 pb-2">
                    {activeTab === 'classStatus' && (
                        <button 
                            onClick={() => setIsClassSettingModalOpen(true)}
                            className="flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition font-bold text-sm"
                        >
                            <Icon name="settings" className="w-4 h-4 mr-2" />
                            반별 교재 설정
                        </button>
                    )}
                    {activeTab === 'stock' && (
                        <button 
                            onClick={() => setIsBookModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold text-sm"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-2" />
                            교재 등록
                        </button>
                    )}
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-sm"
                    >
                        <Icon name="creditCard" className="w-4 h-4 mr-2" />
                        수납 처리
                    </button>
                </div>
            </div>

            {/* 메인 컨텐츠 영역 */}
            <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-t-0 p-6 min-h-[500px]">
                
                {/* TAB 1: 반별 수납 현황 */}
                {activeTab === 'classStatus' && (
                    <div className="space-y-6">
                        {/* 반 선택 및 일괄 작업 바 */}
                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                            <div className="flex items-center space-x-4">
                                <label className="font-bold text-gray-700">조회할 클래스:</label>
                                <select 
                                    className="border-gray-300 rounded-md shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                                    value={viewClassId || ''}
                                    onChange={(e) => {
                                        setViewClassId(Number(e.target.value));
                                        setSelectedStudentIds([]); // 반 변경 시 선택 초기화
                                    }}
                                >
                                    {classes && classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            
                            {/* ✅ 일괄 발송 버튼 (선택된 학생이 있을 때만 표시) */}
                            {selectedStudentIds.length > 0 && (
                                <div className="flex items-center animate-fadeIn">
                                    <span className="text-sm text-gray-600 mr-3 font-medium">
                                        {selectedStudentIds.length}명 선택됨
                                    </span>
                                    <button 
                                        onClick={openBulkNotification}
                                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-sm shadow-md transition"
                                    >
                                        <Icon name="bell" className="w-4 h-4 mr-2" />
                                        일괄 안내 발송
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 현황 테이블 */}
                        <div className="overflow-hidden border rounded-xl">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        {/* ✅ 체크박스 헤더 */}
                                        <th className="px-6 py-3 w-10">
                                            <input 
                                                type="checkbox" 
                                                onChange={handleSelectAll}
                                                checked={selectedStudentIds.length > 0 && selectedStudentIds.length === classPaymentStatus.filter(s => !s.isFullyPaid).length}
                                                disabled={classPaymentStatus.filter(s => !s.isFullyPaid).length === 0}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">학생명</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">필수 구매 교재</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">총 결제 금액</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">상태</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">안내</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {classPaymentStatus.length > 0 ? classPaymentStatus.map((status, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 transition ${status.isFullyPaid ? 'bg-gray-50/50' : ''}`}>
                                            {/* ✅ 체크박스 셀 */}
                                            <td className="px-6 py-4">
                                                {!status.isFullyPaid && (
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedStudentIds.includes(status.student.id)}
                                                        onChange={() => handleSelectStudent(status.student.id)}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {status.student.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {status.requiredBooks.length > 0 ? (
                                                    status.requiredBooks.map(b => (
                                                        <span key={b.id} className={`inline-block mr-1 mb-1 px-2 py-0.5 rounded text-xs border ${
                                                            status.unpaidBooks.find(ub => ub.id === b.id) 
                                                                ? 'bg-red-50 text-red-600 border-red-200 font-medium' 
                                                                : 'bg-green-50 text-green-600 border-green-200 line-through opacity-60'
                                                        }`}>
                                                            {b.name}
                                                        </span>
                                                    ))
                                                ) : <span className="text-gray-400">지정 교재 없음</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {status.unpaidAmount > 0 ? (
                                                    <span className="text-red-600">{status.unpaidAmount.toLocaleString()}원</span>
                                                ) : (
                                                    <span className="text-gray-400 line-through">{status.totalRequiredAmount.toLocaleString()}원</span>
                                                )}
                                                <span className="text-xs text-gray-400 block font-normal">
                                                    (총 {status.totalRequiredAmount.toLocaleString()}원)
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {status.isFullyPaid ? (
                                                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">완납</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">미납</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {!status.isFullyPaid && (
                                                    <button 
                                                        onClick={() => openSingleNotification(status)}
                                                        className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-2 rounded-full transition"
                                                        title="안내 발송"
                                                    >
                                                        <Icon name="bell" className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                                                해당 클래스에 학생이 없거나 설정된 교재가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: 교재 재고 관리 */}
                {activeTab === 'stock' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">유형</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">교재명</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">단가</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">현재고</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">상태</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {bookList.map(book => (
                                    <tr key={book.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full font-bold
                                                ${book.type === '진도교재' ? 'bg-blue-100 text-blue-800' : 
                                                  book.type === '숙제교재' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {book.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{book.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.price.toLocaleString()}원</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{book.stock}권</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {book.stock < 5 ? 
                                                <span className="text-red-500 font-bold flex items-center"><Icon name="alertCircle" className="w-4 h-4 mr-1"/>주문필요</span> : 
                                                <span className="text-green-600 font-medium">충분</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB 3: 결제 내역 조회 */}
                {activeTab === 'payment' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">일자</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">학생명</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구매 교재</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">결제 금액</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">방법</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구분</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paymentLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{log.studentName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{log.bookName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{log.amount.toLocaleString()}원</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.method}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 text-xs rounded border font-medium ${log.type === '온라인결제' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                {log.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {paymentLogs.length === 0 && (
                                    <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-400">수납 내역이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- Modals --- */}
            
            {/* 0. ✅ 알림 발송 모달 (신규) */}
            <PaymentNotificationModal 
                isOpen={isNotifModalOpen}
                onClose={() => setIsNotifModalOpen(false)}
                targets={notificationTargets}
                logNotification={logNotification}
            />

            {/* 1. 교재 등록 모달 */}
            <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="새 교재 등록">
                <form onSubmit={handleAddBook} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">교재명</label>
                        <input 
                            type="text" 
                            value={newBook.name} 
                            onChange={e => setNewBook({...newBook, name: e.target.value})} 
                            required 
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">교재 유형</label>
                        <select 
                            value={newBook.type} 
                            onChange={e => setNewBook({...newBook, type: e.target.value})} 
                            className="w-full rounded-lg border-gray-300 border p-2.5"
                        >
                            <option value="진도교재">진도교재</option>
                            <option value="숙제교재">숙제교재</option>
                            <option value="기타">기타 부교재</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">판매가 (원)</label>
                            <input 
                                type="number" 
                                value={newBook.price} 
                                onChange={e => setNewBook({...newBook, price: Number(e.target.value)})} 
                                required 
                                className="w-full rounded-lg border-gray-300 border p-2.5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">초기 재고</label>
                            <input 
                                type="number" 
                                value={newBook.stock} 
                                onChange={e => setNewBook({...newBook, stock: Number(e.target.value)})} 
                                required 
                                className="w-full rounded-lg border-gray-300 border p-2.5"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button 
                            type="button"
                            onClick={() => setIsBookModalOpen(false)}
                            className="mr-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                        >
                            취소
                        </button>
                        <button 
                            type="submit" 
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md transition"
                        >
                            등록하기
                        </button>
                    </div>
                </form>
            </Modal>

            {/* 2. 수납 결제 모달 */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="교재 수납 결제">
                <form onSubmit={handlePaymentSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">학생 선택</label>
                        <select 
                            className="w-full rounded-lg border-gray-300 border p-2.5"
                            value={paymentForm.studentId}
                            onChange={e => setPaymentForm({...paymentForm, studentId: e.target.value, bookId: ''})}
                            required
                        >
                            <option value="">학생을 선택해주세요</option>
                            {students && students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
                        </select>
                    </div>

                    {/* 추천 교재 섹션 */}
                    {recommendedBooks.length > 0 && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center">
                                <Icon name="check" className="w-3 h-3 mr-1"/> 필수 구매 대상 교재
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {recommendedBooks.map(b => (
                                    <button
                                        key={b.id} type="button"
                                        onClick={() => setPaymentForm({...paymentForm, bookId: b.id})}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                                            Number(paymentForm.bookId) === b.id 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {b.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">결제할 교재 선택</label>
                        <select 
                            className="w-full rounded-lg border-gray-300 border p-2.5"
                            value={paymentForm.bookId}
                            onChange={e => setPaymentForm({...paymentForm, bookId: e.target.value})}
                            required
                        >
                            <option value="">교재를 선택해주세요</option>
                            {bookList.map(b => (
                                <option key={b.id} value={b.id} disabled={b.stock <= 0}>
                                    {b.name} ({b.price.toLocaleString()}원) {b.stock <= 0 ? '- 품절' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">결제 수단</label>
                            <select 
                                className="w-full rounded-lg border-gray-300 border p-2.5"
                                value={paymentForm.method} 
                                onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
                            >
                                <option value="카드">카드</option>
                                <option value="현금">현금</option>
                                <option value="계좌이체">계좌이체</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">결제 경로</label>
                            <select 
                                className="w-full rounded-lg border-gray-300 border p-2.5"
                                value={paymentForm.channel} 
                                onChange={e => setPaymentForm({...paymentForm, channel: e.target.value})}
                            >
                                <option value="현장결제">현장결제</option>
                                <option value="온라인결제">온라인결제</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button 
                            type="submit" 
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-bold text-lg shadow-lg transition active:scale-95"
                        >
                            {paymentForm.bookId 
                                ? `${bookList.find(b => b.id === Number(paymentForm.bookId)).price.toLocaleString()}원 결제하기` 
                                : '결제하기'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* 3. 반별 교재 설정 모달 */}
            <Modal isOpen={isClassSettingModalOpen} onClose={() => setIsClassSettingModalOpen(false)} title="반별 필수 교재 설정">
                <div className="flex flex-col h-[500px]">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">설정할 반 선택</label>
                        <select 
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-indigo-500"
                            value={selectedClassForSetting || ''}
                            onChange={e => setSelectedClassForSetting(Number(e.target.value))}
                        >
                            {classes && classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto border rounded-xl p-3 bg-gray-50 space-y-2">
                        {selectedClassForSetting ? bookList.map(book => {
                            const isAssigned = (classBookMap[selectedClassForSetting] || []).includes(book.id);
                            return (
                                <div key={book.id} 
                                    onClick={() => toggleClassBook(selectedClassForSetting, book.id)}
                                    className={`flex items-center p-4 rounded-lg cursor-pointer border transition-all duration-200 ${
                                        isAssigned 
                                            ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-sm' 
                                            : 'bg-white border-gray-200 hover:border-indigo-300'
                                    }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                                        isAssigned ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
                                    }`}>
                                        {isAssigned && <Icon name="check" className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-800">{book.name}</div>
                                        <div className="text-sm text-gray-500 mt-0.5">{book.type} · {book.price.toLocaleString()}원</div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                반을 먼저 선택해주세요.
                            </div>
                        )}
                    </div>
                    <div className="pt-4 border-t mt-2 flex justify-end">
                         <button 
                            onClick={() => setIsClassSettingModalOpen(false)} 
                            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-bold transition"
                         >
                             설정 완료
                         </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};