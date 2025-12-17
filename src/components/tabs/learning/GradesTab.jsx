import React, { useState, useMemo } from 'react';
import { Icon, calculateTrendZScore } from '../../../utils/helpers';
import ModalPortal from '../../common/ModalPortal';

// 로컬 헬퍼 함수
const getTrendStyle = (t) => {
    if (t === 'up') return 'text-indigo-600 bg-indigo-50 border-indigo-100';
    if (t === 'down') return 'text-orange-600 bg-orange-50 border-orange-100';
    if (t === 'same') return 'text-gray-800 bg-gray-50 border-gray-100';
    return 'text-gray-400 bg-gray-100 border-gray-200';
};

const getTrendText = (t) => {
    if (t === 'up') return '상승 중 ▲';
    if (t === 'down') return '하락 주의 ▼';
    if (t === 'same') return '유지 중 -';
    return '...';
};

// 상세 분석 컴포넌트
const QuestionAnalysisList = ({ questions, classAverage, highestScore, trend }) => {
    const [filter, setFilter] = useState('all'); 
    const filtered = questions.filter(q => {
        if (filter === 'wrong') return q.status === '틀림';
        if (filter === 'hard') return q.difficulty === '상';
        return true;
    });
    
    const handleTrendClick = () => {
        if (trend === 'initial') alert("성적 추이 분석을 위해서는 최근 3회 이상의 시험 기록이 필요합니다.");
    };

    return (
        <div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-800">분석 요약</span>
                    <span className="text-xs text-gray-400">총 {questions.length}문항</span>
                </div>
                <div className="flex gap-4 text-xs">
                    <div className="flex-1 bg-red-50 rounded-lg p-2 text-center">
                        <span className="block text-red-500 font-bold mb-1">평균</span>
                        <span className="text-lg font-extrabold text-red-600">{classAverage}점</span> 
                    </div>
                    <div className="flex-1 bg-orange-50 rounded-lg p-2 text-center">
                        <span className="block text-orange-500 font-bold mb-1">최고점</span>
                        <span className="text-lg font-extrabold text-orange-600">{highestScore}점</span>
                    </div>
                    <div className={`flex-[1.5] rounded-lg p-2 flex flex-col justify-center cursor-pointer active:bg-gray-100 transition-colors ${getTrendStyle(trend)}`} onClick={handleTrendClick}>
                        <span className="block font-bold mb-1 text-xs">성적 상태</span>
                        <span className="text-sm font-bold">{getTrendText(trend)}</span>
                    </div>
                </div>
            </div>

            <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                {['all', 'wrong', 'hard'].map(type => (
                    <button key={type} onClick={() => setFilter(type)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>{type === 'all' ? '전체 문항' : type === 'wrong' ? '취약 문항' : '고난도'}</button>
                ))}
            </div>

            <div className="space-y-3">
                {filtered.length > 0 ? filtered.map((q, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{q.no}번</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${q.status === '맞음' ? 'bg-green-50 text-green-700' : q.status === '틀림' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {q.status === '맞음' ? <Icon name="check" className="w-3 h-3" /> : q.status === '틀림' ? <Icon name="x" className="w-3 h-3" /> : <Icon name="alertCircle" className="w-3 h-3" />}
                                    {q.status}
                                </span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{q.score}점</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>난이도: <span className={`font-bold ${q.difficulty === '상' ? 'text-red-500' : q.difficulty === '중' ? 'text-yellow-600' : 'text-green-500'}`}>{q.difficulty}</span></div>
                            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>유형: {q.type}</div>
                            <div className="flex items-center gap-1 ml-auto">반 정답률 <span className="font-bold text-indigo-600">{q.itemAccuracy}%</span></div>
                        </div>
                    </div>
                )) : (<div className="text-center py-8 text-gray-400 text-xs">{filter === 'all' ? '등록된 문항이 없습니다.' : '해당하는 문항이 없습니다.'}</div>)}
            </div>
        </div>
    );
};

export default function GradesTab({ myGradeComparison }) {
    const [selectedTestId, setSelectedTestId] = useState(null);

    const trendAnalysis = useMemo(() => {
        if (!myGradeComparison) return { trend: 'initial', description: '' };
        
        const sortedForTrend = [...myGradeComparison].sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
        
        const trendResult = calculateTrendZScore(sortedForTrend);
        let description = "";

        if (trendResult === 'up') description = "최근 시험에서 상대적 위치가 개선되고 있어요.";
        else if (trendResult === 'down') description = "최근 시험에서 상대적 위치가 낮아졌어요. 주의가 필요합니다.";
        else if (trendResult === 'same') description = "최근 시험 성과가 비슷한 수준을 유지하고 있어요.";
        else description = "성적 추이 분석을 위해서는 최소 3회 이상의 시험 기록이 필요합니다.";

        return { trend: trendResult, description: description };
    }, [myGradeComparison]);

    const selectedTestAnalysis = myGradeComparison?.find(g => g.testId === selectedTestId);

    if (selectedTestId && selectedTestAnalysis) {
        return (
            <ModalPortal>
                <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col animate-fade-in-up w-full h-full">
                    <div className="flex-none h-14 flex items-center gap-3 px-4 border-b border-gray-200 bg-white shadow-sm">
                        <button onClick={() => setSelectedTestId(null)} className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors">
                            <Icon name="chevronLeft" className="w-5 h-5" />
                        </button>
                        <h2 className="text-base font-bold text-gray-900 truncate">성적 상세 분석</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 text-center">
                            <span className="text-sm text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded mb-2 inline-block">{selectedTestAnalysis.testDate} 시행</span>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedTestAnalysis.testName}</h3>
                            <div className="py-4">
                                <span className="text-5xl font-extrabold text-indigo-600">{selectedTestAnalysis.studentScore}</span>
                                <span className="text-gray-400 text-xl font-medium"> / {selectedTestAnalysis.maxScore}</span>
                            </div>
                        </div>
                        <QuestionAnalysisList 
                            questions={selectedTestAnalysis.questions} 
                            classAverage={selectedTestAnalysis.classAverage}
                            highestScore={selectedTestAnalysis.highestScore}
                            maxScore={selectedTestAnalysis.maxScore}
                            trend={trendAnalysis.trend} 
                        />
                    </div>
                </div>
            </ModalPortal>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            <div 
                className={`p-4 rounded-xl border ${getTrendStyle(trendAnalysis.trend)} cursor-pointer active:scale-[0.99] transition-all`}
                onClick={() => trendAnalysis.trend === 'initial' && alert("성적 추이 분석을 위해서는 최소 3회 이상의 시험 기록이 필요합니다.")}
            >
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-bold flex items-center gap-2">
                        <Icon name="barChart" className="w-4 h-4" />
                        성적 상태 분석 (최근 3회)
                    </p>
                    <span className="text-xs font-extrabold">{getTrendText(trendAnalysis.trend)}</span>
                </div>
                <p className="text-xs">{trendAnalysis.description}</p>
            </div>

            {!myGradeComparison || myGradeComparison.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">등록된 성적이 없습니다.</div>
            ) : (
                myGradeComparison.map((item, idx) => (
                    <div key={idx} onClick={() => setSelectedTestId(item.testId)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:border-indigo-200 active:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.className}</span>
                                <span className="text-xs text-gray-400">{item.testDate}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{item.testName}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                                    {item.isAboveAverage ? <Icon name="trendingUp" className="w-3 h-3 text-green-500" /> : <Icon name="trendingDown" className="w-3 h-3 text-red-500" />}
                                    평균 {item.classAverage}점
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-extrabold text-indigo-900">{item.studentScore}</span>
                                <span className="text-xs text-gray-400 font-medium">점</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};