import React from 'react';
import { Icon } from '../../utils/helpers';

export default function AttendanceDetailModal({ isOpen, onClose, lesson, attendanceLogs = [], studentId }) {
    if (!isOpen || !lesson) return null;

    const attendanceLog = attendanceLogs.find((log) =>
        String(log.classId) === String(lesson.classId)
        && log.date === lesson.date
        && (!studentId || String(log.studentId) === String(studentId))
    );

    const status = attendanceLog?.status || lesson.attendance || '출결 기록 없음';
    const recordedAt = attendanceLog?.recordedAt || attendanceLog?.timestamp || attendanceLog?.createdAt;
    const memo = attendanceLog?.reason || attendanceLog?.memo || attendanceLog?.note || attendanceLog?.comment;
    const checkIn = attendanceLog?.checkIn || attendanceLog?.checkInTime;
    const checkOut = attendanceLog?.checkOut || attendanceLog?.checkOutTime;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[11px] text-gray-400 font-semibold">{lesson.date} • {lesson.className}</p>
                        <h3 className="text-lg font-bold text-gray-900">출결 상세</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition"
                    >
                        <Icon name="x" className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-3 text-sm text-gray-800">
                    <div className="flex items-center justify-between bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-2 rounded-xl">
                        <span className="font-semibold">출결 상태</span>
                        <span className="font-bold">{status}</span>
                    </div>

                    {(checkIn || checkOut) && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 space-y-1">
                            <p className="text-xs text-gray-500 font-semibold">기록 시간</p>
                            <p className="text-sm text-gray-800">입실: {checkIn || '-'} / 퇴실: {checkOut || '-'}</p>
                        </div>
                    )}

                    {recordedAt && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 space-y-1">
                            <p className="text-xs text-gray-500 font-semibold">기록 시각</p>
                            <p className="text-sm text-gray-800">{String(recordedAt)}</p>
                        </div>
                    )}

                    {memo && (
                        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 space-y-1">
                            <p className="text-xs text-gray-500 font-semibold">사유/메모</p>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{memo}</p>
                        </div>
                    )}

                    {!attendanceLog && !memo && !recordedAt && !checkIn && !checkOut && (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-4 text-center">
                            출결 기록이 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}