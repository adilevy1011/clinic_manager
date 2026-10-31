import {
  createRecord,
  createReminder,
  deleteReminder,
  deleteMeeting,
  isDemo,
  loadWorkspace,
  login,
  logout,
  updateClient,
  updateMeeting,
  updateReminder,
} from './api.js';
import { currentDate, currentMonth, sampleWorkspace, shiftDate, shiftMonth } from './data.js';
import { DEFAULT_DISPLAY_CURRENCY, DEFAULT_USD_TO_ILS, getOfficialShekelRate } from './currency.js';
import {
  renderClientProfile,
  renderDashboard,
  renderLogin,
  renderModal,
  renderReminderModal,
} from './views.js';

const root = document.querySelector('#app');
const demo = isDemo();
let month = currentMonth();
let workspace = null;
let calendarMode = 'month';
let focusDate = currentDate();
const demoWorkspace = structuredClone(sampleWorkspace);
let exchangeRate = Number(localStorage.getItem('stillpoint-usd-ils-rate')) || DEFAULT_USD_TO_ILS;

async function refresh() {
  workspace = demo
    ? {
      ...demoWorkspace,
      clients: [...demoWorkspace.clients],
      meetings: [...demoWorkspace.meetings],
    }
    : await loadWorkspace(
      month,
      calendarMode === 'week'
        ? [shiftMonth(month, -1), shiftMonth(month, 1)]
        : [],
    );

  renderDashboard(root, workspace, month, exchangeRate, calendarMode, focusDate);
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
      focusDate = `${month}-01`;
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

  document.querySelectorAll('[data-calendar-mode]').forEach((modeButton) => {
    modeButton.onclick = () => {
      calendarMode = modeButton.dataset.calendarMode;
      renderDashboard(root, workspace, month, exchangeRate, calendarMode, focusDate);
      bindDashboard();
    };
  });

  document.querySelector('#calendar-today').onclick = () => {
    month = currentMonth();
    focusDate = currentDate();
    renderDashboard(root, workspace, month, exchangeRate, calendarMode, focusDate);
    bindDashboard();
  };

  document.querySelectorAll('.calendar-day[data-calendar-date]').forEach((day) => {
    day.onclick = (event) => {
      if (event.target.closest('[data-meeting-id]')) return;
      focusDate = day.dataset.calendarDate;
      calendarMode = 'day';
      renderDashboard(root, workspace, month, exchangeRate, calendarMode, focusDate);
      bindDashboard();
    };
  });

  document.querySelectorAll('[data-day-add]').forEach((button) => {
    button.onclick = () => openModal('meeting', { date: button.dataset.dayAdd });
  });

  document.querySelectorAll('[data-meeting-id]').forEach((eventElement) => {
    eventElement.onclick = (event) => {
      event.stopPropagation();
      const meeting = workspace.meetings.find((item) => item.id === eventElement.dataset.meetingId);
      if (meeting) openModal('meeting', { meeting });
    };
  });

  document.querySelector('#previous-month').onclick = async () => {
    navigateCalendar(-1);
    await refresh();
  };
  document.querySelector('#next-month').onclick = async () => {
    navigateCalendar(1);
    await refresh();
  };
  document.querySelector('#calendar-previous').onclick = async () => {
    navigateCalendar(-1);
    await refresh();
  };
  document.querySelector('#calendar-next').onclick = async () => {
    navigateCalendar(1);
    await refresh();
  };
  document.querySelector('#new-meeting').onclick = () => openModal('meeting');
  document.querySelector('#new-today-meeting').onclick = () => openModal('meeting', { date: currentDate() });
  document.querySelector('#new-client').onclick = () => openModal('client');
  document.querySelector('#new-reminder').onclick = () => openReminderModal();
  document.querySelectorAll('[data-client-id]').forEach((clientButton) => {
    clientButton.onclick = () => openClientProfile(clientButton.dataset.clientId);
  });
  document.querySelectorAll('[data-reminder-id]').forEach((reminderButton) => {
    reminderButton.onclick = () => {
      const reminder = workspace.reminders.find((item) => item.id === reminderButton.dataset.reminderId);
      if (reminder) openReminderModal(reminder);
    };
  });
}

function navigateCalendar(direction) {
  if (calendarMode === 'month') {
    month = shiftMonth(month, direction);
    focusDate = `${month}-01`;
    return;
  }

  focusDate = shiftDate(focusDate, calendarMode === 'week' ? direction * 7 : direction);
  month = focusDate.slice(0, 7);
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

function openModal(type, options = {}) {
  document.body.insertAdjacentHTML('beforeend', renderModal(type, workspace.clients, exchangeRate, options.meeting, options.date));
  const modal = document.querySelector('#modal-backdrop');
  const form = document.querySelector('#modal-form');

  document.querySelector('#close-modal').onclick = () => modal.remove();
  bindCustomSelects(modal, () => {});
  bindMoneyInputs(modal);

  const clientSelect = document.querySelector('#client-select');
  if (clientSelect?.dataset.value === '__new__') setNewClientVisibility(true);

  const deleteButton = document.querySelector('#delete-meeting');
  if (deleteButton && options.meeting) {
    deleteButton.onclick = async () => {
      if (!window.confirm('Delete this session?')) return;
      try {
        if (demo) {
          const index = demoWorkspace.meetings.findIndex((item) => item.id === options.meeting.id);
          if (index >= 0) demoWorkspace.meetings.splice(index, 1);
        } else {
          await deleteMeeting(options.meeting.id);
        }
        modal.remove();
        await refresh();
      } catch (error) {
        window.alert(error.message);
      }
    };
  }

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
          payment_status: values.payment_status || 'unpaid',
          amount_paid: values.payment_status === 'paid'
            ? Number(values.cost_ils || 0)
            : Number(values.amount_paid_ils || 0),
          notes: options.meeting ? (values.notes || '') : (values.notes || undefined),
        };

        if (demo) {
          const client = demoWorkspace.clients.find((item) => item.id === clientId);
          if (options.meeting) {
            const savedMeeting = demoWorkspace.meetings.find((item) => item.id === options.meeting.id);
            if (savedMeeting) Object.assign(savedMeeting, meetingPayload, { clients: { name: client?.name || 'Client' } });
          } else {
            demoWorkspace.meetings.push({ ...meetingPayload, id: crypto.randomUUID(), clients: { name: client?.name || 'Client' } });
          }
        } else if (options.meeting) {
          await updateMeeting(options.meeting.id, meetingPayload);
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

function openReminderModal(reminder = null) {
  document.body.insertAdjacentHTML('beforeend', renderReminderModal(reminder, workspace.clients));
  const modal = document.querySelector('#reminder-modal-backdrop');
  const form = document.querySelector('#reminder-form');

  document.querySelector('#close-reminder').onclick = () => modal.remove();
  bindCustomSelects(modal, () => {});

  const deleteButton = document.querySelector('#delete-reminder');
  if (deleteButton && reminder) {
    deleteButton.onclick = async () => {
      if (!window.confirm('Delete this reminder?')) return;
      try {
        if (demo) {
          const index = demoWorkspace.reminders.findIndex((item) => item.id === reminder.id);
          if (index >= 0) demoWorkspace.reminders.splice(index, 1);
        } else {
          await deleteReminder(reminder.id);
        }
        modal.remove();
        await refresh();
      } catch (error) {
        window.alert(error.message);
      }
    };
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(form);
    if (values.recurrence === 'after_session' && !values.client_id) {
      window.alert('Choose a client for an after-session reminder.');
      return;
    }

    const payload = {
      title: values.title,
      body: values.body || undefined,
      remind_at: values.remind_at ? new Date(values.remind_at).toISOString() : undefined,
      recurrence: values.recurrence,
      client_id: values.client_id || undefined,
      email: values.email,
      trigger_after_minutes: Number(values.trigger_after_minutes || 0),
    };

    try {
      if (demo) {
        if (reminder) {
          const saved = demoWorkspace.reminders.find((item) => item.id === reminder.id);
          if (saved) Object.assign(saved, payload);
        } else {
          demoWorkspace.reminders.push({ ...payload, id: crypto.randomUUID() });
        }
      } else if (reminder) {
        await updateReminder(reminder.id, payload);
      } else {
        await createReminder(payload);
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
