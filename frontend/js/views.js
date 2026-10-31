import {
  DEFAULT_DISPLAY_CURRENCY,
  DEFAULT_USD_TO_ILS,
  ils,
  primary,
  secondary,
  usd,
} from './currency.js';
import { escapeHtml, monthLabel } from './format.js';
import { currentDate } from './data.js';

export function renderLogin(root, { demo, error = '' } = {}) {
  root.innerHTML = `<main class="login-shell"><section class="login-card">
    <div class="brand-mark"><span class="mark">✦</span> stillpoint</div>
    <h1>A little more room for the work.</h1>
    <p>Keep your sessions, fees, and monthly picture close at hand.</p>
    ${demo ? '<div class="error" style="background:#e6f1e7;color:#315c56">Demo mode is active. The local page uses sample data until you connect the backend.</div>' : ''}
    <form id="login-form">
      <div class="form-field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
      <div class="form-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <button class="button full">Sign in</button>
    </form>
    <p class="login-note">Your account is managed securely by the clinic server.</p>
  </section></main>`;
}

function customSelect({ id, name, value, label, options }) {
  return `<div class="custom-select" id="${id}" data-select data-name="${name}" data-value="${escapeHtml(value)}">
    <button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="select-label">${escapeHtml(label)}</span><span class="select-chevron">⌄</span>
    </button>
    <div class="select-menu" role="listbox">${options.map((option) => `<button type="button" role="option" class="select-option ${option.value === value ? 'selected' : ''}" data-option="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`).join('')}</div>
  </div>`;
}

function monthPicker(month) {
  const options = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + index - 6);
    const value = date.toISOString().slice(0, 7);
    return { value, label: monthLabel(value) };
  });

  return customSelect({
    id: 'month-select',
    name: 'month',
    value: month,
    label: monthLabel(month),
    options,
  });
}

function meetingCard(meeting, rate) {
  const date = new Date(`${meeting.meeting_date}T12:00:00`);
  const currency = meeting.currency || DEFAULT_DISPLAY_CURRENCY;
  const comment = meeting.notes ? ` · ${escapeHtml(meeting.notes)}` : '';
  const owed = Math.max(Number(meeting.cost || 0) - Number(meeting.amount_paid || 0), 0);

  return `<div class="meeting meeting-action" data-meeting-id="${escapeHtml(meeting.id)}" role="button" tabindex="0">
    <div><div class="meeting-date">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div class="meeting-time">${escapeHtml(meeting.start_time.slice(0, 5))}</div></div>
    <div><div class="meeting-name">${escapeHtml(meeting.clients?.name || 'Client')}<span class="status-pill ${meeting.status === 'cancelled' ? 'cancelled' : ''}">${escapeHtml(meeting.status)}</span></div><div class="meeting-meta">${meeting.status === 'completed' ? 'Completed session' : 'Scheduled session'}${comment}</div></div>
    <div class="meeting-cost"><strong>${primary(meeting.cost, currency, rate)}</strong><small>${owed > 0 ? `${primary(owed, currency, rate)} owed` : 'Paid'}</small></div>
  </div>`;
}

function todaySchedule(meetings, today, rate) {
  const todayMeetings = meetings.filter((meeting) => meeting.meeting_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const owed = todayMeetings.reduce((sum, meeting) => sum + Math.max(Number(meeting.cost || 0) - Number(meeting.amount_paid || 0), 0), 0);
  const collected = todayMeetings.reduce((sum, meeting) => sum + Number(meeting.amount_paid || 0), 0);
  const date = new Date(`${today}T12:00:00`);

  return `<section class="today-layout"><div class="today-summary"><article class="summary-card lilac"><div class="summary-label">Payments owed today</div><div class="summary-value">${ils(owed)}<small>${usd(owed, rate)}</small></div></article><article class="summary-card mint"><div class="summary-label">Collected today</div><div class="summary-value">${ils(collected)}<small>${usd(collected, rate)}</small></div></article></div><section class="panel today-schedule"><div class="panel-header"><div><h2>${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2><p class="panel-note">${todayMeetings.length} sessions scheduled</p></div><button class="button" id="new-today-meeting">+ New session</button></div><div class="day-event-list">${todayMeetings.length ? todayMeetings.map((meeting) => `<button type="button" class="day-event" data-meeting-id="${escapeHtml(meeting.id)}"><span class="day-event-time">${escapeHtml(meeting.start_time.slice(0, 5))}</span><span><strong>${escapeHtml(meeting.clients?.name || 'Client')}</strong><small>${escapeHtml(meeting.notes || 'No comments')}</small></span><span class="meeting-cost"><strong>${primary(meeting.cost, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)}</strong><small>${owedForLabel(meeting, rate)}</small></span></button>`).join('') : '<div class="empty"><strong>No sessions today.</strong>Use New session to add one to today\'s schedule.</div>'}</div></section></section>`;
}

function owedForLabel(meeting, rate) {
  const owed = Math.max(Number(meeting.cost || 0) - Number(meeting.amount_paid || 0), 0);
  return owed > 0 ? `${primary(owed, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)} owed` : 'Paid';
}

function calendarEvent(meeting, rate) {
  return `<button type="button" class="calendar-event ${meeting.status}" data-meeting-id="${escapeHtml(meeting.id)}" title="Edit ${escapeHtml(meeting.clients?.name || 'Client')}"><span>${escapeHtml(meeting.start_time.slice(0, 5))}</span> ${escapeHtml(meeting.clients?.name || 'Client')}<b>${primary(meeting.cost, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)}</b></button>`;
}

function calendarDay(date, meetings, month, rate) {
  const dayMeetings = meetings.filter((meeting) => meeting.meeting_date === date);
  const day = new Date(`${date}T12:00:00`);
  return `<div class="calendar-day ${date.startsWith(month) ? '' : 'outside-month'}" data-calendar-date="${date}"><div class="day-number">${day.getDate()}</div>${dayMeetings.map((meeting) => calendarEvent(meeting, rate)).join('')}</div>`;
}

function weekStart(date) {
  const start = new Date(`${date}T12:00:00`);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function calendarMarkup(mode, month, meetings, rate, focusDate) {
  if (mode === 'day') {
    const dayMeetings = meetings.filter((meeting) => meeting.meeting_date === focusDate).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const day = new Date(`${focusDate}T12:00:00`);
    return `<div class="day-view" data-calendar-date="${focusDate}"><div class="day-view-heading"><span>${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span><button type="button" class="button secondary" data-day-add="${focusDate}">+ Add session</button></div><div class="day-event-list">${dayMeetings.length ? dayMeetings.map((meeting) => `<button type="button" class="day-event" data-meeting-id="${escapeHtml(meeting.id)}"><span class="day-event-time">${escapeHtml(meeting.start_time.slice(0, 5))}</span><span><strong>${escapeHtml(meeting.clients?.name || 'Client')}</strong><small>${escapeHtml(meeting.notes || 'No comments')}</small></span><span class="meeting-cost"><strong>${primary(meeting.cost, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)}</strong><small>${secondary(meeting.cost, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)}</small></span></button>`).join('') : '<div class="empty"><strong>No sessions on this day.</strong>Use Add session to schedule one.</div>'}</div></div>`;
  }

  const first = mode === 'week' ? weekStart(focusDate) : weekStart(`${month}-01`);
  const numberOfDays = mode === 'week' ? 7 : 42;
  return `<div class="calendar-grid ${mode}-calendar"><div class="calendar-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].slice(0, mode === 'week' ? 7 : 7).map((day) => `<div>${day}</div>`).join('')}</div><div class="calendar-days">${Array.from({ length: numberOfDays }, (_, index) => { const day = new Date(first); day.setDate(first.getDate() + index); return calendarDay(day.toISOString().slice(0, 10), meetings, month, rate); }).join('')}</div></div>`;
}

function clientRow(client, rate) {
  const currency = client.currency || DEFAULT_DISPLAY_CURRENCY;
  return `<button class="client-row" data-client-id="${escapeHtml(client.id)}"><span><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.email || 'No email added')}</small></span><span class="meeting-cost"><strong>${primary(client.default_fee, currency, rate)}</strong><small>${secondary(client.default_fee, currency, rate)}</small></span><span class="client-arrow">›</span></button>`;
}

function reminderRow(reminder) {
  const when = reminder.recurrence === 'after_session'
    ? `After each session${reminder.clients?.name ? ` · ${escapeHtml(reminder.clients.name)}` : ''}`
    : reminder.remind_at
      ? new Date(reminder.remind_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'No notification time set';
  return `<button type="button" class="reminder-row" data-reminder-id="${escapeHtml(reminder.id)}"><span class="reminder-dot"></span><span class="reminder-copy"><strong>${escapeHtml(reminder.title)}</strong><small>${escapeHtml(reminder.body || when)}</small></span><span class="reminder-when">${when}</span><span class="client-arrow">›</span></button>`;
}

export function renderDashboard(root, workspace, month, rate = DEFAULT_USD_TO_ILS, calendarMode = 'month', focusDate = `${month}-01`) {
  const calendarMeetings = workspace.meetings;
  const meetings = workspace.meetings.filter((meeting) => meeting.meeting_date.startsWith(month)).sort((a, b) => `${a.meeting_date}${a.start_time}`.localeCompare(`${b.meeting_date}${b.start_time}`));
  const today = currentDate();
  const completedTotal = meetings.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const focus = new Date(`${focusDate}T12:00:00`);
  const navigationUnit = calendarMode === 'week' ? 'week' : calendarMode === 'day' ? 'day' : 'month';
  const calendarLabel = calendarMode === 'day'
    ? focus.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : calendarMode === 'week'
      ? `Week of ${focus.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : monthLabel(month);

  root.innerHTML = `<main class="dashboard">
    <header class="topbar"><div class="brand-mark"><span class="mark">✦</span> stillpoint</div><div class="user-actions"><span class="avatar">${escapeHtml((workspace.user?.email || workspace.user?.name || 'T').slice(0, 1).toUpperCase())}</span><button class="button secondary" id="logout">Sign out</button></div></header>
    <section class="intro"><div><div class="eyebrow">Private practice · Israel</div><h1>Your month, in view.</h1><p>Sessions, fees, and payments — together in one place.</p></div><div class="month-controls"><button class="icon-button" id="previous-month" aria-label="Previous ${navigationUnit}">‹</button>${monthPicker(month)}<button class="icon-button" id="next-month" aria-label="Next ${navigationUnit}">›</button></div></section>
    <section class="summary-grid"><article class="summary-card"><div class="summary-label">Sessions this month</div><div class="summary-value">${meetings.length}</div></article><article class="summary-card mint"><div class="summary-label">Fees charged · ILS</div><div class="summary-value">${ils(completedTotal)} <small>${usd(completedTotal, rate)}</small></div></article><article class="summary-card lilac"><div class="summary-label">Upcoming</div><div class="summary-value">${meetings.filter((item) => item.status === 'scheduled').length}</div></article></section>
    <nav class="view-tabs" aria-label="Workspace views"><button class="tab-button active" data-tab="today-view">Your day</button><button class="tab-button" data-tab="calendar-view">Calendar</button><button class="tab-button" data-tab="sessions-view">Sessions</button><button class="tab-button" data-tab="clients-view">Clients</button><button class="tab-button" data-tab="reminders-view">Reminders</button><button class="button tab-action" id="new-meeting">+ New session</button></nav>
    <section class="view-panel" id="today-view">${todaySchedule(calendarMeetings, today, rate)}</section>
    <section class="view-panel" id="calendar-view"><section class="panel calendar-panel"><div class="panel-header"><div><h2>Calendar</h2><p class="panel-note">${calendarLabel} · ${meetings.length} sessions</p></div><div class="calendar-toolbar"><div class="calendar-nav" role="group" aria-label="Calendar navigation"><button type="button" class="calendar-nav-button" id="calendar-previous" aria-label="Previous ${navigationUnit}">‹</button><button type="button" class="calendar-nav-button" id="calendar-next" aria-label="Next ${navigationUnit}">›</button></div><button class="button secondary today-button" id="calendar-today">Today</button><div class="calendar-modes" role="group" aria-label="Calendar view"><button class="mode-button ${calendarMode === 'month' ? 'active' : ''}" data-calendar-mode="month">Month</button><button class="mode-button ${calendarMode === 'week' ? 'active' : ''}" data-calendar-mode="week">Week</button><button class="mode-button ${calendarMode === 'day' ? 'active' : ''}" data-calendar-mode="day">Day</button></div></div></div>${calendarMarkup(calendarMode, month, calendarMeetings, rate, focusDate)}</section></section>
    <section class="view-panel hidden" id="sessions-view"><section class="panel"><div class="panel-header"><h2>Sessions</h2></div><div class="meeting-list">${meetings.length ? meetings.map((meeting) => meetingCard(meeting, rate)).join('') : '<div class="empty"><strong>Your month is clear.</strong>Add a session when one is ready to schedule.</div>'}</div></section></section>
    <section class="view-panel hidden" id="clients-view"><section class="panel"><div class="panel-header"><div><h2>Clients</h2><p class="panel-note">Select a client to view and edit their profile.</p></div><button class="button secondary" id="new-client">Add client</button></div><div class="client-list">${workspace.clients.length ? workspace.clients.map((client) => clientRow(client, rate)).join('') : '<div class="empty"><strong>No clients yet.</strong>Add a client to get started.</div>'}</div></section></section>
    <section class="view-panel hidden" id="reminders-view"><section class="panel"><div class="panel-header"><div><h2>Reminders</h2><p class="panel-note">Scheduled nudges and after-session routines.</p></div><button class="button secondary" id="new-reminder">Add reminder</button></div><div class="reminder-list">${workspace.reminders?.length ? workspace.reminders.map(reminderRow).join('') : '<div class="empty"><strong>No reminders yet.</strong>Add one for a scheduled nudge or a post-session routine.</div>'}</div></section></section>
  </main>`;
}

function moneyFields(prefix, value = '', required = true, currency = DEFAULT_DISPLAY_CURRENCY, alternateValue = '') {
  return `<div class="money-fields full-span" data-money-group data-prefix="${prefix}" data-currency="${currency}"><div class="form-field"><label>Fee in shekels (₪)</label><input name="${prefix}_ils" type="number" min="0" step="0.01" value="${value}" inputmode="decimal" ${required ? 'required' : ''}></div><div class="form-field"><label>Fee in dollars ($)</label><input name="${prefix}_usd" type="number" min="0" step="0.01" value="${alternateValue}" inputmode="decimal"></div><div class="currency-memory">This record remembers the last currency you use.</div></div>`;
}

export function renderModal(type, clients, rate = DEFAULT_USD_TO_ILS, existingMeeting = null, initialDate = null) {
  const meeting = type === 'meeting';
  const today = new Date().toISOString().slice(0, 10);
  const clientOptions = clients.map((client) => ({ value: client.id, label: `${client.name} · ${primary(client.default_fee, client.currency || DEFAULT_DISPLAY_CURRENCY, rate)}` }));
  if (meeting) clientOptions.push({ value: '__new__', label: '+ Create a new client' });
  const selectedClient = existingMeeting ? clients.find((client) => client.id === existingMeeting.client_id) : clients[0];
  const selectedCurrency = existingMeeting?.currency || selectedClient?.currency || DEFAULT_DISPLAY_CURRENCY;
  const initialMeetingDate = existingMeeting?.meeting_date || initialDate || today;
  const initialIls = existingMeeting ? existingMeeting.cost : '';
  const initialUsd = existingMeeting && selectedCurrency === 'USD' ? (Number(existingMeeting.cost) / rate).toFixed(2) : '';
  const statusOptions = [{ value: 'scheduled', label: 'Scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];
  const paymentOptions = [{ value: 'unpaid', label: 'Unpaid' }, { value: 'partial', label: 'Partially paid' }, { value: 'paid', label: 'Paid' }];
  const statusValue = existingMeeting?.status || 'scheduled';
  const statusLabel = statusOptions.find((option) => option.value === statusValue)?.label || 'Scheduled';
  const paymentValue = existingMeeting?.payment_status || 'unpaid';
  const paymentLabel = paymentOptions.find((option) => option.value === paymentValue)?.label || 'Unpaid';
  const paidIls = existingMeeting ? existingMeeting.amount_paid : 0;
  const paidUsd = existingMeeting && selectedCurrency === 'USD' ? (Number(existingMeeting.amount_paid || 0) / rate).toFixed(2) : '';
  const title = existingMeeting ? 'Edit session' : 'Schedule a session';

  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal"><div class="modal-header"><div><div class="eyebrow">${meeting ? 'Calendar entry' : 'Client directory'}</div><h2>${meeting ? title : 'Add a client'}</h2></div><button class="close" id="close-modal" aria-label="Close">×</button></div><form id="modal-form" class="form-grid">${meeting ? `<div class="form-field full-span"><label>Client</label>${customSelect({ id: 'client-select', name: 'client_id', value: selectedClient?.id || '__new__', label: selectedClient?.name || '+ Create a new client', options: clientOptions })}</div><div class="new-client-fields full-span" hidden><div class="inline-heading">New client details</div><div class="form-field"><label>Name</label><input name="new_client_name" placeholder="Client name"></div><div class="form-field"><label>Email (optional)</label><input name="new_client_email" type="email" placeholder="client@example.com"></div>${moneyFields('new_client_fee', '', false)}</div><div class="form-field"><label>Date</label><input name="meeting_date" type="date" value="${initialMeetingDate}" required></div><div class="form-field"><label>Time</label><input name="start_time" type="time" value="${existingMeeting?.start_time?.slice(0, 5) || '09:00'}" required></div>${moneyFields('cost', initialIls, true, selectedCurrency, initialUsd)}<div class="form-field"><label>Outcome</label>${customSelect({ id: 'status-select', name: 'status', value: statusValue, label: statusLabel, options: statusOptions })}</div><div class="form-field"><label>Payment</label>${customSelect({ id: 'payment-status-select', name: 'payment_status', value: paymentValue, label: paymentLabel, options: paymentOptions })}</div>${moneyFields('amount_paid', paidIls, true, selectedCurrency, paidUsd)}<div class="form-field full-span"><label>Comments about this meeting</label><textarea name="notes" rows="3" maxlength="1000" placeholder="Private notes about the session">${escapeHtml(existingMeeting?.notes || '')}</textarea></div><div class="rate-note full-span">Working rate: 1 USD = <input name="exchange_rate" value="${rate.toFixed(2)}" type="number" min="0.01" step="0.01"> ILS. Both fee fields stay in sync.</div>` : `<div class="form-field full-span"><label>Name</label><input name="name" required placeholder="Client name"></div><div class="form-field full-span"><label>Email (optional)</label><input name="email" type="email" placeholder="client@example.com"></div>${moneyFields('default_fee')}<div class="form-field full-span"><label>Client comments</label><textarea name="notes" rows="4" maxlength="3000" placeholder="Context, preferences, or private notes"></textarea></div><div class="rate-note full-span">Working rate: 1 USD = <input name="exchange_rate" value="${rate.toFixed(2)}" type="number" min="0.01" step="0.01"> ILS.</div>`}<div class="modal-actions full-span">${meeting && existingMeeting ? '<button type="button" class="button danger" id="delete-meeting">Delete session</button>' : ''}<button class="button">Save ${meeting ? 'session' : 'client'}</button></div></form></section></div>`;
}

export function renderClientProfile(client, rate = DEFAULT_USD_TO_ILS) {
  const currency = client.currency || DEFAULT_DISPLAY_CURRENCY;
  const ilsValue = client.default_fee;
  const usdValue = currency === 'USD' ? (Number(client.default_fee) / rate).toFixed(2) : '';
  return `<div class="modal-backdrop" id="client-profile-backdrop"><section class="modal profile-modal"><div class="modal-header"><div><div class="eyebrow">Client profile</div><h2>${escapeHtml(client.name)}</h2></div><button class="close" id="close-client-profile" aria-label="Close">×</button></div><form id="client-profile-form" class="form-grid"><div class="form-field full-span"><label>Name</label><input name="name" value="${escapeHtml(client.name)}" required></div><div class="form-field full-span"><label>Email</label><input name="email" type="email" value="${escapeHtml(client.email || '')}"></div>${moneyFields('default_fee', ilsValue, true, currency, usdValue)}<div class="form-field full-span"><label>Client comments</label><textarea name="notes" rows="7" maxlength="3000" placeholder="Context, preferences, or private notes">${escapeHtml(client.notes || '')}</textarea></div><div class="rate-note full-span">The saved currency preference is based on the last fee field you use.</div><div class="full-span"><button class="button full">Save profile</button></div></form></section></div>`;
}

export function renderReminderModal(reminder, clients) {
  const recurrenceOptions = [
    { value: 'once', label: 'One time' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: 'Every week' },
    { value: 'after_session', label: 'After every session' },
  ];
  const clientOptions = [{ value: '', label: 'No client' }, ...clients.map((client) => ({ value: client.id, label: client.name }))];
  const recurrence = reminder?.recurrence || 'once';
  const recurrenceLabel = recurrenceOptions.find((option) => option.value === recurrence)?.label || 'One time';
  const clientId = reminder?.client_id || '';
  const clientLabel = clients.find((client) => client.id === clientId)?.name || 'No client';
  const localTime = reminder?.remind_at ? new Date(reminder.remind_at).toISOString().slice(0, 16) : '';

  return `<div class="modal-backdrop" id="reminder-modal-backdrop"><section class="modal"><div class="modal-header"><div><div class="eyebrow">Practice rhythm</div><h2>${reminder ? 'Edit reminder' : 'Add reminder'}</h2></div><button class="close" id="close-reminder" aria-label="Close">×</button></div><form id="reminder-form" class="form-grid"><div class="form-field full-span"><label>Reminder</label><input name="title" value="${escapeHtml(reminder?.title || '')}" placeholder="Write session note" required></div><div class="form-field full-span"><label>Details</label><textarea name="body" rows="3" maxlength="3000" placeholder="What should you remember?">${escapeHtml(reminder?.body || '')}</textarea></div><div class="form-field"><label>Pattern</label>${customSelect({ id: 'reminder-recurrence', name: 'recurrence', value: recurrence, label: recurrenceLabel, options: recurrenceOptions })}</div><div class="form-field"><label>Client</label>${customSelect({ id: 'reminder-client', name: 'client_id', value: clientId, label: clientLabel, options: clientOptions })}</div><div class="form-field full-span"><label>Notification time</label><input name="remind_at" type="datetime-local" value="${localTime}"><small class="field-help">Use this for one-time, daily, or weekly reminders.</small></div><div class="form-field"><label>Email to notify</label><input name="email" type="email" value="${escapeHtml(reminder?.email || '')}" placeholder="you@example.com" required></div><div class="form-field"><label>Minutes after session</label><input name="trigger_after_minutes" type="number" min="0" step="1" value="${reminder?.trigger_after_minutes || 0}"><small class="field-help">Used for after-session reminders.</small></div><div class="modal-actions full-span">${reminder ? '<button type="button" class="button danger" id="delete-reminder">Delete reminder</button>' : ''}<button class="button">Save reminder</button></div></form></section></div>`;
}
