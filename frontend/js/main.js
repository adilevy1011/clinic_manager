import { createRecord, isDemo, loadWorkspace, login, logout, updateClient } from './api.js';
import { currentMonth, sampleWorkspace, shiftMonth } from './data.js';
import { DEFAULT_DISPLAY_CURRENCY, DEFAULT_USD_TO_ILS, getOfficialShekelRate } from './currency.js';
import { renderClientProfile, renderDashboard, renderLogin, renderModal } from './views.js';

const root = document.querySelector('#app');
const demo = isDemo();
let month = currentMonth();
let workspace = null;
const demoWorkspace = structuredClone(sampleWorkspace);
let exchangeRate = Number(localStorage.getItem('stillpoint-usd-ils-rate')) || DEFAULT_USD_TO_ILS;

async function refresh() {
  workspace = demo
    ? {
      ...demoWorkspace,
      clients: [...demoWorkspace.clients],
      meetings: demoWorkspace.meetings.filter((item) => item.meeting_date.startsWith(month)),
    }
    : await loadWorkspace(month);

  renderDashboard(root, workspace, month, exchangeRate);
  bindDashboard();
}

function bindDashboard() {
  document.querySelector('#logout').onclick = async () => {
    if (!demo) await logout();
    renderLogin(root, { demo });
    bindLogin();
  };

  bindCustomSelects(root, async (select, value) => {
    if (select.id === 'month-select') {
      month = value;
      await refresh();
    }
  });

  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('[data-tab]').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach((panel) => panel.classList.add('hidden'));
      tab.classList.add('active');
      document.querySelector(`#${tab.dataset.tab}`).classList.remove('hidden');
    };
  });

  document.querySelector('#previous-month').onclick = async () => {
    month = shiftMonth(month, -1);
    await refresh();
  };
  document.querySelector('#next-month').onclick = async () => {
    month = shiftMonth(month, 1);
    await refresh();
  };
  document.querySelector('#new-meeting').onclick = () => openModal('meeting');
  document.querySelector('#new-client').onclick = () => openModal('client');
  document.querySelectorAll('[data-client-id]').forEach((clientButton) => {
    clientButton.onclick = () => openClientProfile(clientButton.dataset.clientId);
  });
}

function bindLogin() {
  document.querySelector('#login-form').onsubmit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));

    try {
      if (!demo) await login(values.email, values.password);
      await refresh();
    } catch (error) {
      renderLogin(root, { demo, error: error.message });
      bindLogin();
    }
  };
}

function bindCustomSelects(scope, onChange) {
  scope.querySelectorAll('[data-select]').forEach((select) => {
    const trigger = select.querySelector('.select-trigger');
    const menu = select.querySelector('.select-menu');

    trigger.onclick = (event) => {
      event.stopPropagation();
      scope.querySelectorAll('[data-select].is-open').forEach((other) => {
        if (other !== select) other.classList.remove('is-open');
      });
      select.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', select.classList.contains('is-open'));
    };

    menu.querySelectorAll('[data-option]').forEach((option) => {
      option.onclick = async () => {
        const value = option.dataset.option;
        select.dataset.value = value;
        select.querySelector('.select-label').textContent = option.textContent;
        menu.querySelectorAll('[data-option]').forEach((item) => item.classList.remove('selected'));
        option.classList.add('selected');
        select.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');

        if (select.id === 'client-select') {
          setNewClientVisibility(value === '__new__');
          const selectedClient = workspace.clients.find((client) => client.id === value);
          const moneyGroup = document.querySelector('[data-prefix="cost"]');
          if (moneyGroup) moneyGroup.dataset.currency = selectedClient?.currency || 'ILS';
        }
        await onChange?.(select, value);
      };
    });
  });

  document.onclick = () => scope.querySelectorAll('[data-select].is-open').forEach((select) => select.classList.remove('is-open'));
}

function setNewClientVisibility(visible) {
  const fields = document.querySelector('.new-client-fields');
  if (!fields) return;
  fields.hidden = !visible;
  fields.querySelector('[name="new_client_name"]').required = visible;
}

function bindMoneyInputs(scope) {
  scope.querySelectorAll('[data-money-group]').forEach((group) => {
    const prefix = group.dataset.prefix;
    const ilsInput = group.querySelector(`[name="${prefix}_ils"]`);
    const usdInput = group.querySelector(`[name="${prefix}_usd"]`);

    ilsInput.oninput = () => {
      group.dataset.currency = 'ILS';
      usdInput.value = ilsInput.value ? (Number(ilsInput.value) / exchangeRate).toFixed(2) : '';
    };
    usdInput.oninput = () => {
      group.dataset.currency = 'USD';
      ilsInput.value = usdInput.value ? (Number(usdInput.value) * exchangeRate).toFixed(2) : '';
    };
  });

  const rateInput = scope.querySelector('[name="exchange_rate"]');
  if (rateInput) {
    rateInput.onchange = () => {
      exchangeRate = Number(rateInput.value) || DEFAULT_USD_TO_ILS;
      localStorage.setItem('stillpoint-usd-ils-rate', exchangeRate.toString());
      bindMoneyInputs(scope);
    };
  }
}

function formValues(form) {
  const values = Object.fromEntries(new FormData(form));
  form.querySelectorAll('[data-select]').forEach((select) => {
    values[select.dataset.name] = select.dataset.value;
  });
  form.querySelectorAll('[data-money-group]').forEach((group) => {
    values[`${group.dataset.prefix}_currency`] = group.dataset.currency || 'ILS';
  });
  return values;
}

function openModal(type) {
  document.body.insertAdjacentHTML('beforeend', renderModal(type, workspace.clients, exchangeRate));
  const modal = document.querySelector('#modal-backdrop');
  const form = document.querySelector('#modal-form');

  document.querySelector('#close-modal').onclick = () => modal.remove();
  bindCustomSelects(modal, () => {});
  bindMoneyInputs(modal);

  const clientSelect = document.querySelector('#client-select');
  if (clientSelect?.dataset.value === '__new__') setNewClientVisibility(true);

  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(form);
    exchangeRate = Number(values.exchange_rate) || exchangeRate;
    localStorage.setItem('stillpoint-usd-ils-rate', exchangeRate.toString());

    try {
      if (type === 'meeting') {
        let clientId = values.client_id;

        if (clientId === '__new__') {
          const clientPayload = {
            name: values.new_client_name,
            email: values.new_client_email || undefined,
            default_fee: Number(values.new_client_fee_ils || 0),
            currency: values.new_client_fee_currency || DEFAULT_DISPLAY_CURRENCY,
          };

          if (demo) {
            clientId = crypto.randomUUID();
            demoWorkspace.clients.push({ ...clientPayload, id: clientId });
          } else {
            const created = await createRecord('client', clientPayload);
            clientId = created.id;
          }
        }

        const meetingPayload = {
          client_id: clientId,
          meeting_date: values.meeting_date,
          start_time: values.start_time,
          cost: Number(values.cost_ils || 0),
          currency: values.cost_currency || DEFAULT_DISPLAY_CURRENCY,
          status: values.status,
          notes: values.notes || undefined,
        };

        if (demo) {
          const client = demoWorkspace.clients.find((item) => item.id === clientId);
          demoWorkspace.meetings.push({ ...meetingPayload, id: crypto.randomUUID(), clients: { name: client?.name || 'Client' } });
        } else {
          await createRecord('meeting', meetingPayload);
        }
      } else {
        const clientPayload = {
          name: values.name,
          email: values.email || undefined,
          default_fee: Number(values.default_fee_ils || 0),
          currency: values.default_fee_currency || DEFAULT_DISPLAY_CURRENCY,
          notes: values.notes || undefined,
        };

        if (demo) demoWorkspace.clients.push({ ...clientPayload, id: crypto.randomUUID() });
        else await createRecord('client', clientPayload);
      }

      modal.remove();
      await refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };
}

function openClientProfile(clientId) {
  const client = workspace.clients.find((item) => item.id === clientId);
  if (!client) return;

  document.body.insertAdjacentHTML('beforeend', renderClientProfile(client, exchangeRate));
  const modal = document.querySelector('#client-profile-backdrop');
  const form = document.querySelector('#client-profile-form');

  document.querySelector('#close-client-profile').onclick = () => modal.remove();
  bindMoneyInputs(modal);

  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(form);
    const payload = {
      name: values.name,
      email: values.email || '',
      default_fee: Number(values.default_fee_ils || 0),
      currency: values.default_fee_currency || DEFAULT_DISPLAY_CURRENCY,
      notes: values.notes || '',
    };

    try {
      if (demo) {
        Object.assign(client, payload);
        const savedClient = demoWorkspace.clients.find((item) => item.id === clientId);
        if (savedClient) Object.assign(savedClient, payload);
      } else {
        await updateClient(clientId, payload);
      }

      modal.remove();
      await refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };
}

export async function boot() {
  try {
    if (!localStorage.getItem('stillpoint-usd-ils-rate')) {
      exchangeRate = await getOfficialShekelRate();
    }
    await refresh();
  } catch {
    renderLogin(root, { demo });
    bindLogin();
  }
}
