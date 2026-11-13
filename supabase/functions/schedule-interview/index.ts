import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyLang, tx } from "../_shared/notify-i18n.ts";
import { intlLocale, type Lang } from "../_shared/i18n.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeSlot {
  datetime: string;
  status: 'pending' | 'accepted' | 'declined';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();

    let result;
    switch (action) {
      case 'generate-slots':
        result = await generateSlots(supabase, params);
        break;
      case 'select-slot':
        result = await selectSlot(supabase, params);
        break;
      case 'confirm-attendance':
        result = await confirmAttendance(supabase, params);
        break;
      case 'send-reminders':
        result = await sendReminders(supabase);
        break;
      case 'report-no-show':
        result = await reportNoShow(supabase, params);
        break;
      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Schedule interview error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSlots(supabase: any, params: { 
  interview_id: string; 
  preferred_dates?: string[];
  duration_minutes?: number;
}): Promise<{ slots: TimeSlot[]; selection_token: string }> {
  const { interview_id, preferred_dates, duration_minutes = 60 } = params;

  // Get interview and client's existing interviews
  const { data: interview, error } = await supabase
    .from('interviews')
    .select(`
      *,
      submissions:submission_id (
        *,
        jobs:job_id (*),
        candidates:candidate_id (*)
      )
    `)
    .eq('id', interview_id)
    .single();

  if (error || !interview) {
    throw new Error('Interview not found');
  }

  const clientId = interview.submissions?.jobs?.client_id;

  // Get client's existing scheduled interviews to avoid conflicts
  const { data: existingInterviews } = await supabase
    .from('interviews')
    .select('scheduled_at, duration_minutes')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null);

  const blockedTimes = (existingInterviews || []).map((i: any) => ({
    start: new Date(i.scheduled_at),
    end: new Date(new Date(i.scheduled_at).getTime() + (i.duration_minutes || 60) * 60000),
  }));

  // Generate slots
  const slots: TimeSlot[] = [];
  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Start tomorrow
  
  // Business hours: 9-17
  const businessStart = 9;
  const businessEnd = 17;

  let currentDate = new Date(startDate);
  let slotsGenerated = 0;

  while (slotsGenerated < 5 && currentDate < new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Try different times
    for (let hour = businessStart; hour <= businessEnd - 1 && slotsGenerated < 5; hour += 2) {
      const slotTime = new Date(currentDate);
      slotTime.setHours(hour, 0, 0, 0);

      // Check if slot conflicts with existing interviews
      const conflicts = blockedTimes.some((blocked: any) => {
        const slotEnd = new Date(slotTime.getTime() + duration_minutes * 60000);
        return (slotTime >= blocked.start && slotTime < blocked.end) ||
               (slotEnd > blocked.start && slotEnd <= blocked.end);
      });

      if (!conflicts) {
        slots.push({
          datetime: slotTime.toISOString(),
          status: 'pending',
        });
        slotsGenerated++;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate unique selection token
  const selectionToken = crypto.randomUUID();

  // Update interview with proposed slots
  await supabase
    .from('interviews')
    .update({
      proposed_slots: slots,
      selection_token: selectionToken,
      duration_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', interview_id);

  // Send email with slots to recruiter/candidate
  await sendSlotProposalEmail(supabase, interview, slots, selectionToken);

  return { slots, selection_token: selectionToken };
}

async function selectSlot(supabase: any, params: {
  selection_token: string;
  slot_index: number;
}): Promise<{ success: boolean; scheduled_at: string }> {
  const { selection_token, slot_index } = params;

  // Find interview by token
  const { data: interview, error } = await supabase
    .from('interviews')
    .select(`
      *,
      submissions:submission_id (
        *,
        jobs:job_id (*),
        candidates:candidate_id (*)
      )
    `)
    .eq('selection_token', selection_token)
    .single();

  if (error || !interview) {
    throw new Error('Invalid selection token');
  }

  const slots = interview.proposed_slots as TimeSlot[];
  if (!slots || slot_index >= slots.length) {
    throw new Error('Invalid slot index');
  }

  const selectedSlot = slots[slot_index];

  // Update slot statuses
  const updatedSlots = slots.map((s, i) => ({
    ...s,
    status: i === slot_index ? 'accepted' : 'declined',
  }));

  // Update interview
  await supabase
    .from('interviews')
    .update({
      proposed_slots: updatedSlots,
      selected_slot_index: slot_index,
      scheduled_at: selectedSlot.datetime,
      status: 'scheduled',
      candidate_confirmed: true,
      candidate_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', interview.id);

  // ========================================
  // TRIPLE-BLIND: Stufe 2 - Voller Zugriff
  // Wenn Kandidat Interview bestätigt, bekommt Recruiter vollen Zugriff
  // ========================================
  if (interview.submission_id) {
    await supabase
      .from('submissions')
      .update({
        full_access_granted: true,
        full_access_granted_at: new Date().toISOString(),
        // Stelle auch sicher dass company_revealed gesetzt ist (Fallback)
        company_revealed: true,
        company_revealed_at: new Date().toISOString(),
      })
      .eq('id', interview.submission_id);

    console.log('🔓 Full access granted for submission:', interview.submission_id);
  }

  // Create notification for client (in seiner Sprache; Deutsch wie bisher)
  const scl = await notifyLang(supabase, interview.submissions?.jobs?.client_id);
  const sAt = new Date(selectedSlot.datetime).toLocaleString(intlLocale(scl));
  const sName = interview.submissions?.candidates?.full_name;
  await supabase.from('notifications').insert({
    user_id: interview.submissions?.jobs?.client_id,
    type: 'interview_scheduled',
    title: tx(scl, 'Interview bestätigt', 'Interview confirmed', 'Intervju bekräftad', 'Intervju bekreftet'),
    message: tx(scl, `Das Interview mit ${sName} wurde für ${sAt} bestätigt.`, `The interview with ${sName} has been confirmed for ${sAt}.`, `Intervjun med ${sName} är bekräftad till ${sAt}.`, `Intervjuet med ${sName} er bekreftet til ${sAt}.`),
    related_type: 'interview',
    related_id: interview.id,
  });

  // Send confirmation emails
  await sendScheduleConfirmationEmail(supabase, interview, selectedSlot.datetime);

  return { success: true, scheduled_at: selectedSlot.datetime };
}

async function confirmAttendance(supabase: any, params: {
  interview_id: string;
  user_type: 'client' | 'candidate';
}): Promise<{ success: boolean }> {
  const { interview_id, user_type } = params;

  const updateField = user_type === 'client' 
    ? { client_confirmed: true, client_confirmed_at: new Date().toISOString() }
    : { candidate_confirmed: true, candidate_confirmed_at: new Date().toISOString() };

  await supabase
    .from('interviews')
    .update({
      ...updateField,
      updated_at: new Date().toISOString(),
    })
    .eq('id', interview_id);

  return { success: true };
}

async function sendReminders(supabase: any): Promise<{ sent: number }> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);

  // Find interviews needing 24h reminder
  const { data: interviews24h } = await supabase
    .from('interviews')
    .select(`
      *,
      submissions:submission_id (
        *,
        jobs:job_id (*),
        candidates:candidate_id (*)
      )
    `)
    .eq('status', 'scheduled')
    .eq('reminder_24h_sent', false)
    .lte('scheduled_at', in24h.toISOString())
    .gte('scheduled_at', now.toISOString());

  let sent = 0;

  for (const interview of interviews24h || []) {
    await sendReminderEmail(supabase, interview, '24h');
    await supabase
      .from('interviews')
      .update({ reminder_24h_sent: true })
      .eq('id', interview.id);
    sent++;
  }

  // Find interviews needing 1h reminder
  const { data: interviews1h } = await supabase
    .from('interviews')
    .select(`
      *,
      submissions:submission_id (
        *,
        jobs:job_id (*),
        candidates:candidate_id (*)
      )
    `)
    .eq('status', 'scheduled')
    .eq('reminder_1h_sent', false)
    .lte('scheduled_at', in1h.toISOString())
    .gte('scheduled_at', now.toISOString());

  for (const interview of interviews1h || []) {
    await sendReminderEmail(supabase, interview, '1h');
    await supabase
      .from('interviews')
      .update({ reminder_1h_sent: true })
      .eq('id', interview.id);
    sent++;
  }

  return { sent };
}

async function reportNoShow(supabase: any, params: {
  interview_id: string;
  no_show_by: 'candidate' | 'client';
  notes?: string;
}): Promise<{ success: boolean }> {
  const { interview_id, no_show_by, notes } = params;

  // Update interview
  await supabase
    .from('interviews')
    .update({
      no_show_reported: true,
      no_show_by,
      status: 'no_show',
      notes: notes || `No-Show von ${no_show_by === 'candidate' ? 'Kandidat' : 'Client'} gemeldet`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', interview_id);

  // Get interview details for notification
  const { data: interview } = await supabase
    .from('interviews')
    .select(`
      *,
      submissions:submission_id (
        recruiter_id,
        jobs:job_id (client_id)
      )
    `)
    .eq('id', interview_id)
    .single();

  if (interview) {
    // Notify admin
    const nl = await notifyLang(supabase, interview.submissions?.recruiter_id);
    await supabase.from('notifications').insert({
      user_id: interview.submissions?.recruiter_id,
      type: 'interview_no_show',
      title: tx(nl, 'No-Show gemeldet', 'No-show reported', 'Uteblivande anmält', 'Uteblivelse meldt'),
      message: tx(nl, `Ein No-Show wurde für Interview ${interview_id} gemeldet (${no_show_by}).`, `A no-show was reported for interview ${interview_id} (${no_show_by}).`, `Ett uteblivande anmäldes för intervju ${interview_id} (${no_show_by}).`, `En uteblivelse ble meldt for intervju ${interview_id} (${no_show_by}).`),
      related_type: 'interview',
      related_id: interview_id,
    });

    // Track event for behavior scoring
    await supabase.from('platform_events').insert({
      event_type: 'interview_no_show',
      user_id: no_show_by === 'candidate' ? interview.submissions?.recruiter_id : interview.submissions?.jobs?.client_id,
      user_type: no_show_by,
      entity_type: 'interview',
      entity_id: interview_id,
      metadata: { no_show_by, notes },
    });
  }

  return { success: true };
}

// Email helper functions - Send to ALL 3 parties
async function sendSlotProposalEmail(supabase: any, interview: any, slots: TimeSlot[], token: string) {
  const candidate = interview.submissions?.candidates;
  const job = interview.submissions?.jobs;
  const recruiterId = interview.submissions?.recruiter_id;
  
  const slotList = slots.map((s, i) => 
    `${i + 1}. ${new Date(s.datetime).toLocaleString('de-DE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`
  ).join('\n');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const selectionUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/interview/select/${token}`;

  // Send to Recruiter
  console.log('📧 Sending slot proposal email to recruiter:', {
    recruiter_id: recruiterId,
    candidate: candidate?.full_name,
    job: job?.title,
    slots: slotList,
    selection_url: selectionUrl
  });

  // Try to send via send-email edge function
  try {
    await supabase.functions.invoke('send-email', {
      body: {
        to: recruiterId,
        template: 'interview_slot_proposal',
        data: {
          candidate_name: candidate?.full_name,
          job_title: job?.title,
          slots: slotList,
          selection_url: selectionUrl
        }
      }
    });
  } catch (e) {
    console.log('Email function not available, logged instead');
  }
}

async function sendScheduleConfirmationEmail(supabase: any, interview: any, scheduledAt: string) {
  const candidate = interview.submissions?.candidates;
  const job = interview.submissions?.jobs;
  const recruiterId = interview.submissions?.recruiter_id;
  const clientId = job?.client_id;
  
  const dateStr = new Date(scheduledAt).toLocaleString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const meetingLink = interview.meeting_link || interview.teams_join_url || 'Link wird nachgereicht';

  // Generate iCal content
  const icalContent = generateICalEvent({
    title: `Interview: ${candidate?.full_name} - ${job?.title}`,
    start: new Date(scheduledAt),
    duration: interview.duration_minutes || 60,
    location: meetingLink,
    description: `Interview für die Position ${job?.title}`
  });

  // 1. Send to CLIENT
  console.log('📧 Sending confirmation to CLIENT:', {
    client_id: clientId,
    candidate: candidate?.full_name,
    job: job?.title,
    date: dateStr,
    meeting_link: meetingLink
  });

  // Create client notification
  // Kunde und Headhunter je in ihrer Sprache (Datum nach Region, Zeitzone wie bisher)
  const confirmedAt = (l: Lang) => l === 'de' ? dateStr : new Date(scheduledAt).toLocaleString(intlLocale(l), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const ccl = await notifyLang(supabase, clientId);
  await supabase.from('client_notifications').insert({
    client_id: clientId,
    notification_type: 'interview_confirmed',
    title: tx(ccl, 'Interview bestätigt', 'Interview confirmed', 'Intervju bekräftad', 'Intervju bekreftet'),
    message: tx(ccl, `Interview mit ${candidate?.full_name} am ${confirmedAt(ccl)}. Meeting-Link: ${meetingLink}`, `Interview with ${candidate?.full_name} on ${confirmedAt(ccl)}. Meeting link: ${meetingLink}`, `Intervju med ${candidate?.full_name} ${confirmedAt(ccl)}. Möteslänk: ${meetingLink}`, `Intervju med ${candidate?.full_name} ${confirmedAt(ccl)}. Møtelenke: ${meetingLink}`),
    action_url: `/dashboard/interviews`,
    submission_id: interview.submission_id
  });

  // 2. Send to RECRUITER
  console.log('📧 Sending confirmation to RECRUITER:', {
    recruiter_id: recruiterId,
    candidate: candidate?.full_name,
    job: job?.title,
    date: dateStr,
    meeting_link: meetingLink
  });

  const crl = await notifyLang(supabase, recruiterId);
  const firmName = job?.company_name || tx(crl, 'Unternehmen', 'company', 'företaget', 'firmaet');
  await supabase.from('notifications').insert({
    user_id: recruiterId,
    type: 'interview_confirmed',
    title: tx(crl, 'Interview bestätigt', 'Interview confirmed', 'Intervju bekräftad', 'Intervju bekreftet'),
    message: tx(crl, `${candidate?.full_name} hat Interview bei ${firmName} am ${confirmedAt(crl)}`, `${candidate?.full_name} has an interview at ${firmName} on ${confirmedAt(crl)}`, `${candidate?.full_name} har intervju hos ${firmName} ${confirmedAt(crl)}`, `${candidate?.full_name} har intervju hos ${firmName} ${confirmedAt(crl)}`),
    related_type: 'interview',
    related_id: interview.id
  });

  // 3. Send to CANDIDATE (via Recruiter or direct if email available)
  console.log('📧 Sending confirmation to CANDIDATE:', {
    candidate_email: candidate?.email,
    candidate_name: candidate?.full_name,
    job: job?.title,
    date: dateStr,
    meeting_link: meetingLink,
    ical: 'attached'
  });

  // Try to send email to candidate
  if (candidate?.email) {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: candidate.email,
          template: 'interview_confirmed_candidate',
          data: {
            candidate_name: candidate.full_name,
            job_title: job?.title,
            company_name: job?.company_name || 'Ihr potenzieller Arbeitgeber',
            interview_date: dateStr,
            meeting_link: meetingLink,
            ical_attachment: icalContent
          }
        }
      });
    } catch (e) {
      console.log('Email to candidate logged (function not available)');
    }
  }
}

async function sendReminderEmail(supabase: any, interview: any, type: '24h' | '1h') {
  const candidate = interview.submissions?.candidates;
  const job = interview.submissions?.jobs;
  const clientId = job?.client_id;
  const recruiterId = interview.submissions?.recruiter_id;

  const dateStr = new Date(interview.scheduled_at).toLocaleString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  const reminderText = type === '24h' ? 'in 24 Stunden' : 'in 1 Stunde';

  // Send reminder to all 3 parties
  console.log(`📧 Sending ${type} reminder to ALL parties:`, {
    candidate: candidate?.full_name,
    job: job?.title,
    scheduled_at: interview.scheduled_at,
  });

  // Kunde und Headhunter je in ihrer Sprache
  const remindIn = (l: Lang) => type === '24h' ? tx(l, 'in 24 Stunden', 'in 24 hours', 'om 24 timmar', 'om 24 timer') : tx(l, 'in 1 Stunde', 'in 1 hour', 'om 1 timme', 'om 1 time');
  const remindAt = (l: Lang) => l === 'de' ? dateStr : new Date(interview.scheduled_at).toLocaleString(intlLocale(l), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const rcl = await notifyLang(supabase, clientId);
  const rrl = await notifyLang(supabase, recruiterId);

  // Client notification
  await supabase.from('client_notifications').insert({
    client_id: clientId,
    notification_type: 'interview_reminder',
    title: tx(rcl, `Erinnerung: Interview ${reminderText}`, `Reminder: interview ${remindIn(rcl)}`, `Påminnelse: intervju ${remindIn(rcl)}`, `Påminnelse: intervju ${remindIn(rcl)}`),
    message: tx(rcl, `Interview mit ${candidate?.full_name} am ${dateStr}`, `Interview with ${candidate?.full_name} on ${remindAt(rcl)}`, `Intervju med ${candidate?.full_name} ${remindAt(rcl)}`, `Intervju med ${candidate?.full_name} ${remindAt(rcl)}`),
    action_url: `/dashboard/interviews`,
    submission_id: interview.submission_id
  });

  // Recruiter notification
  await supabase.from('notifications').insert({
    user_id: recruiterId,
    type: 'interview_reminder',
    title: tx(rrl, `Erinnerung: Interview ${reminderText}`, `Reminder: interview ${remindIn(rrl)}`, `Påminnelse: intervju ${remindIn(rrl)}`, `Påminnelse: intervju ${remindIn(rrl)}`),
    message: tx(rrl, `${candidate?.full_name} hat Interview ${reminderText}`, `${candidate?.full_name} has an interview ${remindIn(rrl)}`, `${candidate?.full_name} har intervju ${remindIn(rrl)}`, `${candidate?.full_name} har intervju ${remindIn(rrl)}`),
    related_type: 'interview',
    related_id: interview.id
  });
}

// Helper to generate iCal event
function generateICalEvent(params: {
  title: string;
  start: Date;
  duration: number;
  location: string;
  description: string;
}): string {
  const { title, start, duration, location, description } = params;
  const end = new Date(start.getTime() + duration * 60000);
  
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lovable//Interview Scheduler//DE
BEGIN:VEVENT
UID:${crypto.randomUUID()}@lovable.app
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${title}
LOCATION:${location}
DESCRIPTION:${description}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}
