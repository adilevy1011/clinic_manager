import { createRecord, isDemo, loadWorkspace, login, logout } from './api.js';
import { currentMonth, sampleWorkspace, shiftMonth } from './data.js';
import { renderDashboard, renderLogin, renderModal } from './views.js';

const root = document.querySelector('#app');
const demo = isDemo();
let month = currentMonth();
let workspace = null;

async function refresh() {
  workspace = demo
    ? { ...sampleWorkspace, meetings: sampleWorkspace.meetings.filter((item) => item.meeting_date.startsWith(month)) }
    : await loadWorkspace(month);
  renderDashboard(root, workspace, month);
  bindDashboard();
}

function bindDashboard() {
  document.querySelector('#logout').onclick = async () => { if (!demo) await logout(); renderLogin(root, { demo }); bindLogin(); };
  document.querySelector('#month-select').onchange = async (event) => { month = event.target.value; await refresh(); };
  document.querySelector('#previous-month').onclick = async () => { month = shiftMonth(month, -1); await refresh(); };
  document.querySelector('#next-month').onclick = async () => { month = shiftMonth(month, 1); await refresh(); };
  document.querySelector('#new-meeting').onclick = () => openModal('meeting');
  document.querySelector('#new-client').onclick = () => openModal('client');
}

function bindLogin() {
  document.querySelector('#login-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    try {
      if (demo) workspace = { ...sampleWorkspace };
      else await login(values.email, values.password);
      await refresh();
    } catch (error) { renderLogin(root, { demo, error: error.message }); bindLogin(); }
  };
}

function openModal(type) {
  document.body.insertAdjacentHTML('beforeend', renderModal(type, workspace.clients));
  document.querySelector('#close-modal').onclick = () => document.querySelector('#modal-backdrop').remove();
  document.querySelector('#modal-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    try {
      if (demo) {
        if (type === 'meeting') {
          const client = workspace.clients.find((item) => item.id === values.client_id);
          workspace.meetings.push({ ...values, id: crypto.randomUUID(), cost: Number(values.cost), clients: { name: client?.name || 'Client' } });
        } else workspace.clients.push({ ...values, id: crypto.randomUUID(), default_fee: Number(values.default_fee) });
      } else await createRecord(type, { ...values, cost: values.cost ? Number(values.cost) : undefined, default_fee: values.default_fee ? Number(values.default_fee) : undefined });
      document.querySelector('#modal-backdrop').remove();
      await refresh();
    } catch (error) { window.alert(error.message); }
  };
}

export async function boot() {
  try { await refresh(); } catch { renderLogin(root, { demo }); bindLogin(); }
}
