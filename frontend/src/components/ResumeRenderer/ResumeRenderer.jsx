import { renderResumeHtml } from './renderResumeHtml'

export function ResumeRenderer({ text, template, className }) {
  return (
    <div
      className={className}
      data-template={template}
      dangerouslySetInnerHTML={{ __html: renderResumeHtml(text) }}
    />
  )
}
