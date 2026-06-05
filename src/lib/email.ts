import nodemailer from "nodemailer";
import { config } from "./config";
import type { ApplicationStage } from "../types";
import {
  applicationReceivedTemplate,
  shortlistedTemplate,
  interviewTemplate,
  offerTemplate,
  rejectedTemplate,
} from "./emails/templates";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  await transporter.sendMail({
    from: config.smtp.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export interface StageEmailContext {
  candidateFirstName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  stage: ApplicationStage;
}

/**
 * Dispatches the correct email template based on the application stage.
 * Silent no-op for stages that don't trigger candidate emails (screening, withdrawn).
 */
export async function sendStageEmail(ctx: StageEmailContext): Promise<void> {
  const { candidateFirstName, candidateEmail, jobTitle, companyName, stage } =
    ctx;

  let subject = "";
  let html = "";

  switch (stage) {
    case "applied":
      subject = `We received your application — ${jobTitle} at ${companyName}`;
      html = applicationReceivedTemplate({
        candidateFirstName,
        jobTitle,
        companyName,
      });
      break;

    case "shortlisted":
      subject = `Great news — you've been shortlisted for ${jobTitle}`;
      html = shortlistedTemplate({ candidateFirstName, jobTitle, companyName });
      break;

    case "interview":
      subject = `Interview invitation — ${jobTitle} at ${companyName}`;
      html = interviewTemplate({ candidateFirstName, jobTitle, companyName });
      break;

    case "offer":
      subject = `Congratulations! You have an offer — ${jobTitle} at ${companyName}`;
      html = offerTemplate({ candidateFirstName, jobTitle, companyName });
      break;

    case "rejected":
      subject = `Your application for ${jobTitle} at ${companyName}`;
      html = rejectedTemplate({ candidateFirstName, jobTitle, companyName });
      break;

    // screening and withdrawn don't trigger candidate emails
    default:
      return;
  }

  await sendEmail({ to: candidateEmail, subject, html });
}
