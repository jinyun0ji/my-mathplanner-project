import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import { PaymentNotificationModal } from '../utils/modals/PaymentNotificationModal'; // ✅ 신규 모달 import
import { initialClasses } from '../api/initialData';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isStaffOrTeachingRole } from '../constants/roles';
import { useClassStudents } from '../utils/useClassStudents';

// ✅ [수정] props에 paymentLogs, handleSavePayment 추가
export default function PaymentManagement({ classes, paymentLogs, isPaymentLogsLoading, handleSavePayment, handleUpdatePayment, refreshPaymentLogs, logNotification, userRole, userId }) {

    // --- 1. 초기 데이터 및 상태 ---
    const [materialsByClass, setMaterialsByClass] = useState({});
    const [inventoryBooks, setInventoryBooks] = useState([]);
    const [materialsError, setMaterialsError] = useState('');
    const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('classStatus');

    const [viewClassId, setViewClassId] = useState(() => {
        const firstClass = classes?.[0] ?? initialClasses[0];
        return firstClass ? String(firstClass.id) : null;
    });
    const [selectedClassForSetting, setSelectedClassForSetting] = useState(() => {
        const firstClass = classes?.[0] ?? initialClasses[0];
        return firstClass ? String(firstClass.id) : null;
    });
    const { students: classStudents, isLoading: isLoadingStudents } = useClassStudents(viewClassId);

    // 모달 상태
    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const [isClassSettingModalOpen, setIsClassSettingModalOpen] = useState(false);

    // ✅ 반별 필수 교재 설정 상태
    const [selectedRequiredBookIds, setSelectedRequiredBookIds] = useState([]);
    const [requiredBookIdsByClass, setRequiredBookIdsByClass] = useState({});
    const [isSavingRequiredBooks, setIsSavingRequiredBooks] = useState(false);


    // ✅ 알림 모달 상태 추가
    const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
    const [notificationTargets, setNotificationTargets] = useState([]); // 알림 보낼 대상 목록

    // 폼 상태
    const [newBook, setNewBook] = useState({ title: '', price: 0, stock: 0, type: '진도교재' });
    const [paymentForm, setPaymentForm] = useState({
        studentId: '',
        bookId: '',
        method: '간편결제',
        channel: '간편결제',
    });
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    const [editingPaymentForm, setEditingPaymentForm] = useState({
        amount: '',
        method: '간편결제',
        memo: '',
    });
    const [useEasyPay, setUseEasyPay] = useState(true);

    // ✅ 체크박스 선택 상태 (studentId 목록)
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const navigate = useNavigate();

    const effectiveClasses = useMemo(
        () => (Array.isArray(classes) && classes.length > 0 ? classes : initialClasses),
        [classes]
    );

    // ✅ classes 데이터에 requiredBookIds가 포함되어 있으면 초기 맵 구성 (없으면 비어있음)
    useEffect(() => {
        const next = {};
        (Array.isArray(effectiveClasses) ? effectiveClasses : []).forEach((c) => {
            const cid = String(c?.id);
            const ids = c?.requiredBookIds;
            if (cid && Array.isArray(ids)) {
                next[cid] = ids.map(String);
            }
        });
        // 기존 값 보존 + 새로 들어온 값만 병합
        setRequiredBookIdsByClass((prev) => ({ ...prev, ...next }));
    }, [effectiveClasses]);
    const effectiveStudents = useMemo(
        () => (Array.isArray(classStudents) && classStudents.length > 0 ? classStudents : []),
        [classStudents]
    );
    const effectivePaymentLogs = useMemo(
        () => (Array.isArray(paymentLogs) ? paymentLogs : []),
        [paymentLogs]
    );

    const normalizeBook = useCallback((book) => {
        const price = Number.isFinite(book?.price) ? book.price : 0;
        const stock = Number.isFinite(book?.stock) ? book.stock : 0;
        return {
            ...book,
            title: book?.title || book?.name || '교재명 없음',
            price,
            stock,
            active: book?.active !== false,
        };
    }, []);

    const getBookTitle = useCallback((book) => book?.title || book?.name || '교재명 없음', []);
    const getBookPrice = useCallback((book) => (Number.isFinite(book?.price) ? book.price : 0), []);
    const getBookStock = useCallback((book) => (Number.isFinite(book?.stock) ? book.stock : 0), []);

    const studentNameMap = useMemo(() => {
        return effectiveStudents.reduce((acc, student) => {
            acc[String(student.id)] = student;
            return acc;
        }, {});
    }, [effectiveStudents]);

    const getLogDate = useCallback((log) => {
        if (log?.date) return log.date;
        if (log?.createdAt?.toDate) {
            return log.createdAt.toDate().toISOString().slice(0, 10);
        }
        return '';
    }, []);

    const getLogStudentName = useCallback((log) => {
        return log?.studentName || studentNameMap[String(log?.studentId)]?.name || '학생 미확인';
    }, [studentNameMap]);

    const getLogBookName = useCallback((log) => {
        if (log?.bookName) return log.bookName;
        if (log?.bookTitle) return log.bookTitle;
        const firstItem = Array.isArray(log?.items) ? log.items[0] : null;
        return firstItem?.title || firstItem?.name || '교재 미확인';
    }, []);

    const getPaymentTypeLabel = useCallback((type) => {
        if (type === 'book') return '교재비';
        if (type === 'tuition') return '수업료';
        return type || '-';
    }, []);

    const getPaymentTypeBadge = useCallback((type) => {
        if (type === 'book') return 'bg-blue-50 text-[#334a91] border-blue-200';
        if (type === 'tuition') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }, []);

    useEffect(() => {
        if (!effectiveClasses || effectiveClasses.length === 0) return;
        setViewClassId(prev => prev || String(effectiveClasses[0].id));
        setSelectedClassForSetting(prev => prev || String(effectiveClasses[0].id));
    }, [effectiveClasses]);

    // const handlePayment = async () => {
    // const response = await PortOne.requestPayment({
    //     storeId: "store-본인상점ID",
    //     paymentId: `payment-${crypto.randomUUID()}`,
    //     orderName: "11월 수학 수강료",
    //     totalAmount: 350000,
    //     currency: "CURRENCY_KRW",
    //     channelKey: "channel-본인채널키", // 카카오페이 등 설정된 채널
    //     payMethod: "EASY_PAY", // 간편결제
    // });

    // if (response.code != null) {
    //     alert("결제 실패: " + response.message);
    //     return;
    // }

    // // 결제 성공! -> 여기서 Firebase에 '완납'으로 상태 업데이트
    // // 주의: 실제 서비스에선 서버(Cloud Functions)에서 결제 검증(Web Hook)을 해야 안전합니다.
    // updatePaymentStatusToFirebase(studentId, '완납');
    // };


    // --- 2. 로직 및 헬퍼 함수 ---
    const canReadMaterials = Boolean(userId) && isStaffOrTeachingRole(userRole);

    const fetchMaterialsByClass = useCallback(async (classId) => {
        if (!canReadMaterials) {
            return [];
        }
        if (!classId) return [];
        try {
            setIsMaterialsLoading(true);
            const materialsQuery = query(
                collection(db, 'books'),
                where('active', '==', true),
                where('classId', 'in', [String(classId), 'shared']),
            );
            const snapshot = await getDocs(materialsQuery);
            const materials = snapshot.docs.map((docSnap) => normalizeBook({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            setMaterialsByClass(prev => ({ ...prev, [String(classId)]: materials }));
            setMaterialsError('');
            return materials;
        } catch (error) {
            console.error('[Firestore READ ERROR]', error);
            setMaterialsError('Firestore 권한을 확인해주세요.');
            if (logNotification) {
                logNotification('error', '교재 조회 실패', 'Firestore 권한 또는 네트워크를 확인해주세요.');
            }
            setMaterialsByClass(prev => ({ ...prev, [String(classId)]: [] }));
            return [];
        } finally {
            setIsMaterialsLoading(false);
        }
    }, [canReadMaterials, logNotification, normalizeBook]);

    const fetchInventoryBooks = useCallback(async () => {
        if (!canReadMaterials) {
            return [];
        }
        try {
            setIsInventoryLoading(true);
            const materialsQuery = query(
                collection(db, 'books'),
                where('active', '==', true),
            );
            const snapshot = await getDocs(materialsQuery);
            const materials = snapshot.docs.map((docSnap) => normalizeBook({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            setInventoryBooks(materials);
            setMaterialsError('');
            return materials;
        } catch (error) {
            console.error('[Firestore READ ERROR]', error);
            setMaterialsError('Firestore 권한을 확인해주세요.');
            if (logNotification) {
                logNotification('error', '교재 조회 실패', 'Firestore 권한 또는 네트워크를 확인해주세요.');
            }
            setInventoryBooks([]);
            return [];
        } finally {
            setIsInventoryLoading(false);
        }
    }, [canReadMaterials, logNotification, normalizeBook]);

    useEffect(() => {
        if (!viewClassId || !canReadMaterials) return;
        fetchMaterialsByClass(viewClassId);
    }, [viewClassId, fetchMaterialsByClass, canReadMaterials]);

    useEffect(() => {
        if (!selectedClassForSetting || !canReadMaterials) return;
        fetchMaterialsByClass(selectedClassForSetting);
    }, [selectedClassForSetting, fetchMaterialsByClass, canReadMaterials]);

    useEffect(() => {
        if (!paymentForm.studentId || !canReadMaterials) return;
        const student = effectiveStudents.find(s => s.id === paymentForm.studentId);
        if (!student) return;
        const classIds = Array.isArray(student.classes)
            ? student.classes
            : (Array.isArray(student.classIds) ? student.classIds : []);
        classIds.forEach((classId) => {
            if (!materialsByClass[String(classId)]) {
                fetchMaterialsByClass(classId);
            }
        });
    }, [paymentForm.studentId, effectiveStudents, materialsByClass, fetchMaterialsByClass, canReadMaterials]);

    useEffect(() => {
        if (!canReadMaterials) return;
        fetchInventoryBooks();
    }, [canReadMaterials, fetchInventoryBooks]);

    const classMaterials = useMemo(() => {
        if (!viewClassId) return [];
        const materials = materialsByClass[String(viewClassId)];
        return Array.isArray(materials) ? materials : [];
    }, [materialsByClass, viewClassId]);

    // ✅ 반별 필수 교재 설정 모달에서 선택 상태 초기화/동기화
    useEffect(() => {
        if (!isClassSettingModalOpen) return;
        if (!selectedClassForSetting) return;

        const cid = String(selectedClassForSetting);
        const saved = requiredBookIdsByClass[cid];
        if (Array.isArray(saved) && saved.length >= 0) {
            // 저장된 필수 교재가 있으면 그 값을 사용 (빈 배열도 허용: "필수 교재 없음" 상태)
            setSelectedRequiredBookIds(saved.map(String));
            return;
        }

        // 저장값이 없다면 기존 동작 유지: 해당 반의 교재 전체를 기본 선택
        const books = materialsByClass[cid];
        const fallbackIds = Array.isArray(books) ? books.map((b) => String(b?.id)).filter(Boolean) : [];
        setSelectedRequiredBookIds(fallbackIds);
    }, [isClassSettingModalOpen, selectedClassForSetting, requiredBookIdsByClass, materialsByClass]);

    // [로직] 특정 반의 학생별 납부 현황 계산
    const classPaymentStatus = useMemo(() => {
        if (!viewClassId) return [];

        const targetClass = effectiveClasses.find(c => String(c.id) === String(viewClassId));
        if (!targetClass) return [];

        const allBooks = Array.isArray(classMaterials) ? classMaterials : [];

        // ✅ 반별로 설정된 필수 교재가 있으면 그 목록만 필수로 간주 (없으면 기존처럼 전체 교재)
        const cid = String(viewClassId);
        const requiredIds = requiredBookIdsByClass?.[cid];
        const requiredBooks = Array.isArray(requiredIds)
            ? allBooks.filter((b) => requiredIds.map(String).includes(String(b?.id)))
            : allBooks;
        if (requiredBooks.length === 0) return [];
        const totalRequiredAmount = requiredBooks.reduce((sum, b) => sum + getBookPrice(b), 0);

        const classStudentIds = Array.isArray(targetClass.students) ? targetClass.students : [];
        return classStudentIds.map(studentId => {
            const student = effectiveStudents.find(s => s.id === studentId);
            if (!student) return null;

            const paidBookIds = effectivePaymentLogs
                .filter(log => log.studentId === studentId)
                .flatMap(log => {
                    if (Array.isArray(log.items)) {
                        return log.items.map(item => String(item.bookId));
                    }
                    if (log.bookId) {
                        return [String(log.bookId)];
                    }
                    return [];
                });

            const unpaidBooks = requiredBooks.filter(b => !paidBookIds.includes(String(b.id)));
            const unpaidAmount = unpaidBooks.reduce((sum, b) => sum + getBookPrice(b), 0);
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

    }, [viewClassId, effectiveClasses, effectiveStudents, classMaterials, effectivePaymentLogs , requiredBookIdsByClass]);

    const classPaymentStatusList = useMemo(
        () => (Array.isArray(classPaymentStatus) ? classPaymentStatus : []),
        [classPaymentStatus]
    );

    // [체크박스 핸들러] 전체 선택/해제
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // 미납이 있는 학생만 선택
            const unpaidStudentIds = classPaymentStatusList
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
        const targets = classPaymentStatusList.filter(s => selectedStudentIds.includes(s.student.id));
        if (targets.length === 0) return;
        setNotificationTargets(targets);
        setIsNotifModalOpen(true);
    };


    const availableBooks = useMemo(() => {
        if (!paymentForm.studentId) {
            return classMaterials;
        }
        const student = effectiveStudents.find(s => s.id === paymentForm.studentId);
        if (!student) return classMaterials;
        const classIds = Array.isArray(student.classes)
            ? student.classes
            : (Array.isArray(student.classIds) ? student.classIds : []);
        const seen = new Map();
        classIds.forEach((classId) => {
            (materialsByClass[String(classId)] || []).forEach((book) => {
                if (book?.active === false) return;
                const key = String(book.id);
                if (!seen.has(key)) {
                    seen.set(key, normalizeBook(book));
                }
            });
        });
        return Array.from(seen.values());
    }, [paymentForm.studentId, effectiveStudents, materialsByClass, classMaterials, normalizeBook]);

    // [핸들러] 교재 등록
    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!canReadMaterials) {
            alert('교재 조회 권한이 없습니다.');
            return;
        }
        if (newBook.title && Number.isFinite(newBook.price) && newBook.price >= 0) {
            try {
                await addDoc(collection(db, 'books'), {
                    classId: 'shared',
                    title: newBook.title,
                    price: newBook.price,
                    stock: newBook.stock,
                    type: newBook.type,
                    active: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                if (viewClassId) {
                    await fetchMaterialsByClass(viewClassId);
                }
                await fetchInventoryBooks();
                setNewBook({ title: '', price: 0, stock: 0, type: '진도교재' });
                setIsBookModalOpen(false);
                if (logNotification) logNotification('success', '교재 등록 완료', `${newBook.title}이 등록되었습니다.`);
            } catch (error) {
                console.error('[Firestore WRITE ERROR]', error);
                alert('교재 등록에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
            }
        }
    };

    // [핸들러] 수납 처리 (App.jsx로 데이터 전달)
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentForm.studentId || !paymentForm.bookId) return;

        const selectedBook = availableBooks.find(b => String(b.id) === String(paymentForm.bookId));
        const selectedStudent = effectiveStudents.find(s => s.id === paymentForm.studentId);

        if (!selectedBook) return;
         const stockCount = getBookStock(selectedBook);
        if (stockCount <= 0) {
            alert('재고가 부족합니다.');
            return;
        }

        const bookPrice = getBookPrice(selectedBook);
        const classIdCandidate = selectedBook.classId && selectedBook.classId !== 'shared'
            ? selectedBook.classId
            : (selectedStudent?.classIds?.[0] || selectedStudent?.classes?.[0] || viewClassId);
        if (!classIdCandidate) {
            alert('반 정보가 없어 결제를 저장할 수 없습니다.');
            return;
        }
        const selectedBookTitle = getBookTitle(selectedBook);
        const newLog = {
            studentId: selectedStudent.id,
            classId: String(classIdCandidate),
            amount: bookPrice,
            method: paymentForm.method,
            type: 'book',
            channel: paymentForm.channel,
            status: 'paid',
            studentName: selectedStudent.name,
            bookName: selectedBookTitle,
            items: [{
                bookId: selectedBook.id,
                quantity: 1,
                price: bookPrice,
                title: selectedBookTitle,
            }],
        };

        // ✅ [수정] App.jsx의 핸들러 호출
        setIsSubmittingPayment(true);
        try {
            const result = await handleSavePayment(newLog);
            if (!result?.success) {
                alert('결제 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            if (refreshPaymentLogs) {
                await refreshPaymentLogs();
            }
        } finally {
            setIsSubmittingPayment(false);
        }

        // 재고 차감 (로컬 상태)
        setMaterialsByClass(prev => {
            const classId = selectedBook.classId;
            if (!classId || !prev[String(classId)]) return prev;
            return {
                ...prev,
                [String(classId)]: prev[String(classId)].map(book =>
                    book.id === selectedBook.id
                        ? { ...book, stock: Number.isFinite(book.stock) ? book.stock - 1 : 0 }
                        : book
                ),
            };
        });
        setInventoryBooks(prev => (
            Array.isArray(prev)
                ? prev.map(book => (
                    book.id === selectedBook.id
                        ? { ...book, stock: Number.isFinite(book.stock) ? book.stock - 1 : 0 }
                        : book
                ))
                : prev
        ));

        setIsPaymentModalOpen(false);
        setPaymentForm({ ...paymentForm, bookId: '' });
        setActiveTab('payment');
        navigate('/payment');
    };

    const recommendedBooks = useMemo(() => {
        if (!paymentForm.studentId) return [];
        return availableBooks;
    }, [paymentForm.studentId, availableBooks]);

    const paymentLogsList = useMemo(
        () => (Array.isArray(effectivePaymentLogs) ? effectivePaymentLogs : []),
        [effectivePaymentLogs]
    );

    const recommendedBooksList = useMemo(
        () => (Array.isArray(recommendedBooks) ? recommendedBooks : []),
        [recommendedBooks]
    );

    const handleMethodChange = (value) => {
        setUseEasyPay(value === '간편결제');
        setPaymentForm(prev => ({
            ...prev,
            method: value,
            channel: value === '간편결제' ? '간편결제' : (prev.channel === '간편결제' ? '현장결제' : prev.channel)
        }));
    };

    const handleChannelChange = (value) => {
        setUseEasyPay(value === '간편결제');
        setPaymentForm(prev => ({
            ...prev,
            channel: value,
            method: value === '간편결제' ? '간편결제' : (prev.method === '간편결제' ? '카드' : prev.method)
        }));
    };

    const startEditingPayment = (log) => {
        setEditingPaymentId(log.id);
        setEditingPaymentForm({
            amount: typeof log.amount === 'number' ? log.amount : Number(log.amount) || 0,
            method: log.method || '간편결제',
            memo: log.memo || '',
        });
    };

    const cancelEditingPayment = () => {
        setEditingPaymentId(null);
    };

    const handlePaymentUpdateSubmit = async (paymentId) => {
        if (!handleUpdatePayment) return;
        const amountValue = Number(editingPaymentForm.amount);
        if (!Number.isFinite(amountValue)) {
            alert('결제 금액을 확인해주세요.');
            return;
        }
        await handleUpdatePayment(paymentId, {
            amount: amountValue,
            method: editingPaymentForm.method,
            memo: editingPaymentForm.memo || '',
        });
        setEditingPaymentId(null);
    };


    // ✅ 반별 필수 교재 저장
    const saveRequiredBooksForClass = useCallback(async () => {
        if (!selectedClassForSetting) {
            alert('반을 선택해주세요.');
            return;
        }
        const cid = String(selectedClassForSetting);

        try {
            setIsSavingRequiredBooks(true);
            // classes 문서에 필수 교재 id 목록 저장
            await updateDoc(doc(db, 'classes', cid), {
                requiredBookIds: (Array.isArray(selectedRequiredBookIds) ? selectedRequiredBookIds : []).map(String),
                updatedAt: serverTimestamp(),
            });

            setRequiredBookIdsByClass((prev) => ({
                ...prev,
                [cid]: (Array.isArray(selectedRequiredBookIds) ? selectedRequiredBookIds : []).map(String),
            }));

            setIsClassSettingModalOpen(false);
        } catch (e) {
            console.error('[payment] FAIL: save required books', e);
            alert('필수 교재 저장에 실패했습니다. 콘솔 로그를 확인해주세요.');
        } finally {
            setIsSavingRequiredBooks(false);
        }
    }, [selectedClassForSetting, selectedRequiredBookIds]);
return (
        <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <Icon name="info" className="w-5 h-5 mt-0.5" />
                <div>
                    <p className="font-bold">교재비 전용 수납 화면입니다.</p>
                    <p className="mt-1 text-amber-700">학원비/수업료는 별도로 청구되며, 여기서는 교재비만 결제·안내할 수 있습니다.</p>
                </div>
            </div>

            {/* 상단 탭 네비게이션 */}
             <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-1 sticky top-0 bg-white z-10 pt-1">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'classStatus', label: '🏫 반별 수납 현황', icon: 'users' },
                        { id: 'stock', label: '📚 교재 재고 관리', icon: 'book' },
                        { id: 'payment', label: '💳 결제 내역 조회', icon: 'list' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center px-4 sm:px-5 py-3 text-sm font-bold transition-all duration-200 rounded-t-lg w-full sm:w-auto min-w-[180px] ${
                                activeTab === tab.id
                                    ? 'bg-white border-t border-l border-r border-gray-200 text-[#455fab] shadow-[0_2px_0_0_white]'
                                    : 'bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <Icon name={tab.icon} className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="hidden sm:flex flex-wrap gap-2 pb-2 justify-end">
                    {activeTab === 'classStatus' && (
                        <button
                            onClick={() => setIsClassSettingModalOpen(true)}
                            className="flex items-center px-3 py-2 bg-[#eef2ff] text-[#334a91] rounded-lg hover:bg-[#cfd8ff] transition font-bold text-sm w-full sm:w-auto justify-center"
                        >
                            <Icon name="settings" className="w-4 h-4 mr-2" />
                            반별 교재 설정
                        </button>
                    )}
                    {activeTab === 'stock' && (
                        <button
                            onClick={() => setIsBookModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-[#455fab] text-white rounded-lg hover:bg-[#3b5198] transition font-bold text-sm w-full sm:w-auto justify-center"
                        >
                            <Icon name="plus" className="w-4 h-4 mr-2" />
                            교재 등록
                        </button>
                    )}
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-sm w-full sm:w-auto justify-center"
                    >
                        <Icon name="creditCard" className="w-4 h-4 mr-2" />
                        수납 처리
                    </button>
                </div>

                <div className="sm:hidden grid grid-cols-2 gap-2">
                    {activeTab === 'classStatus' && (
                        <button
                            onClick={() => setIsClassSettingModalOpen(true)}
                            className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-[#f1f4ff] text-[#334a91] border border-[#eef2ff]"
                        >
                            반별 교재 설정
                        </button>
                    )}
                    {activeTab === 'stock' && (
                        <button
                            onClick={() => setIsBookModalOpen(true)}
                            className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-[#f1f4ff] text-[#334a91] border border-[#eef2ff]"
                        >
                            교재 등록
                        </button>
                    )}
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full text-sm font-bold px-3 py-2 rounded-lg bg-green-600 text-white shadow"
                    >
                        수납 처리
                    </button>
                </div>
            </div>

            {/* 메인 컨텐츠 영역 */}
            <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-t-0 p-6 min-h-[500px]">
                {materialsError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {materialsError}
                    </div>
                )}
                {/* TAB 1: 반별 수납 현황 */}
                {activeTab === 'classStatus' && (
                    <div className="space-y-6">
                        {/* 반 선택 및 일괄 작업 바 */}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-gray-50 p-4 rounded-lg border">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
                                <label className="font-bold text-gray-700">조회할 클래스:</label>
                                <select
                                    className="border-gray-300 rounded-md shadow-sm p-2 border focus:ring-[#455fab] focus:border-[#455fab] w-full sm:w-auto"
                                    value={viewClassId ?? ''}
                                    onChange={(e) => {
                                        setViewClassId(e.target.value);
                                        setSelectedStudentIds([]); // 반 변경 시 선택 초기화
                                    }}
                                >
                                    {Array.isArray(effectiveClasses) && effectiveClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                        className="flex items-center px-4 py-2 bg-[#455fab] text-white rounded-lg hover:bg-[#3b5198] font-bold text-sm shadow-md transition"
                                    >
                                        <Icon name="bell" className="w-4 h-4 mr-2" />
                                        일괄 안내 발송
                                    </button>
                                </div>
                            )}
                        </div>

                        {isLoadingStudents && (
                            <p className="text-xs text-gray-400 mb-3">학생 목록을 불러오는 중입니다...</p>
                        )}
                        {isMaterialsLoading && (
                            <p className="text-xs text-gray-400 mb-3">교재 정보를 불러오는 중입니다...</p>
                        )}

                        {/* 현황 테이블 */}
                        <div className="overflow-hidden border rounded-xl hidden md:block">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        {/* ✅ 체크박스 헤더 */}
                                        <th className="px-6 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAll}
                                                checked={selectedStudentIds.length > 0 && selectedStudentIds.length === classPaymentStatusList.filter(s => !s.isFullyPaid).length}
                                                disabled={classPaymentStatusList.filter(s => !s.isFullyPaid).length === 0}
                                                className="rounded border-gray-300 text-[#455fab] focus:ring-[#455fab]"
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
                                    {classPaymentStatusList.length > 0 ? classPaymentStatusList.map((status, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 transition ${status.isFullyPaid ? 'bg-gray-50/50' : ''}`}>
                                            {/* ✅ 체크박스 셀 */}
                                            <td className="px-6 py-4">
                                                {!status.isFullyPaid && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudentIds.includes(status.student.id)}
                                                        onChange={() => handleSelectStudent(status.student.id)}
                                                        className="rounded border-gray-300 text-[#455fab] focus:ring-[#455fab]"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {status.student.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {Array.isArray(status.requiredBooks) && status.requiredBooks.length > 0 ? (
                                                    status.requiredBooks.map(b => (
                                                        <span key={b.id} className={`inline-block mr-1 mb-1 px-2 py-0.5 rounded text-xs border ${
                                                            status.unpaidBooks.find(ub => String(ub.id) === String(b.id))
                                                                ? 'bg-red-50 text-red-600 border-red-200 font-medium'
                                                                : 'bg-green-50 text-green-600 border-green-200 line-through opacity-60'
                                                        }`}>
                                                            {getBookTitle(b)}
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
                                                        className="text-[#455fab] hover:text-[#334a91] hover:bg-[#f1f4ff] p-2 rounded-full transition"
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

                        <div className="grid gap-3 md:hidden">
                            {classPaymentStatusList.length > 0 ? (
                                classPaymentStatusList.map((status, idx) => (
                                    <div key={idx} className={`border rounded-xl p-4 shadow-sm bg-white space-y-3 ${status.isFullyPaid ? 'bg-gray-50' : ''}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-base font-bold text-gray-900">{status.student.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">총 {status.totalRequiredAmount.toLocaleString()}원</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!status.isFullyPaid && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudentIds.includes(status.student.id)}
                                                        onChange={() => handleSelectStudent(status.student.id)}
                                                        className="rounded border-gray-300 text-[#455fab] focus:ring-[#455fab]"
                                                    />
                                                )}
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${status.isFullyPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {status.isFullyPaid ? '완납' : '미납'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(status.requiredBooks) && status.requiredBooks.length > 0 ? status.requiredBooks.map(b => (
                                                <span key={b.id} className={`px-2 py-1 text-[11px] rounded border ${
                                                    status.unpaidBooks.find(ub => String(ub.id) === String(b.id))
                                                        ? 'bg-red-50 text-red-600 border-red-200'
                                                        : 'bg-green-50 text-green-600 border-green-200 line-through opacity-70'
                                                }`}>
                                                    {getBookTitle(b)}
                                                </span>
                                            )) : <span className="text-xs text-gray-400">지정 교재 없음</span>}
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <Icon name="creditCard" className="w-4 h-4" />
                                                {status.unpaidAmount > 0 ? (
                                                    <span className="font-bold text-red-600">{status.unpaidAmount.toLocaleString()}원 미납</span>
                                                ) : (
                                                    <span className="text-gray-400 line-through">{status.totalRequiredAmount.toLocaleString()}원</span>
                                                )}
                                            </div>
                                            {!status.isFullyPaid && (
                                                <button
                                                    onClick={() => openSingleNotification(status)}
                                                    className="text-[#455fab] hover:text-[#334a91] text-sm font-semibold flex items-center gap-1"
                                                >
                                                    <Icon name="bell" className="w-4 h-4" /> 안내
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 py-6 border rounded-xl bg-white">
                                    해당 클래스에 학생이 없거나 설정된 교재가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: 교재 재고 관리 */}
                {activeTab === 'stock' && (
                    <div className="space-y-3">
                        {!canReadMaterials && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                교재 재고 조회 권한이 없습니다. 관리자 권한을 확인해주세요.
                            </div>
                        )}
                        {isInventoryLoading && (
                        <p className="text-xs text-gray-400">교재 재고를 불러오는 중입니다...</p>
                    )}
                    <div className="overflow-x-auto hidden md:block">
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
                                {Array.isArray(inventoryBooks) && inventoryBooks.map(book => (
                                    <tr key={book.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs rounded-full font-bold
                                                ${book.type === '진도교재' ? 'bg-blue-100 text-blue-800' :
                                                  book.type === '숙제교재' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {book.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getBookTitle(book)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getBookPrice(book).toLocaleString()}원</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#455fab]">{getBookStock(book)}권</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {getBookStock(book) < 5 ?
                                                <span className="text-red-500 font-bold flex items-center"><Icon name="alertCircle" className="w-4 h-4 mr-1"/>주문필요</span> :
                                                <span className="text-green-600 font-medium">충분</span>}
                                        </td>
                                    </tr>
                                ))}
                                {(!Array.isArray(inventoryBooks) || inventoryBooks.length === 0) && !isInventoryLoading && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                                            등록된 교재가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="grid gap-3 md:hidden">
                        {Array.isArray(inventoryBooks) && inventoryBooks.map(book => (
                            <div key={book.id} className="border rounded-xl p-4 shadow-sm bg-white space-y-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-base font-bold text-gray-900">{getBookTitle(book)}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{book.type}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-[11px] rounded-full font-bold
                                                ${book.type === '진도교재' ? 'bg-blue-100 text-blue-800' :
                                                  book.type === '숙제교재' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {book.type}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span className="font-semibold">{getBookPrice(book).toLocaleString()}원</span>
                                    <span className="font-bold text-[#334a91]">{getBookStock(book)}권</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {getBookStock(book) < 5 ? (
                                        <span className="text-red-500 font-bold flex items-center gap-1"><Icon name="alertCircle" className="w-4 h-4" /> 주문필요</span>
                                    ) : (
                                        <span className="text-green-600 font-medium">재고 충분</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {(!Array.isArray(inventoryBooks) || inventoryBooks.length === 0) && !isInventoryLoading && (
                            <div className="text-center text-gray-500 py-6 border rounded-xl bg-white">
                                등록된 교재가 없습니다.
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* TAB 3: 결제 내역 조회 */}
                {activeTab === 'payment' && (
                    <div className="space-y-3">
                    {isPaymentLogsLoading && (
                        <p className="text-xs text-gray-400">결제 내역을 불러오는 중입니다...</p>
                    )}
                        <div className="overflow-x-auto hidden md:block">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">일자</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">학생명</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구매 교재</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">결제 금액</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">방법</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">구분</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">메모</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">작업</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paymentLogsList.map(log => {
                                    const isEditing = editingPaymentId === log.id;
                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => {
                                                if (!isEditing) startEditingPayment(log);
                                            }}
                                            className={`transition ${isEditing ? 'bg-[#f1f4ff]/40' : 'hover:bg-gray-50'} ${isEditing ? '' : 'cursor-pointer'}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getLogDate(log)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{getLogStudentName(log)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{getLogBookName(log)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#455fab]">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editingPaymentForm.amount}
                                                        onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700"
                                                    />
                                                ) : (
                                                    `${Number.isFinite(log.amount) ? log.amount.toLocaleString() : '0'}원`
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {isEditing ? (
                                                    <select
                                                        value={editingPaymentForm.method}
                                                        onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                                                    >
                                                        <option value="간편결제">간편결제</option>
                                                        <option value="카드">카드</option>
                                                        <option value="현금">현금</option>
                                                        <option value="계좌이체">계좌이체</option>
                                                    </select>
                                                ) : (
                                                    log.method
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 py-1 text-xs rounded border font-medium ${getPaymentTypeBadge(log.type)}`}>
                                                    {getPaymentTypeLabel(log.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editingPaymentForm.memo}
                                                        onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, memo: e.target.value }))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm"
                                                    />
                                                ) : (
                                                    log.memo || '-'
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePaymentUpdateSubmit(log.id);
                                                            }}
                                                            className="rounded-md bg-[#455fab] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3b5198]"
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                cancelEditingPayment();
                                                            }}
                                                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">클릭하여 수정</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paymentLogsList.length === 0 && (
                                    <tr><td colSpan="8" className="px-6 py-10 text-center text-gray-400">해당 클래스에 결제 내역이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid gap-3 md:hidden">
                        {paymentLogsList.length > 0 ? paymentLogsList.map(log => {
                            const isEditing = editingPaymentId === log.id;
                            return (
                                <div
                                    key={log.id}
                                    onClick={() => {
                                        if (!isEditing) startEditingPayment(log);
                                    }}
                                    className={`border rounded-xl p-4 shadow-sm space-y-3 transition ${isEditing ? 'bg-[#f1f4ff]/40' : 'bg-white hover:bg-gray-50'} ${isEditing ? '' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-base font-bold text-gray-900">{getLogStudentName(log)}</p>
                                            <p className="text-xs text-gray-500">{getLogDate(log)}</p>
                                        </div>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editingPaymentForm.amount}
                                                onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-[#334a91]"
                                            />
                                        ) : (
                                            <span className="text-sm font-bold text-[#334a91]">{Number.isFinite(log.amount) ? log.amount.toLocaleString() : '0'}원</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700">{getLogBookName(log)}</p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 gap-3">
                                        {isEditing ? (
                                            <select
                                                value={editingPaymentForm.method}
                                                onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                                            >
                                                <option value="간편결제">간편결제</option>
                                                <option value="카드">카드</option>
                                                <option value="현금">현금</option>
                                                <option value="계좌이체">계좌이체</option>
                                            </select>
                                        ) : (
                                            <span>{log.method}</span>
                                        )}
                                        <span className={`px-2 py-1 rounded border font-medium ${getPaymentTypeBadge(log.type)}`}>
                                            {getPaymentTypeLabel(log.type)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editingPaymentForm.memo}
                                                onChange={(e) => setEditingPaymentForm(prev => ({ ...prev, memo: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder="메모"
                                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                                            />
                                        ) : (
                                            <span>{log.memo ? `메모: ${log.memo}` : '메모 없음'}</span>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePaymentUpdateSubmit(log.id);
                                                }}
                                                className="flex-1 rounded-md bg-[#455fab] px-3 py-2 text-xs font-bold text-white hover:bg-[#3b5198]"
                                            >
                                                저장
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    cancelEditingPayment();
                                                }}
                                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    )}
                                    {!isEditing && (
                                        <div className="text-[11px] text-gray-400">카드를 눌러 수정</div>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="text-center text-gray-400 py-6 border rounded-xl bg-white">
                                해당 클래스에 결제 내역이 없습니다.
                            </div>
                        )}
                    </div>
                    </div>
                )}
            </div>

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
                            value={newBook.title}
                            onChange={e => setNewBook({...newBook, title: e.target.value})}
                            required
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-[#455fab]"
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
                            className="px-6 py-2 bg-[#455fab] text-white rounded-lg hover:bg-[#3b5198] font-bold shadow-md transition"
                        >
                            등록하기
                        </button>
                    </div>
                </form>
            </Modal>

            {/* 2. 수납 결제 모달 */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="교재 수납 결제">
                <form onSubmit={handlePaymentSubmit} className="space-y-5">
                     <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                        <Icon name="creditCard" className="w-5 h-5 mt-0.5" />
                        <div>
                            <p className="font-bold">학원비는 제외하고 교재비만 결제합니다.</p>
                            <p className="mt-1">간편결제 링크를 발송하면 학부모가 모바일로 바로 결제할 수 있어요.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">학생 선택</label>
                        <select
                            className="w-full rounded-lg border-gray-300 border p-2.5"
                            value={paymentForm.studentId}
                            onChange={e => setPaymentForm({...paymentForm, studentId: e.target.value, bookId: ''})}
                            required
                        >
                            <option value="">학생을 선택해주세요</option>
                            {Array.isArray(effectiveStudents) && effectiveStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school})</option>)}
                        </select>
                    </div>

                    {/* 추천 교재 섹션 */}
                    {recommendedBooksList.length > 0 && (
                        <div className="bg-[#f1f4ff] p-4 rounded-lg border border-[#eef2ff]">
                            <p className="text-xs font-bold text-[#334a91] mb-2 flex items-center">
                                <Icon name="check" className="w-3 h-3 mr-1"/> 필수 구매 대상 교재
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {recommendedBooksList.map(b => (
                                    <button
                                        key={b.id} type="button"
                                        onClick={() => setPaymentForm({...paymentForm, bookId: b.id})}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                                            String(paymentForm.bookId) === String(b.id)
                                                ? 'bg-[#455fab] text-white border-[#455fab] shadow-md'
                                                : 'bg-white text-[#455fab] border-[#cfd8ff] hover:bg-[#f1f4ff]'
                                        }`}
                                    >
                                        {getBookTitle(b)}
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
                            {Array.isArray(availableBooks) && availableBooks.map(b => (
                                <option key={b.id} value={b.id} disabled={getBookStock(b) <= 0}>
                                    {getBookTitle(b)} ({getBookPrice(b).toLocaleString()}원) {getBookStock(b) <= 0 ? '- 품절' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-bold text-gray-700">결제 수단</label>
                                <label className="flex items-center text-xs text-emerald-700 font-bold cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={useEasyPay}
                                        onChange={(e) => handleMethodChange(e.target.checked ? '간편결제' : '카드')}
                                        className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded"
                                    />
                                    간편결제 사용
                                </label>
                            </div>
                            <select
                                className="w-full rounded-lg border-gray-300 border p-2.5"
                                value={paymentForm.method}
                                onChange={e => handleMethodChange(e.target.value)}
                            >
                                <option value="간편결제">간편결제 (모바일)</option>
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
                                onChange={e => handleChannelChange(e.target.value)}
                            >
                                <option value="간편결제">간편결제 링크</option>
                                <option value="현장결제">현장결제</option>
                                <option value="온라인결제">온라인결제</option>
                            </select>
                        </div>
                    </div>

                    {paymentForm.channel === '간편결제' && (
                        <div className="bg-white border border-emerald-200 rounded-lg p-4 text-sm text-gray-700 shadow-inner">
                            <div className="flex items-center text-emerald-700 font-bold mb-2">
                                <Icon name="smartphone" className="w-4 h-4 mr-2" />
                                간편결제 안내
                            </div>
                            <p className="text-gray-600 leading-relaxed">결제 완료 시 학부모에게 모바일 영수증이 발송되며, <span className="font-semibold text-gray-800">교재비만 청구</span>됩니다.</p>
                            <p className="text-xs text-emerald-700 mt-1">(학원비/수업료는 포함되지 않습니다.)</p>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button
                            type="submit"
                            disabled={isSubmittingPayment}
                            className={`w-full py-3 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 ${isSubmittingPayment ? 'bg-gray-300 text-gray-600' : 'bg-[#455fab] text-white hover:bg-[#3b5198]'}`}
                        >
                            {isSubmittingPayment
                                ? '결제 처리 중...'
                                : (paymentForm.bookId && availableBooks.find(b => String(b.id) === String(paymentForm.bookId))
                                    ? `${getBookPrice(availableBooks.find(b => String(b.id) === String(paymentForm.bookId))).toLocaleString()}원 ${paymentForm.channel === '간편결제' ? '간편결제 보내기' : '결제하기'}`
                                    : '결제하기')}
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
                            className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-[#455fab]"
                            value={selectedClassForSetting ?? ''}
                            onChange={e => setSelectedClassForSetting(e.target.value)}
                        >
                            {Array.isArray(effectiveClasses) && effectiveClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-xl p-3 bg-gray-50 space-y-2">
                        {selectedClassForSetting ? (
                            (Array.isArray(materialsByClass[String(selectedClassForSetting)]) ? materialsByClass[String(selectedClassForSetting)] : []).length > 0 ? (
                                (Array.isArray(materialsByClass[String(selectedClassForSetting)]) ? materialsByClass[String(selectedClassForSetting)] : []).map(book => (
                                    <div key={book.id} className="flex items-center p-4 rounded-lg border bg-white">
                                        <input
                                            type="checkbox"
                                            className="mr-4 h-5 w-5 text-[#455fab]"
                                            checked={(Array.isArray(selectedRequiredBookIds) ? selectedRequiredBookIds : []).includes(String(book?.id))}
                                            onChange={() => {
                                                const id = String(book?.id);
                                                if (!id) return;
                                                setSelectedRequiredBookIds((prev) => {
                                                    const next = Array.isArray(prev) ? prev.map(String) : [];
                                                    return next.includes(id) ? next.filter((x) => x !== id) : [...next, id];
                                                });
                                            }}
                                        />
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-800">{getBookTitle(book)}</div>
                                            <div className="text-sm text-gray-500 mt-0.5">{book.type} · {getBookPrice(book).toLocaleString()}원</div>
                                        </div>
                                    </div>
                                    ))
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    설정된 교재가 없습니다.
                                </div>
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                반을 먼저 선택해주세요.
                            </div>
                        )}
                    </div>
                    <div className="pt-4 border-t mt-2 flex justify-end">
                         <button
                            onClick={saveRequiredBooksForClass}
                            disabled={isSavingRequiredBooks}
                            className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-bold transition"
                         >
                             {isSavingRequiredBooks ? '저장 중...' : '설정 저장'}
                         </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
