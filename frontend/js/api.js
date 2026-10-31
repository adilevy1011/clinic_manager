import { API_URL, DEMO_MODE } from './config.js';

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || 'Something went wrong.');
  }

  return response.status === 204 ? null : response.json();
}

export async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export async function loadWorkspace(month, additionalMonths = []) {
  const months = [month, ...additionalMonths];
  const [me, clients, reminders, ...meetingResponses] = await Promise.all([
    request('/me'),
    request('/clients'),
    request('/reminders'),
    ...months.map((value) => request(`/meetings?month=${value}`)),
  ]);

  const meetings = [...new Map(
    meetingResponses.flat().map((meeting) => [meeting.id, meeting]),
  ).values()];

  return { user: me.user, meetings, clients, reminders };
}

export async function createRecord(kind, payload) {
  return request(kind === 'meeting' ? '/meetings' : '/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateClient(clientId, payload) {
  return request(`/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateMeeting(meetingId, payload) {
  return request(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMeeting(meetingId) {
  return request(`/meetings/${meetingId}`, { method: 'DELETE' });
}

export async function createReminder(payload) {
  return request('/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReminder(reminderId, payload) {
  return request(`/reminders/${reminderId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteReminder(reminderId) {
  return request(`/reminders/${reminderId}`, { method: 'DELETE' });
}

export function isDemo() {
  return DEMO_MODE;
}
