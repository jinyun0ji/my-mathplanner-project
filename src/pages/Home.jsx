import React from 'react';
import { Icon } from '../utils/helpers';

export default function Home() {
    // 목업 데이터
    const stats = [
        // [색상 변경] icon color: indigo -> indigo-900
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

    const quickActions = [
        { label: '신규생 등록', icon: 'userPlus', hint: '기본 정보와 반 배정', tone: 'indigo' },
        { label: '전체 공지', icon: 'messageSquare', hint: '문자/알림 발송', tone: 'blue' },
        { label: '수납 처리', icon: 'creditCard', hint: '결제 및 영수증', tone: 'emerald' },
        { label: '일지 작성', icon: 'fileText', hint: '수업/상담 기록', tone: 'orange' },
        { label: '출결 체크', icon: 'checkSquare', hint: '실시간 출결 입력', tone: 'violet' },
        { label: '상담 예약', icon: 'calendarPlus', hint: '학부모/학생 상담', tone: 'rose' },
    ];

    const reminders = [
        { title: '오늘 출결 미완료 3건', description: '1·2교시 고1 심화반 확인 필요', icon: 'alertTriangle', tone: 'amber' },
        { title: '상담 준비', description: '김민준 학생 상담 시 학부모 의견 반영', icon: 'messageCircle', tone: 'sky' },
        { title: '교재 업데이트', description: '고2 수학(상) A반 프린트 최신본 업로드', icon: 'fileText', tone: 'indigo' },
    ];

    const toneStyles = {
        indigo: 'bg-indigo-50 text-indigo-900 border-indigo-100',
        blue: 'bg-blue-50 text-blue-800 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
        orange: 'bg-orange-50 text-orange-800 border-orange-100',
        violet: 'bg-violet-50 text-violet-800 border-violet-100',
        rose: 'bg-rose-50 text-rose-800 border-rose-100',
        amber: 'bg-amber-50 text-amber-800 border-amber-100',
        sky: 'bg-sky-50 text-sky-800 border-sky-100',
    };

    const hoverToneStyles = {
        indigo: 'hover:bg-indigo-50',
        blue: 'hover:bg-blue-50',
        emerald: 'hover:bg-emerald-50',
        orange: 'hover:bg-orange-50',
        violet: 'hover:bg-violet-50',
        rose: 'hover:bg-rose-50',
        amber: 'hover:bg-amber-50',
        sky: 'hover:bg-sky-50',
    };

    return (
        <div className="space-y-6 lg:space-y-8 pb-2">
            {/* 상단 웰컴 메시지 */}
            {/* [색상 변경] bg-indigo-600 -> bg-indigo-900 */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(260px,1fr)]">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-700 p-6 lg:p-7 shadow-lg text-white">
                    <div className="absolute inset-y-0 right-0 w-48 bg-white/10 blur-3xl" aria-hidden></div>
                    <div className="relative flex flex-col gap-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <p className="text-sm text-indigo-100">오늘도 힘찬 하루 되세요.</p>
                                <h2 className="text-2xl lg:text-3xl font-bold">환영합니다, 채수용 선생님! 👋</h2>
                                <p className="text-indigo-100 text-sm">직원용 홈에서 주요 업무를 바로 확인해보세요.</p>
                            </div>
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 max-w-xs w-full sm:w-auto">
                                <p className="text-xs font-medium text-indigo-100">Today</p>
                                <p className="text-lg lg:text-xl font-bold">12월 12일 (금)</p>
                                <p className="text-xs text-indigo-100 mt-1">예정된 수업 {todaySchedule.length}개</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[13px]">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold backdrop-blur">
                                <Icon name="calendar" className="w-4 h-4" /> 오늘 일정 {todaySchedule.length}개
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold backdrop-blur">
                                <Icon name="checkCircle" className="w-4 h-4" /> 핵심 지표 한눈에 보기
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold backdrop-blur">
                                <Icon name="smartphone" className="w-4 h-4" /> 모바일에서도 편리하게
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-100">
                                <Icon name="activity" className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">오늘의 브리핑</p>
                                <p className="text-base font-bold text-gray-800">업무 체크리스트</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-100">Live</span>
                    </div>
                    <div className="space-y-3">
                        {reminders.map((item, idx) => (
                            <div key={idx} className={`flex items-start gap-3 rounded-xl border ${toneStyles[item.tone]} p-3`}>
                                <div className={`p-2 rounded-lg ${toneStyles[item.tone]} shadow-inner border`}>
                                    <Icon name={item.icon} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800">{item.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI 카드 섹션 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1 truncate">{stat.value}</h3>
                            </div>
                            {/* [색상 변경] 아이콘 배경 및 색상 조정 */}
                            <div className={`p-2.5 rounded-lg ${
                                stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-900' : 
                                stat.color === 'green' ? 'bg-green-50 text-green-700' :
                                stat.color === 'red' ? 'bg-red-50 text-red-600' :
                                'bg-blue-50 text-blue-600'
                            }`}>
                                <Icon name={stat.icon} className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-left">
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* 오늘 일정 */}
                <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                            {/* [색상 변경] text-indigo-600 -> text-indigo-900 */}
                            <Icon name="calendar" className="w-5 h-5 mr-2 text-indigo-900" />
                            오늘의 일정
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 font-semibold">실시간</span>
                            <span className="text-gray-400">모바일 친화적 타임라인</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {todaySchedule.map((item, i) => (
                            <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-200 transition">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="min-w-[72px] text-sm font-bold text-gray-800">{item.time}</div>
                                        <span className={`px-3 py-1 text-[11px] font-bold rounded-full ${
                                            item.type === 'lesson' 
                                                ? 'bg-indigo-100 text-indigo-900' 
                                                : 'bg-orange-100 text-orange-800'
                                        }`}>
                                            {item.type === 'lesson' ? '수업' : '상담'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 truncate">{item.class}</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">{item.room}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-indigo-800 font-semibold bg-indigo-50 rounded-full px-3 py-1 w-fit">
                                        <Icon name="clock" className="w-4 h-4" />
                                        리마인드 설정
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* 빠른 바로가기 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">빠른 실행</h3>
                            <span className="text-xs text-gray-400">모바일 친화형 버튼</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {quickActions.map((action, idx) => (
                                <button 
                                    key={idx} 
                                    className={`p-4 rounded-xl border border-gray-200 hover:border-indigo-900 transition flex flex-col items-start text-left group bg-gray-50/50 min-w-0 ${hoverToneStyles[action.tone]}`}
                                >
                                    <div className={`p-2 rounded-lg ${toneStyles[action.tone]} font-bold flex items-center justify-center text-sm shadow-inner`}>
                                        <Icon name={action.icon} className="w-5 h-5" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-900 transition-colors mt-3 truncate">{action.label}</span>
                                    <span className="text-[11px] text-gray-500 group-hover:text-indigo-800 transition-colors mt-1 leading-relaxed break-words">{action.hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 업무 브리핑 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">업무 브리핑</h3>
                            <span className="text-xs text-gray-400">현황 요약</span>
                        </div>
                        <div className="space-y-3">
                            {reminders.map((item, idx) => (
                                <div key={`briefing-${idx}`} className={`flex items-start gap-3 rounded-xl border ${toneStyles[item.tone]} p-3`}>
                                    <div className={`p-2 rounded-lg ${toneStyles[item.tone]} shadow-inner border`}>
                                        <Icon name={item.icon} className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-800">{item.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}