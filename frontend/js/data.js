export const sampleWorkspace = {
  user: { name: 'Therapist' },
  reminders: [
    { id: 'r1', title: 'Send intake form', body: 'Follow up before the first appointment.', remind_at: '2026-10-30T10:00:00-07:00', recurrence: 'once', email: '' },
    { id: 'r2', title: 'Write session note', body: 'Capture the main themes while they are fresh.', recurrence: 'after_session', client_id: 'a', trigger_after_minutes: 30, clients: { name: 'Noa Levi' }, email: '' },
  ],
  clients: [
    { id: 'a', name: 'Noa Levi', default_fee: 420 },
    { id: 'b', name: 'Daniel Cohen', default_fee: 420 },
    { id: 'c', name: 'Maya Bar', default_fee: 360 },
  ],
  meetings: [
    {
      id: '1', meeting_date: '2026-10-31', start_time: '09:00', cost: 420,
      status: 'scheduled', clients: { name: 'Noa Levi' },
    },
    {
      id: '2', meeting_date: '2026-10-31', start_time: '11:30', cost: 420,
      status: 'completed', clients: { name: 'Daniel Cohen' },
    },
    {
      id: '3', meeting_date: '2026-10-29', start_time: '16:00', cost: 360,
      status: 'completed', clients: { name: 'Maya Bar' },
    },
  ],
};

export function currentMonth() {
  return currentDate().slice(0, 7);
}

export function currentDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shiftMonth(month, amount) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function shiftDate(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}
