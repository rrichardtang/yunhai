const { Resend } = require('resend');

async function sendTripHealthSummaryEmail({ toEmail, tripName, tripHealth }) {
  if (!toEmail || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const unresolved = (tripHealth?.issues || []).slice(0, 5).map((issue) => `- ${issue.message}`).join('\n');
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [toEmail],
    subject: `TravelPlanner trip health summary: ${tripName || 'Your trip'}`,
    text: `${tripHealth.status} (${tripHealth.issueCount} issues)\n\nTop issue: ${tripHealth.topIssue}\nChecklist: ${tripHealth.checklistProgress.verified}/${tripHealth.checklistProgress.total} verified\n\nUnresolved:\n${unresolved || '- None'}`
  });
  return true;
}

module.exports = { sendTripHealthSummaryEmail };
