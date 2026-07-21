import React from 'react';

const renderParagraphs = (paragraphs = []) => paragraphs.map((paragraph, index) => {
  const text = String(paragraph || '');
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
  return (
    <p key={index} className="text-sm leading-6 text-gray-700 whitespace-pre-line">
      {isEmail ? <a className="font-semibold text-[#455fab] underline underline-offset-2" href={`mailto:${text.trim()}`}>{text.trim()}</a> : paragraph}
    </p>
  );
});

const renderItems = (items = []) => (
  <ul className="mt-3 space-y-2 pl-4 text-sm leading-6 text-gray-700 list-disc">
    {items.map((item, index) => (
      <li key={index} className="pl-1 whitespace-pre-line">{item}</li>
    ))}
  </ul>
);

const renderSubSections = (subSections = []) => subSections.map((subSection, index) => (
  <div key={index} className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3">
    {subSection.title && <h4 className="text-sm font-bold text-gray-800 mb-2">{subSection.title}</h4>}
    <div className="space-y-2">{renderParagraphs(subSection.paragraphs)}</div>
    {Array.isArray(subSection.items) && subSection.items.length > 0 && renderItems(subSection.items)}
  </div>
));

const ParentLegalPage = ({ content }) => {
  if (!content) {
    return (
      <section className="bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500">
          문서를 불러올 수 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50">
      <article className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <header className="border-b border-gray-100 pb-4 mb-5">
          <h2 className="text-lg font-bold text-gray-900">{content.title}</h2>
          <p className="mt-2 text-xs font-medium text-gray-500">시행일: {content.effectiveDate}</p>
        </header>

        <div className="space-y-7">
          {(content.sections || []).map((section, index) => (
            <section key={`${section.title}-${index}`} className="space-y-3">
              {section.title && <h3 className="text-base font-bold text-gray-900">{section.title}</h3>}
              <div className="space-y-2">{renderParagraphs(section.paragraphs)}</div>
              {Array.isArray(section.items) && section.items.length > 0 && renderItems(section.items)}
              {Array.isArray(section.subSections) && section.subSections.length > 0 && renderSubSections(section.subSections)}
              {Array.isArray(section.paragraphsAfterItems) && section.paragraphsAfterItems.length > 0 && (
                <div className="space-y-2 pt-1">{renderParagraphs(section.paragraphsAfterItems)}</div>
              )}
            </section>
          ))}
        </div>
      </article>
    </section>
  );
};

export default ParentLegalPage;