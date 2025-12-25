import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/client';
import { formatGradeLabel, Icon } from '../utils/helpers';

export default function StudentDetail() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [student, setStudent] = useState(null);
    const [attendances, setAttendances] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [grades, setGrades] = useState([]);
    const [memo, setMemo] = useState(null);

    useEffect(() => {
        let isMounted = true;

    const loadStudentDetail = async () => {
            setLoading(true);
            setError(null);
            setStudent(null);
            setAttendances([]);
            setHomeworks([]);
            setGrades([]);
            setMemo(null);

            if (!studentId) {
                if (isMounted) {
                    setError('학생 ID를 찾을 수 없습니다.');
                    setLoading(false);
                }
                return;
            }

            try {
                const studentRef = doc(db, 'students', studentId);
                const attendanceQuery = query(
                    collection(db, 'attendances'),
                    where('studentId', '==', studentId),
                    orderBy('date', 'desc'),
                    limit(5),
                );
            const homeworkQuery = query(
                    collection(db, 'homeworks'),
                    where('studentId', '==', studentId),
                    orderBy('date', 'desc'),
                    limit(5),
                );
            const gradesQuery = query(
                    collection(db, 'grades'),
                    where('studentId', '==', studentId),
                    orderBy('date', 'desc'),
                    limit(3),
                );
            const memoQuery = query(
                    collection(db, 'memos'),
                    where('studentId', '==', studentId),
                    orderBy('createdAt', 'desc'),
                    limit(1),
                );

            const [studentSnap, attendanceSnap, homeworkSnap, gradesSnap, memoSnap] = await Promise.all([
                    getDoc(studentRef),
                    getDocs(attendanceQuery),
                    getDocs(homeworkQuery),
                    getDocs(gradesQuery),
                    getDocs(memoQuery),
                ]);

                if (!isMounted) return;

            setStudent(studentSnap.exists() ? { id: studentSnap.id, ...studentSnap.data() } : null);
                setAttendances(attendanceSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
                setHomeworks(homeworkSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
                setGrades(gradesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
                setMemo(memoSnap.docs[0] ? { id: memoSnap.docs[0].id, ...memoSnap.docs[0].data() } : null);
            } catch (fetchError) {
                if (isMounted) {
                    setError('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

            loadStudentDetail();
            
            return () => {
            isMounted = false;
        };
    }, [studentId]);

    const renderStatus = () => {
        if (loading) {
            return (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-700">학생 정보를 불러오는 중입니다</p>
                    <p className="mt-2 text-xs text-gray-500">데이터를 안전하게 불러오는 중입니다.</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-rose-600">{error}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/students')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-600 shadow-sm"
                    >
                        <Icon name="arrow-left" className="h-4 w-4" />
                        학생 목록으로 돌아가기
                    </button>
                </div>
            );
        }

        if (!student) {
            return (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <p className="text-sm font-semibold text-gray-700">학생을 찾을 수 없습니다</p>
                    <p className="mt-2 text-xs text-gray-500">학생 ID: {studentId}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/students')}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                    >
                        <Icon name="arrow-left" className="h-4 w-4" />
                        학생 목록으로 이동
                    </button>
                </div>
            );
        }

        const attendanceItems = Array.isArray(attendances) ? attendances : [];
        const homeworkItems = Array.isArray(homeworks) ? homeworks : [];
        const gradeItems = Array.isArray(grades) ? grades : [];

        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs text-gray-500">학생 상세</p>
                            <h2 className="mt-1 text-2xl font-bold text-gray-900">{student.name || '이름 미상'}</h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {student.school || '학교 정보 없음'} · {formatGradeLabel(student.grade) || '학년 정보 없음'}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                                {student.status || '상태 정보 없음'}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigate('/students')}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                            >
                                <Icon name="arrow-left" className="h-4 w-4" />
                                학생 목록
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">출결 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/attendance')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                출결 관리
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                            {attendanceItems.length > 0 ? (
                                attendanceItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.status || '상태 없음'}</p>
                                            <p className="text-xs text-gray-500">{item.date || '날짜 정보 없음'}</p>
                                        </div>
                                        <span className="text-xs font-semibold text-gray-500">{item.note || '메모 없음'}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 출결 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">과제 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/homework')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                과제 관리
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-gray-600">
                            {homeworkItems.length > 0 ? (
                                homeworkItems.map((item) => (
                                    <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-gray-800">{item.title || item.content || '과제명 없음'}</p>
                                            <span className="text-xs font-semibold text-gray-500">{item.status || '상태 없음'}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">{item.date || '날짜 정보 없음'}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 과제 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">성적 요약</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/grades')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                성적 관리
                            </button>
                            </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {gradeItems.length > 0 ? (
                                gradeItems.map((item) => (
                                    <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                                        <p className="text-sm font-semibold text-gray-800">{item.testName || item.subject || '시험 정보 없음'}</p>
                                        <p className="mt-1 text-xs text-gray-500">{item.date || '날짜 정보 없음'}</p>
                                        <p className="mt-2 text-sm font-semibold text-indigo-600">
                                            {item.score ? `${item.score}점` : '점수 정보 없음'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                                    최근 성적 기록이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">최신 메모</h3>
                            <button
                                type="button"
                                onClick={() => navigate('/communication')}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                커뮤니케이션
                            </button>
                        </div>
                    <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                            {memo?.content || memo?.text || '작성된 메모가 없습니다.'}
                        </div>
                    <p className="mt-3 text-xs text-gray-400">
                            {memo?.createdAt || memo?.date || '작성 시각 정보 없음'}
                        </p>
                    </div>
                </div>
            </div>
            );
    };

    return <div className="space-y-6">{renderStatus()}</div>;
}