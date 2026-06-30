export const generateMonthlyReportHTML = (tasks: any[], journals: any[], monthName: string) => {
  return `
    <html>
      <body style="font-family: 'Inter', sans-serif; background-color: #f9f9f9; padding: 40px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <h1 style="color: #2D3748; margin-bottom: 8px;">Monthly Summary</h1>
          <p style="color: #718096; font-size: 16px; margin-bottom: 32px;">Here is your summary for ${monthName}.</p>
          
          <h2 style="color: #4A5568; border-bottom: 2px solid #EDF2F7; padding-bottom: 8px; margin-bottom: 16px;">Completed Checklist</h2>
          ${tasks.length === 0 ? '<p style="color: #A0AEC0;">No tasks completed this month.</p>' : ''}
          <ul style="list-style: none; padding: 0;">
            ${tasks.map(t => `<li style="margin-bottom: 12px; padding: 12px; background: #F7FAFC; border-radius: 8px; border-left: 4px solid #48BB78;">
              <strong>${t.title}</strong>
            </li>`).join('')}
          </ul>
          
          <h2 style="color: #4A5568; border-bottom: 2px solid #EDF2F7; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px;">Journal Reflections</h2>
          ${journals.length === 0 ? '<p style="color: #A0AEC0;">No journal entries this month.</p>' : ''}
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${journals.map(j => `
              <div style="padding: 16px; border: 1px solid #E2E8F0; border-radius: 8px;">
                ${j.title ? `<h3 style="margin: 0 0 8px 0; color: #2D3748;">${j.title}</h3>` : ''}
                <p style="margin: 0; color: #4A5568; line-height: 1.5; white-space: pre-wrap;">${j.text}</p>
                <small style="color: #A0AEC0; display: block; margin-top: 8px;">${j.dateString || ''}</small>
              </div>
            `).join('')}
          </div>
          
          <div style="margin-top: 40px; text-align: center; color: #A0AEC0; font-size: 14px;">
            <p>Sent via DailyFlow ✨</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
