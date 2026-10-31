import { escapeHtml, money, monthLabel } from './format.js';

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

function monthOptions(month) {
  return Array.from({ length: 13 }, (_, index) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + index - 6);
    const value = date.toISOString().slice(0, 7);
    return `<option value="${value}" ${value === month ? 'selected' : ''}>${monthLabel(value)}</option>`;
  }).join('');
}

function meetingCard(meeting) {
  const date = new Date(`${meeting.meeting_date}T12:00:00`);
  return `<div class="meeting"><div><div class="meeting-date">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div class="meeting-time">${escapeHtml(meeting.start_time.slice(0, 5))}</div></div><div><div class="meeting-name">${escapeHtml(meeting.clients?.name || 'Client')}<span class="status-pill ${meeting.status === 'cancelled' ? 'cancelled' : ''}">${escapeHtml(meeting.status)}</span></div><div class="meeting-meta">${meeting.status === 'completed' ? 'Completed session' : 'Scheduled session'}</div></div><div class="meeting-cost">${money(meeting.cost)}</div></div>`;
}

export function renderDashboard(root, workspace, month) {
  const meetings = [...workspace.meetings].sort((a, b) => `${a.meeting_date}${a.start_time}`.localeCompare(`${b.meeting_date}${b.start_time}`));
  const completedTotal = meetings.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.cost || 0), 0);
  root.innerHTML = `<main class="dashboard"><header class="topbar"><div class="brand-mark"><span class="mark">✦</span> stillpoint</div><div class="user-actions"><span class="avatar">${escapeHtml((workspace.user?.email || 'T').slice(0, 1).toUpperCase())}</span><button class="button secondary" id="logout">Sign out</button></div></header><section class="intro"><div><div class="eyebrow">Private practice · Israel</div><h1>Your month, in view.</h1><p>Sessions, fees, and payments — together in one place.</p></div><div class="month-picker"><button id="previous-month" aria-label="Previous month">‹</button><select id="month-select" aria-label="Reporting month">${monthOptions(month)}</select><button id="next-month" aria-label="Next month">›</button></div></section><section class="summary-grid"><article class="summary-card"><div class="summary-label">Sessions this month</div><div class="summary-value">${meetings.length}</div></article><article class="summary-card mint"><div class="summary-label">Fees charged</div><div class="summary-value">${money(completedTotal)}</div></article><article class="summary-card lilac"><div class="summary-label">Upcoming</div><div class="summary-value">${meetings.filter((item) => item.status === 'scheduled').length}</div></article></section><section class="section-grid"><article class="panel"><div class="panel-header"><h2>Sessions</h2><button class="button" id="new-meeting">+ New session</button></div><div class="meeting-list">${meetings.length ? meetings.map(meetingCard).join('') : '<div class="empty"><strong>Your month is clear.</strong>Add a session when one is ready to schedule.</div>'}</div></article><aside class="panel"><div class="panel-header"><h2>Clients & fees</h2><button class="button secondary" id="new-client">Add client</button></div><div class="meeting-list">${workspace.clients.map((client) => `<div class="meeting" style="grid-template-columns:1fr auto"><div><div class="meeting-name">${escapeHtml(client.name)}</div><div class="meeting-meta">${escapeHtml(client.email || 'No email added')}</div></div><div class="meeting-cost">${money(client.default_fee)}</div></div>`).join('')}</div></aside></section></main>`;
}

export function renderModal(type, clients) {
  const meeting = type === 'meeting';
  const today = new Date().toISOString().slice(0, 10);
  const clientOptions = clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)} · ${money(client.default_fee)}</option>`).join('');
  return `<div class="modal-backdrop" id="modal-backdrop"><section class="modal"><div class="modal-header"><h2>${meeting ? 'Schedule a session' : 'Add a client'}</h2><button class="close" id="close-modal">×</button></div><form id="modal-form" class="form-grid">${meeting ? `<div class="form-field full-span"><label>Client</label><select name="client_id" required>${clientOptions}</select></div><div class="form-field"><label>Date</label><input name="meeting_date" type="date" value="${today}" required></div><div class="form-field"><label>Time</label><input name="start_time" type="time" value="09:00" required></div><div class="form-field"><label>Fee</label><input name="cost" type="number" min="0" step="10" required></div><div class="form-field"><label>Outcome</label><select name="status"><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>` : `<div class="form-field full-span"><label>Name</label><input name="name" required placeholder="Client name"></div><div class="form-field full-span"><label>Email (optional)</label><input name="email" type="email" placeholder="client@example.com"></div><div class="form-field full-span"><label>Default fee</label><input name="default_fee" type="number" min="0" step="10" required></div>`}<div class="full-span"><button class="button full">Save ${meeting ? 'session' : 'client'}</button></div></form></section></div>`;
}
