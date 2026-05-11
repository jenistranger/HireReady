import { renderResumeHtml } from './renderResumeHtml'

export function ResumeRenderer({ text, template = 'default', className }) {
  return (
    <div
      className={className}
      data-template={template}
      dangerouslySetInnerHTML={{ __html: renderResumeHtml(text, template) }}
    />
  )
}
