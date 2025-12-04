import { supabase } from '@/integrations/supabase/client';

type EmailTemplate = 
  | 'interview_invitation'
  | 'opt_in_request'
  | 'submission_received'
  | 'rejection_notice'
  | 'interview_reminder';

interface SendEmailParams {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

export function useEmailService() {
  const sendEmail = async ({ to, template, data }: SendEmailParams) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('send-email', {
        body: { to, template, data },
      });

      if (error) {
        console.error('Email send error:', error);
        throw new Error(error.message);
      }

      return result;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  };

  const sendInterviewInvitation = async (params: {
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    date: string;
    time: string;
    meetingType?: string;
    meetingLink?: string;
  }) => {
    return sendEmail({
      to: params.candidateEmail,
      template: 'interview_invitation',
      data: {
        candidateName: params.candidateName,
        jobTitle: params.jobTitle,
        date: params.date,
        time: params.time,
        meetingType: params.meetingType || 'Video-Call',
        meetingLink: params.meetingLink || '',
      },
    });
  };

  const sendOptInRequest = async (params: {
    recruiterEmail: string;
    candidateName: string;
    jobTitle: string;
    companyName: string;
    dashboardUrl: string;
  }) => {
    return sendEmail({
      to: params.recruiterEmail,
      template: 'opt_in_request',
      data: {
        candidateName: params.candidateName,
        jobTitle: params.jobTitle,
        companyName: params.companyName,
        dashboardUrl: params.dashboardUrl,
      },
    });
  };

  const sendSubmissionNotification = async (params: {
    clientEmail: string;
    clientName: string;
    jobTitle: string;
    matchScore: number;
    experienceYears: number;
    dashboardUrl: string;
  }) => {
    return sendEmail({
      to: params.clientEmail,
      template: 'submission_received',
      data: {
        clientName: params.clientName,
        jobTitle: params.jobTitle,
        matchScore: params.matchScore.toString(),
        experienceYears: params.experienceYears.toString(),
        dashboardUrl: params.dashboardUrl,
      },
    });
  };

  const sendRejectionNotice = async (params: {
    recruiterEmail: string;
    candidateName: string;
    jobTitle: string;
    reason?: string;
  }) => {
    return sendEmail({
      to: params.recruiterEmail,
      template: 'rejection_notice',
      data: {
        candidateName: params.candidateName,
        jobTitle: params.jobTitle,
        reason: params.reason || '',
      },
    });
  };

  const sendInterviewReminder = async (params: {
    recipientEmail: string;
    recipientName: string;
    jobTitle: string;
    date: string;
    time: string;
    meetingLink?: string;
  }) => {
    return sendEmail({
      to: params.recipientEmail,
      template: 'interview_reminder',
      data: {
        recipientName: params.recipientName,
        jobTitle: params.jobTitle,
        date: params.date,
        time: params.time,
        meetingLink: params.meetingLink || '',
      },
    });
  };

  return {
    sendEmail,
    sendInterviewInvitation,
    sendOptInRequest,
    sendSubmissionNotification,
    sendRejectionNotice,
    sendInterviewReminder,
  };
}
