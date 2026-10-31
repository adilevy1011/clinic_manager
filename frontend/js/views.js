import {
  DEFAULT_DISPLAY_CURRENCY,
  DEFAULT_USD_TO_ILS,
  ils,
  primary,
  secondary,
  usd,
} from './currency.js';
import { escapeHtml, monthLabel } from './format.js';

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

  return `<div class="meeting">
    <div><div class="meeting-date">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div class="meeting-time">${escapeHtml(meeting.start_time.slice(0, 5))}</div></div>
    <div><div class="meeting-name">${escapeHtml(meeting.clients?.name || 'Client')}<span class="status-pill ${meeting.status === 'cancelled' ? 'cancelled' : ''}">${escapeHtml(meeting.status)}</span></div><div class="meeting-meta">${meeting.status === 'completed' ? 'Completed session' : 'Scheduled session'}${comment}</div></div>
    <div class="meeting-cost"><strong>${primary(meeting.cost, currency, rate)}</strong><small>${secondary(meeting.cost, currency, rate)}</small></div>
  </div>`;
}

function calendarMarkup(month, meetings, rate) {
  const first = new Date(`${month}-01T12:00:00`);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  return `<div class="calendar-grid"><div class="calendar-weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div>${day}</div>`).join('')}</div><div class="calendar-days">${Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const date = day.toISOString().slice(0, 10);
    const dayMeetings = meetings.filter((meeting) => meeting.meeting_date === date);
    return `<div class="calendar-day ${date.startsWith(month) ? '' : 'outside-month'}"><div class="day-number">${day.getDate()}</div>${dayMeetings.map((meeting) => `<div class="calendar-event ${meeting.status}" title="${escapeHtml(meeting.clients?.name || 'Client')} · ${escapeHtml(meeting.start_time.slice(0, 5))}"><span>${escapeHtml(meeting.start_time.slice(0, 5))}</span> ${escapeHtml(meeting.clients?.name || 'Client')}<b>${primary(meeting.cost, meeting.currency || DEFAULT_DISPLAY_CURRENCY, rate)}</b></div>`).join('')}</div>`;
  }).join('')}</div></div>`;
}

function clientRow(client, rate) {
  const currency = client.currency || DEFAULT_DISPLAY_CURRENCY;
  return `<button class="client-row" data-client-id="${escapeHtml(client.id)}"><span><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.email || 'No email added')}</small></span><span class="meeting-cost"><strong>${primary(client.default_fee, currency, rate)}</strong><small>${secondary(client.default_fee, currency, rate)}</small></span><span class="client-arrow">›</span></button>`;
}

export function renderDashboard(root, workspace, month, rate = DEFAULT_USD_TO_ILS) {
  const meetings = [...workspace.meetings].sort((a, b) => `${a.meeting_date}${a.start_time}`.localeCompare(`${b.meeting_date}${b.start_time}`));
  const completedTotal = meetings.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.cost || 0), 0);

  root.innerHTML = `<main class="dashboard">
    <header class="topbar"><div class="brand-mark"><span class="mark">✦</span> stillpoint</div><div class="user-actions"><span class="avatar">${escapeHtml((workspace.user?.email || workspace.user?.name || 'T').slice(0, 1).toUpperCase())}</span><button class="button secondary" id="logout">Sign out</button></div></header>
    <section class="intro"><div><div class="eyebrow">Private practice · Israel</div><h1>Your month, in view.</h1><p>Sessions, fees, and payments — together in one place.</p></div><div class="month-controls"><button class="icon-button" id="previous-month" aria-label="Previous month">‹</button>${monthPicker(month)}<button class="icon-button" id="next-month" aria-label="Next month">›</button></div></section>
    <section class="summary-grid"><article class="summary-card"><div class="summary-label">Sessions this month</div><div class="summary-value">${meetings.length}</div></article><article class="summary-card mint"><div class="summary-label">Fees charged · ILS</div><div class="summary-value">${ils(completedTotal)} <small>${usd(completedTotal, rate)}</small></div></article><article class="summary-card lilac"><div class="summary-label">Upcoming</div><div class="summary-value">${meetings.filter((item) => item.status === 'scheduled').length}</div></article></section>
    <nav class="view-tabs" aria-label="Workspace views"><button class="tab-button active" data-tab="calendar-view">Calendar</button><button class="tab-button" data-tab="sessions-view">Sessions</button><button class="tab-button" data-tab="clients-view">Clients</button><button class="button tab-action" id="new-meeting">+ New session</button></nav>
    <section class="view-panel" id="calendar-view"><section class="panel calendar-panel"><div class="panel-header"><div><h2>Calendar</h2><p class="panel-note">${monthLabel(month)} · ${meetings.length} sessions</p></div></div>${calendarMarkup(month, meetings, rate)}</section></section>
    <section class="view-panel hidden" id="sessions-view"><section class="panel"><div class="panel-header"><h2>Sessions</h2></div><div class="meeting-list">${meetings.length ? meetings.map((meeting) => meetingCard(meeting, rate)).join('') : '<div class="empty"><strong>Your month is clear.</strong>Add a session when one is ready to schedule.</div>'}</div></section></section>
    <section class="view-panel hidden" id="clients-view"><section class="panel"><div class="panel-header"><div><h2>Clients</h2><p class="panel-note">Select a client to view and edit their profile.</p></div><button class="button secondary" id="new-client">Add client</button></div><div class="client-list">${workspace.clients.length ? workspace.clients.map((client) => clientRow(client, rate)).join('') : '<div class="empty"><strong>No clients yet.</strong>Add a client to get started.</div>'}</div></section></section>
  </main>`;
}

function moneyFields(prefix, value = '', required = true, currency = DEFAULT_DISPLAY_CURRENCY) {
  return `<div class="money-fields full-span" data-money-group data-prefix="${prefix}" data-currency="${currency}"><div class="form-field"><label>Fee in shekels (₪)</label><input name="${prefix}_ils" type="number" min="0" step="0.01" value="${value}" inputmode="decimal" ${required ? 'required' : ''}></div><div class="form-field"><label>Fee in dollars ($)</label><input name="${prefix}_usd" type="number" min="0" step="0.01" inputmode="decimal"></div><div class="currency-memory">This record remembers the last currency you use.</div></div>`;
}

export function renderModal(type, clients, rate = DEFAULT_USD_TO_ILS) {
  const meeting = type === 'meeting';
  const today = new Date().toISOString().slice(0, 10);
  const clientOptions = clients.map((client) => ({ value: client.id, label: `${client.name} · ${primary(client.default_fee, client.currency || DEFAULT_DISPLAY_CURRENCY, rate)}` }));
  if (meeting) clientOptions.push({ value: '__new__', label: '+ Create a new client' });
  const selectedClient = clients[0];
  const selectedCurrency = selectedClient?.currency || DEFAULT_DISPLAY_CURRENCY;
  const statusOptions = [{ value: 'scheduled', label: 'Scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];

  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal"><div class="modal-header"><div><div class="eyebrow">${meeting ? 'Calendar entry' : 'Client directory'}</div><h2>${meeting ? 'Schedule a session' : 'Add a client'}</h2></div><button class="close" id="close-modal" aria-label="Close">×</button></div><form id="modal-form" class="form-grid">${meeting ? `<div class="form-field full-span"><label>Client</label>${customSelect({ id: 'client-select', name: 'client_id', value: selectedClient?.id || '__new__', label: selectedClient?.name || '+ Create a new client', options: clientOptions })}</div><div class="new-client-fields full-span" hidden><div class="inline-heading">New client details</div><div class="form-field"><label>Name</label><input name="new_client_name" placeholder="Client name"></div><div class="form-field"><label>Email (optional)</label><input name="new_client_email" type="email" placeholder="client@example.com"></div>${moneyFields('new_client_fee', '', false)}</div><div class="form-field"><label>Date</label><input name="meeting_date" type="date" value="${today}" required></div><div class="form-field"><label>Time</label><input name="start_time" type="time" value="09:00" required></div>${moneyFields('cost', '', true, selectedCurrency)}<div class="form-field"><label>Outcome</label>${customSelect({ id: 'status-select', name: 'status', value: 'scheduled', label: 'Scheduled', options: statusOptions })}</div><div class="form-field full-span"><label>Comments about this meeting</label><textarea name="notes" rows="3" maxlength="1000" placeholder="Private notes about the session"></textarea></div><div class="rate-note full-span">Working rate: 1 USD = <input name="exchange_rate" value="${rate.toFixed(2)}" type="number" min="0.01" step="0.01"> ILS. Both fee fields stay in sync.</div>` : `<div class="form-field full-span"><label>Name</label><input name="name" required placeholder="Client name"></div><div class="form-field full-span"><label>Email (optional)</label><input name="email" type="email" placeholder="client@example.com"></div>${moneyFields('default_fee')}<div class="form-field full-span"><label>Client comments</label><textarea name="notes" rows="4" maxlength="3000" placeholder="Context, preferences, or private notes"></textarea></div><div class="rate-note full-span">Working rate: 1 USD = <input name="exchange_rate" value="${rate.toFixed(2)}" type="number" min="0.01" step="0.01"> ILS.</div>`}<div class="full-span"><button class="button full">Save ${meeting ? 'session' : 'client'}</button></div></form></section></div>`;
}

export function renderClientProfile(client, rate = DEFAULT_USD_TO_ILS) {
  const currency = client.currency || DEFAULT_DISPLAY_CURRENCY;
  return `<div class="modal-backdrop" id="client-profile-backdrop"><section class="modal profile-modal"><div class="modal-header"><div><div class="eyebrow">Client profile</div><h2>${escapeHtml(client.name)}</h2></div><button class="close" id="close-client-profile" aria-label="Close">×</button></div><form id="client-profile-form" class="form-grid"><div class="form-field full-span"><label>Name</label><input name="name" value="${escapeHtml(client.name)}" required></div><div class="form-field full-span"><label>Email</label><input name="email" type="email" value="${escapeHtml(client.email || '')}"></div>${moneyFields('default_fee', '', true, currency)}<div class="form-field full-span"><label>Client comments</label><textarea name="notes" rows="7" maxlength="3000" placeholder="Context, preferences, or private notes">${escapeHtml(client.notes || '')}</textarea></div><div class="rate-note full-span">The saved currency preference is based on the last fee field you use.</div><div class="full-span"><button class="button full">Save profile</button></div></form></section></div>`;
}
