import React from 'react';
import { Icon } from '../utils/helpers';

export default function Home() {
    // 목업 데이터 (실제 데이터 연동 시 props로 받아오거나 계산)
    const stats = [
        { label: '총 재원생', value: '42명', change: '+2명', type: 'increase', icon: 'users', color: 'indigo' },
        { label: '오늘 출석률', value: '95%', change: '-2%', type: 'decrease', icon: 'checkCircle', color: 'green' },
        { label: '미납 수강료', value: '120만', change: '관리 필요', type: 'warning', icon: 'alertCircle', color: 'red' },
        { label: '이번 주 상담', value: '5건', change: '예정됨', type: 'neutral', icon: 'messageSquare', color: 'blue' },
    ];

    const todaySchedule = [
        { time: '14:00', class: '고2 수학(상) A반', room: '1강의실', type: 'lesson' },
        { time: '16:00', class: '김민준 학생 상담', room: '상담실', type: 'counsel' },
        { time: '19:00', class: '고1 수학(하) 심화', room: '2강의실', type: 'lesson' },
    ];

    return (
        <div className="space-y-6">
            {/* 상단 웰컴 메시지 */}
            <div className="flex justify-between items-center bg-indigo-600 p-6 rounded-2xl shadow-lg text-white">
                <div>
                    <h2 className="text-2xl font-bold mb-1">환영합니다, 채수용 선생님! 👋</h2>
                    <p className="text-indigo-100 text-sm">오늘도 힘찬 하루 되세요. 현재 예정된 수업은 2개입니다.</p>
                </div>
                <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                    <p className="text-xs font-medium text-indigo-50">Today</p>
                    <p className="text-xl font-bold">12월 12일 (금)</p>
                </div>
            </div>

            {/* KPI 카드 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</h3>
                            </div>
                            <div className={`p-2.5 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>
                                <Icon name={stat.icon} className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs">
                            <span className={`font-bold flex items-center ${
                                stat.type === 'increase' ? 'text-green-600' : 
                                stat.type === 'decrease' ? 'text-red-500' : 
                                stat.type === 'warning' ? 'text-orange-500' : 'text-gray-500'
                            }`}>
                                {stat.change}
                            </span>
                            <span className="text-gray-400 ml-1.5">vs 지난달</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 오늘 일정 */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            <Icon name="calendar" className="w-5 h-5 mr-2 text-indigo-600" />
                            오늘의 일정
                        </h3>
                        <button className="text-sm text-gray-500 hover:text-indigo-600 font-medium">전체 보기</button>
                    </div>
                    <div className="space-y-4">
                        {todaySchedule.map((item, i) => (
                            <div key={i} className="flex items-center p-4 rounded-lg bg-gray-50 border border-gray-100 hover:border-indigo-200 transition">
                                <div className="min-w-[80px] font-bold text-gray-700">{item.time}</div>
                                <div className="w-px h-8 bg-gray-300 mx-4"></div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-800">{item.class}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.room}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    item.type === 'lesson' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                    {item.type === 'lesson' ? '수업' : '상담'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 빠른 바로가기 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">빠른 실행</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col items-center text-center group">
                            <Icon name="userPlus" className="w-6 h-6 mb-2 text-gray-400 group-hover:text-indigo-600" />
                            <span className="text-sm font-bold text-gray-600 group-hover:text-indigo-700">신규생 등록</span>
                        </button>
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col items-center text-center group">
                            <Icon name="messageSquare" className="w-6 h-6 mb-2 text-gray-400 group-hover:text-indigo-600" />
                            <span className="text-sm font-bold text-gray-600 group-hover:text-indigo-700">전체 공지</span>
                        </button>
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col items-center text-center group">
                            <Icon name="creditCard" className="w-6 h-6 mb-2 text-gray-400 group-hover:text-indigo-600" />
                            <span className="text-sm font-bold text-gray-600 group-hover:text-indigo-700">수납 처리</span>
                        </button>
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition flex flex-col items-center text-center group">
                            <Icon name="fileText" className="w-6 h-6 mb-2 text-gray-400 group-hover:text-indigo-600" />
                            <span className="text-sm font-bold text-gray-600 group-hover:text-indigo-700">일지 작성</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}