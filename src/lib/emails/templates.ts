interface TemplateContext {
  candidateFirstName: string;
  jobTitle: string;
  companyName: string;
}

// ─── Shared layout wrapper ─────────────────────────────
function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#5B21B6);border-radius:12px;padding:10px 22px;">
                <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Hire<span style="color:#34d399;">X</span></span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                This email was sent by HireX on behalf of the hiring company.<br/>
                If you did not apply for this position, please disregard this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Shared components ─────────────────────────────────
function badge(text: string, color: string): string {
  return `<span style="display:inline-block;background:${color}1a;color:${color};font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;letter-spacing:0.4px;text-transform:uppercase;">${text}</span>`;
}

function divider(): string {
  return `<div style="height:1px;background:#f3f4f6;margin:24px 0;"></div>`;
}

function ctaButton(text: string): string {
  return `
  <div style="text-align:center;margin-top:32px;">
    <a href="#" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;letter-spacing:0.2px;">${text}</a>
  </div>`;
}

// ─── 1. Application Received ───────────────────────────
export function applicationReceivedTemplate({
  candidateFirstName,
  jobTitle,
  companyName,
}: TemplateContext): string {
  return layout(`
    <div style="margin-bottom:8px;">${badge("Application Received", "#7C3AED")}</div>
    <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      Hey ${candidateFirstName}, we've got your application!
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      Thank you for applying for the <strong style="color:#111827;">${jobTitle}</strong> role at <strong style="color:#111827;">${companyName}</strong>.
      Your application is now in the queue and the hiring team will review it shortly.
    </p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#faf5ff;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7C3AED;text-transform:uppercase;letter-spacing:0.5px;">What happens next?</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            Our team will carefully review your CV and match it against the role requirements.
            We'll reach out with an update — no ghosting, we promise.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
      Good luck, ${candidateFirstName}. We'll be in touch. 🚀
    </p>
  `);
}

// ─── 2. Shortlisted ───────────────────────────────────
export function shortlistedTemplate({
  candidateFirstName,
  jobTitle,
  companyName,
}: TemplateContext): string {
  return layout(`
    <div style="margin-bottom:8px;">${badge("Shortlisted", "#10B981")}</div>
    <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      You made the shortlist, ${candidateFirstName}!
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      Out of everyone who applied for <strong style="color:#111827;">${jobTitle}</strong> at <strong style="color:#111827;">${companyName}</strong>,
      the hiring team has shortlisted you as one of the top candidates. That's no small thing.
    </p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#f0fdf4;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#10B981;text-transform:uppercase;letter-spacing:0.5px;">What's next?</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            The hiring team will be reviewing shortlisted candidates and will reach out soon
            with the next steps in the process.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
      Keep an eye on your inbox — exciting things are coming your way.
    </p>
  `);
}

// ─── 3. Interview ─────────────────────────────────────
export function interviewTemplate({
  candidateFirstName,
  jobTitle,
  companyName,
}: TemplateContext): string {
  return layout(`
    <div style="margin-bottom:8px;">${badge("Interview Stage", "#F59E0B")}</div>
    <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      ${candidateFirstName}, you're invited to interview!
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      We're excited to invite you to interview for the <strong style="color:#111827;">${jobTitle}</strong> position at
      <strong style="color:#111827;">${companyName}</strong>. The team is looking forward to meeting you.
    </p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#fffbeb;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#F59E0B;text-transform:uppercase;letter-spacing:0.5px;">Heads up</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            A member of the ${companyName} hiring team will follow up shortly with scheduling details,
            format, and everything else you need to prepare. Stay sharp!
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
      This is your moment, ${candidateFirstName}. Best of luck.
    </p>
  `);
}

// ─── 4. Offer ─────────────────────────────────────────
export function offerTemplate({
  candidateFirstName,
  jobTitle,
  companyName,
}: TemplateContext): string {
  return layout(`
    <div style="margin-bottom:8px;">${badge("Offer Extended", "#10B981")}</div>
    <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      Congratulations, ${candidateFirstName}! 🎉
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      After a thorough process, we are thrilled to extend you an offer for the
      <strong style="color:#111827;">${jobTitle}</strong> role at <strong style="color:#111827;">${companyName}</strong>.
      You earned this.
    </p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#f0fdf4;border-left:4px solid #10B981;border-radius:0 10px 10px 0;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#10B981;text-transform:uppercase;letter-spacing:0.5px;">Next steps</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            A formal offer letter with all the details — compensation, start date, and benefits —
            will be sent to you by the ${companyName} team directly. Please review it carefully
            and reach out with any questions.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
      Welcome to the team (almost officially). We can't wait to work with you.
    </p>
  `);
}

// ─── 5. Rejected ──────────────────────────────────────
export function rejectedTemplate({
  candidateFirstName,
  jobTitle,
  companyName,
}: TemplateContext): string {
  return layout(`
    <div style="margin-bottom:8px;">${badge("Application Update", "#6b7280")}</div>
    <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
      An update on your application, ${candidateFirstName}
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      Thank you for taking the time to apply for <strong style="color:#111827;">${jobTitle}</strong> at
      <strong style="color:#111827;">${companyName}</strong> and for your interest in joining the team.
    </p>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.7;">
      After careful consideration, the team has decided to move forward with other candidates
      whose experience more closely matched what they were looking for at this time.
      This was a genuinely difficult decision — the quality of applicants was high.
    </p>
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#f9fafb;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            We encourage you to keep building, keep applying, and not let this discourage you.
            Your next opportunity is closer than you think.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
      We wish you all the best in your search, ${candidateFirstName}.
    </p>
  `);
}
