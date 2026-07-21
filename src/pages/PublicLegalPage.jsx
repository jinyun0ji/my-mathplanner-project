import React from 'react';
import ParentLegalPage from './parent/ParentLegalPage';
import { privacyContent } from '../content/legal/privacy';
import { termsContent } from '../content/legal/terms';

const SERVICE_NAME = '채수용 수학연구소';

const accountDeleteContent = {
  title: '계정 및 개인정보 삭제 요청 안내',
  effectiveDate: '',
  sections: [
    { paragraphs: [`${SERVICE_NAME}는 이용자의 계정 및 개인정보 삭제 요청을 지원합니다.`] },
    { title: '삭제 요청 방법', items: ['앱에서 “전체 > 계정 삭제 요청” 메뉴를 통해 요청할 수 있습니다.', '앱 이용이 어려운 경우 이메일로 삭제를 요청할 수 있습니다.'] },
    { title: '삭제 요청 이메일', paragraphs: ['jinyun0ji@gmail.com'] },
    { title: '이메일 요청 시 안내할 내용', items: ['가입에 사용한 이메일 주소', '학생 또는 학부모 이름', '삭제를 요청한다는 명확한 의사'] },
    { title: '처리 기간', items: ['삭제 요청 접수 후 7일 이내 처리', '본인 확인이나 추가 정보가 필요한 경우 이메일로 연락할 수 있음'] },
    { title: '삭제되는 정보', items: ['로그인 계정 및 인증 연결 정보', '학생 또는 학부모 프로필 정보', '학습 메모', '알림 정보', '채팅 데이터', '서비스 이용 과정에서 생성된 기타 개인정보'] },
    { title: '보관될 수 있는 정보', items: ['관련 법령에 따라 일정 기간 보관 의무가 있는 정보는 법정 보관 기간 동안 분리 보관한 뒤 삭제', '법령상 보관 의무가 없는 정보는 삭제 절차 완료 시 삭제'] },
    { title: '추가 안내', paragraphs: ['삭제 요청이 수업 운영, 결제 정산, 법적 보관 의무와 관련된 경우 일부 정보가 일정 기간 보관될 수 있습니다.'] },
  ],
};

const CONTENT_BY_TYPE = {
  privacy: privacyContent,
  terms: termsContent,
  accountDelete: accountDeleteContent,
};

export default function PublicLegalPage({ type }) {
  const content = CONTENT_BY_TYPE[type];

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-gray-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
          <p className="text-sm font-bold tracking-wide text-[#455fab]">{SERVICE_NAME}</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-gray-950 sm:text-3xl">{content?.title || '정책 문서'}</h1>
          {content?.effectiveDate ? <p className="mt-3 text-sm font-medium text-gray-500">시행일: {content.effectiveDate}</p> : null}
        </header>
        <div className="public-legal-document [&_article]:!rounded-2xl [&_article]:!p-5 sm:[&_article]:!p-7">
          <ParentLegalPage content={content} />
        </div>
        <footer className="mt-6 border-t border-slate-200 py-5 text-center text-xs text-gray-500">
          {content?.effectiveDate ? `시행일: ${content.effectiveDate}` : '최종 수정일은 정책 변경 시 함께 고지됩니다.'}
        </footer>
      </div>
    </main>
  );
}
