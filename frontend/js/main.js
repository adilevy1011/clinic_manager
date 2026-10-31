import {
  createRecord,
  createReminder,
  createPayment,
  deleteReminder,
  deletePayment,
  deleteMeeting,
  isDemo,
  loadWorkspace,
  loadClientFinance,
  loadMoneyManagement,
  login,
  logout,
  updateProfile,
  updateClient,
  updateMeeting,
  updateReminder,
} from './api.js';
import { currentDate, currentMonth, sampleWorkspace, shiftDate, shiftMonth } from './data.js';
import { DEFAULT_DISPLAY_CURRENCY, DEFAULT_USD_TO_ILS, getOfficialShekelRate } from './currency.js';
import {
  renderClientFinanceProfile,
  renderClientPage,
  renderDashboard,
  renderLogin,
  renderMoneyManagement,
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
      meetings: expandDemoMeetings(month),
    }
    : await loadWorkspace(
      month,
      calendarMode === 'week'
        ? [shiftMonth(month, -1), shiftMonth(month, 1)]
        : [],
    );

  if (root.dataset.page === 'client') {
    const clientId = new URLSearchParams(window.location.search).get('id');
    const client = workspace.clients.find((item) => item.id === clientId);
    if (!client) {
      window.location.href = '/clients';
      return;
    }
    let finance = demo ? demoClientFinance(clientId, month) : null;
    if (!demo) {
      try {
        finance = await loadClientFinance(clientId, month);
      } catch (error) {
        console.error('Client finance failed to load:', error);
        finance = {
          meetings: [],
          payments: [],
          meeting_balances: [],
          totals: { charged: 0, paid: 0, owed: 0 },
          error: 'Client finance could not be loaded. Apply the latest Supabase migrations and refresh.',
        };
      }
    }
    root.innerHTML = renderClientPage(client, exchangeRate, finance, month);
    bindClientPage(clientId);
    return;
  }

  if (root.dataset.page === 'money') {
    workspace.money = demo ? demoMoneyManagement(month) : await loadMoneyManagement(month);
  }

  renderDashboard(root, workspace, month, exchangeRate, calendarMode, focusDate);
  bindDashboard();
}

function expandDemoMeetings(monthValue) {
  const windowStart = `${monthValue}-01`;
  const windowEnd = shiftDate(`${shiftMonth(monthValue, 1)}-01`, -1);
  const exceptions = demoWorkspace.meetingExceptions || [];
  const output = demoWorkspace.meetings.filter((meeting) => !meeting.recurrence_rule && meeting.meeting_date >= windowStart && meeting.meeting_date <= windowEnd);

  demoWorkspace.meetings.filter((meeting) => meeting.recurrence_rule).forEach((series) => {
    const rule = series.recurrence_rule;
    const endDate = series.recurrence_end_date || windowEnd;
    const limit = endDate < windowEnd ? endDate : windowEnd;
    let cursor = series.meeting_date > windowStart ? series.meeting_date : windowStart;
    while (cursor <= limit) {
      const date = new Date(`${cursor}T12:00:00`);
      const start = new Date(`${series.meeting_date}T12:00:00`);
      let matches = false;
      if (rule.frequency === 'weekly') {
        const monday = new Date(start);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const currentMonday = new Date(date);
        currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
        const weekNumber = Math.round((currentMonday - monday) / 86400000) / 7;
        const weekday = (date.getDay() + 6) % 7;
        matches = weekNumber % Number(rule.interval || 1) === 0 && (rule.weekdays || []).includes(weekday);
      } else if (rule.frequency === 'monthly') {
        matches = date.getDate() === Number(rule.day || start.getDate())
          && ((date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth()) % Number(rule.interval || 1) === 0;
      }
      if (matches && cursor >= series.meeting_date) {
        const exception = exceptions.find((item) => item.series_id === (series.series_id || series.id) && item.recurrence_occurrence_date === cursor);
        if (!exception || exception.recurrence_exception_type !== 'cancelled') {
          output.push(exception ? { ...exception, is_exception: true, source_meeting_id: series.id } : { ...series, id: `${series.series_id || series.id}:${cursor}`, meeting_date: cursor, recurrence_occurrence_date: cursor, source_meeting_id: series.id, is_virtual: true });
        }
      }
      cursor = shiftDate(cursor, 1);
    }
  });

  return output.sort((a, b) => `${a.meeting_date}${a.start_time}`.localeCompare(`${b.meeting_date}${b.start_time}`));
}

function bindDashboard() {
  const logoutButton = document.querySelector('#logout');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      if (!demo) await logout();
      renderLogin(root, { demo });
      bindLogin();
    };
  }

  const settingsForm = document.querySelector('#settings-form');
  if (settingsForm) {
    settingsForm.onsubmit = async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(settingsForm));
      try {
        if (demo) {
          demoWorkspace.user.email = values.email;
          demoWorkspace.user.reminder_email = values.email;
        } else {
          await updateProfile({ email: values.email });
        }
        await refresh();
      } catch (error) {
        window.alert(error.message);
      }
    };
  }

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

  document.querySelector('#calendar-previous').onclick = async () => {
    navigateCalendar(-1);
    await refresh();
  };
  document.querySelector('#calendar-next').onclick = async () => {
    navigateCalendar(1);
    await refresh();
  };
  const moneyPrevious = document.querySelector('#money-previous');
  const moneyNext = document.querySelector('#money-next');
  if (moneyPrevious) moneyPrevious.onclick = async () => { month = shiftMonth(month, -1); await refresh(); };
  if (moneyNext) moneyNext.onclick = async () => { month = shiftMonth(month, 1); await refresh(); };
  document.querySelectorAll('[data-money-client-id]').forEach((clientButton) => {
    clientButton.onclick = () => {
      window.location.href = `/client?id=${encodeURIComponent(clientButton.dataset.moneyClientId)}`;
    };
  });
  document.querySelector('#new-meeting').onclick = () => openModal('meeting');
  document.querySelector('#new-today-meeting').onclick = () => openModal('meeting', { date: currentDate() });
  document.querySelector('#new-client').onclick = () => openModal('client');
  document.querySelector('#new-reminder').onclick = () => openReminderModal();
  document.querySelectorAll('[data-client-id]').forEach((clientButton) => {
    clientButton.onclick = () => {
      window.location.href = `/client?id=${encodeURIComponent(clientButton.dataset.clientId)}`;
    };
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
          if (moneyGroup) {
            const currency = selectedClient?.currency || DEFAULT_DISPLAY_CURRENCY;
            moneyGroup.dataset.currency = currency;
            setMoneyGroupAmount(moneyGroup, selectedClient?.default_fee || '', currency);
          }
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

function setMoneyGroupAmount(group, amountIls, currency) {
  const prefix = group.dataset.prefix;
  const ilsInput = group.querySelector(`[name="${prefix}_ils"]`);
  const usdInput = group.querySelector(`[name="${prefix}_usd"]`);
  ilsInput.value = amountIls === '' ? '' : Number(amountIls).toFixed(2);
  usdInput.value = amountIls === '' || currency !== 'USD'
    ? ''
    : (Number(amountIls) / exchangeRate).toFixed(2);
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

function chooseScopeDialog({ title, message, options }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'modal-backdrop scope-dialog-backdrop';
    dialog.innerHTML = `<section class="modal scope-dialog"><div class="modal-header"><div><div class="eyebrow">Recurring session</div><h2>${title}</h2></div><button type="button" class="close" data-scope-cancel aria-label="Close">×</button></div><p class="scope-dialog-message">${message}</p><div class="scope-choice-list">${options.map((option) => `<button type="button" class="button ${option.value === 'single' ? 'secondary' : ''}" data-scope-choice="${option.value}">${option.label}</button>`).join('')}</div></section>`;
    document.body.append(dialog);

    const finish = (value) => {
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector('[data-scope-cancel]').onclick = () => finish(null);
    dialog.querySelectorAll('[data-scope-choice]').forEach((button) => {
      button.onclick = () => finish(button.dataset.scopeChoice);
    });
  });
}

function openModal(type, options = {}) {
  document.body.insertAdjacentHTML('beforeend', renderModal(type, workspace.clients, exchangeRate, options.meeting, options.date));
  const modal = document.querySelector('#modal-backdrop');
  const form = document.querySelector('#modal-form');

  document.querySelector('#close-modal').onclick = () => modal.remove();
  bindCustomSelects(modal, () => {});
  bindMoneyInputs(modal);

  if (type === 'meeting' && !options.meeting) {
    const notesField = form.querySelector('[name="notes"]')?.closest('.form-field');
    const recurrenceBox = document.createElement('div');
    recurrenceBox.className = 'recurrence-box full-span';
    const meetingDate = form.querySelector('[name="meeting_date"]').value;
    const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekdayIndex = (new Date(`${meetingDate}T12:00:00`).getDay() + 6) % 7;
    recurrenceBox.innerHTML = `<div class="form-field"><label>Repeats</label><div class="custom-select" data-select data-name="recurrence_frequency" data-value="none"><button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="select-label">Does not repeat</span><span class="select-chevron">⌄</span></button><div class="select-menu" role="listbox"><button type="button" role="option" class="select-option selected" data-option="none">Does not repeat</button><button type="button" role="option" class="select-option" data-option="weekly">Weekly</button><button type="button" role="option" class="select-option" data-option="monthly">Monthly</button></div></div></div><div class="recurrence-details" hidden><div class="weekly-options"><label>Repeat on</label><div class="weekday-toggle">${weekdayNames.map((name, index) => `<button type="button" class="weekday-option ${index === weekdayIndex ? 'selected' : ''}" data-weekday="${index}">${name.slice(0, 3)}</button>`).join('')}</div></div><div class="monthly-options" hidden><div class="form-field"><label>Day of month</label><input name="recurrence_day" type="number" min="1" max="31" value="${Number(meetingDate.slice(-2))}"></div><div class="form-field"><label>Every</label><div class="interval-input"><input name="recurrence_interval" type="number" min="1" max="12" value="1"><span>month(s)</span></div></div></div><div class="form-field"><label>End date <span class="field-help">(optional)</span></label><input name="recurrence_end_date" type="date" min="${meetingDate}"><small class="field-help">Leave empty to repeat indefinitely.</small></div></div>`;
    notesField?.after(recurrenceBox);
    const updateRecurrenceVisibility = (frequency) => {
      const details = recurrenceBox.querySelector('.recurrence-details');
      details.hidden = frequency === 'none';
      recurrenceBox.querySelector('.weekly-options').hidden = frequency !== 'weekly';
      recurrenceBox.querySelector('.monthly-options').hidden = frequency !== 'monthly';
    };
    bindCustomSelects(modal, (select, value) => {
      if (select.dataset.name === 'recurrence_frequency') updateRecurrenceVisibility(value);
    });
    recurrenceBox.querySelectorAll('[data-weekday]').forEach((button) => {
      button.onclick = () => {
        button.classList.toggle('selected');
        if (!recurrenceBox.querySelector('.weekday-option.selected')) button.classList.add('selected');
      };
    });
  }

  const isSequenceOccurrence = Boolean(options.meeting?.is_virtual || options.meeting?.source_meeting_id);

  const clientSelect = document.querySelector('#client-select');
  if (clientSelect?.dataset.value === '__new__') setNewClientVisibility(true);

  const deleteButton = document.querySelector('#delete-meeting');
  if (deleteButton && options.meeting) {
    deleteButton.onclick = async () => {
      let deleteScope = 'single';
      if (options.meeting.is_virtual) {
        deleteScope = await chooseScopeDialog({
          title: 'Delete recurring session',
          message: 'Choose which sessions should be removed.',
          options: [
            { value: 'single', label: 'Delete this session only' },
            { value: 'future', label: 'Delete this and following sessions' },
            { value: 'all', label: 'Delete the entire sequence' },
          ],
        });
        if (!deleteScope) return;
      } else if (!window.confirm('Delete this session?')) {
        return;
      }
      try {
        if (demo) {
          if (options.meeting.is_virtual && deleteScope === 'single') {
            demoWorkspace.meetingExceptions.push({
              ...options.meeting,
              id: crypto.randomUUID(),
              series_id: options.meeting.series_id,
              recurrence_occurrence_date: options.meeting.recurrence_occurrence_date,
              recurrence_exception_type: 'cancelled',
              status: 'cancelled',
            });
          } else if (options.meeting.is_virtual && deleteScope === 'future') {
            const series = demoWorkspace.meetings.find((item) => item.series_id === options.meeting.series_id && item.recurrence_rule);
            if (series) series.recurrence_end_date = shiftDate(options.meeting.recurrence_occurrence_date, -1);
          } else if (options.meeting.is_virtual && deleteScope === 'all') {
            demoWorkspace.meetings = demoWorkspace.meetings.filter((item) => item.series_id !== options.meeting.series_id);
            demoWorkspace.meetingExceptions = demoWorkspace.meetingExceptions.filter((item) => item.series_id !== options.meeting.series_id);
          } else {
            const index = demoWorkspace.meetings.findIndex((item) => item.id === options.meeting.id);
            if (index >= 0) demoWorkspace.meetings.splice(index, 1);
          }
        } else {
          await deleteMeeting(options.meeting.id, deleteScope);
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
    let editScope = form.querySelector('[data-name="edit_scope"]')?.dataset.value || values.edit_scope || 'single';
    if (isSequenceOccurrence) {
      editScope = await chooseScopeDialog({
        title: 'Apply session changes',
        message: 'Choose which sessions should use these changes.',
        options: [
          { value: 'single', label: 'Change this session only' },
          { value: 'all', label: 'Change the entire sequence' },
          { value: 'future', label: 'Change this and following sessions' },
        ],
      });
      if (!editScope) return;
    }
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
        const recurrenceFrequency = values.recurrence_frequency || 'none';
        const selectedWeekdays = [...form.querySelectorAll('.weekday-option.selected')].map((button) => Number(button.dataset.weekday));
        const recurrenceRule = recurrenceFrequency === 'weekly'
          ? { frequency: 'weekly', interval: 1, weekdays: selectedWeekdays }
          : recurrenceFrequency === 'monthly'
            ? { frequency: 'monthly', interval: Number(values.recurrence_interval || 1), day: Number(values.recurrence_day || values.meeting_date.slice(-2)) }
            : undefined;
        const recurrenceEndDate = values.recurrence_end_date || undefined;

        if (recurrenceRule && recurrenceEndDate && recurrenceEndDate < values.meeting_date) {
          window.alert('The recurring end date must be on or after the first session.');
          return;
        }

        if (demo) {
          const client = demoWorkspace.clients.find((item) => item.id === clientId);
          if (options.meeting) {
            if (options.meeting.is_virtual) {
              const series = demoWorkspace.meetings.find((item) => item.series_id === options.meeting.series_id && item.recurrence_rule);
              const exceptionDate = options.meeting.recurrence_occurrence_date || options.meeting.meeting_date;
              if (editScope === 'all' && series) {
                Object.assign(series, meetingPayload, { clients: { name: client?.name || 'Client' } });
              } else if (editScope === 'future' && series) {
                const oldEndDate = series.recurrence_end_date;
                series.recurrence_end_date = shiftDate(exceptionDate, -1);
                demoWorkspace.meetings.push({ ...series, ...meetingPayload, id: crypto.randomUUID(), series_id: crypto.randomUUID(), meeting_date: meetingPayload.meeting_date, recurrence_end_date: oldEndDate, clients: { name: client?.name || 'Client' } });
              } else {
                demoWorkspace.meetingExceptions.push({ ...options.meeting, ...meetingPayload, id: crypto.randomUUID(), series_id: options.meeting.series_id, recurrence_occurrence_date: exceptionDate, recurrence_exception_type: 'override', clients: { name: client?.name || 'Client' } });
              }
            } else {
              const savedMeeting = demoWorkspace.meetings.find((item) => item.id === options.meeting.id);
              if (savedMeeting) Object.assign(savedMeeting, meetingPayload, { clients: { name: client?.name || 'Client' } });
            }
          } else {
            demoWorkspace.meetings.push({ ...meetingPayload, recurrence_rule: recurrenceRule, recurrence_end_date: recurrenceEndDate, series_id: crypto.randomUUID(), clients: { name: client?.name || 'Client' } });
          }
        } else if (options.meeting) {
          await updateMeeting(options.meeting.id, { ...meetingPayload, edit_scope: editScope });
        } else {
          await createRecord('meeting', { ...meetingPayload, recurrence_rule: recurrenceRule, recurrence_end_date: recurrenceEndDate });
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

function bindClientPage(clientId) {
  const clientPrevious = root.querySelector('#client-month-previous');
  const clientNext = root.querySelector('#client-month-next');
  if (clientPrevious) clientPrevious.onclick = async () => { month = shiftMonth(month, -1); await refresh(); };
  if (clientNext) clientNext.onclick = async () => { month = shiftMonth(month, 1); await refresh(); };

  root.querySelectorAll('[data-client-tab]').forEach((tab) => {
    tab.onclick = () => {
      root.querySelectorAll('[data-client-tab]').forEach((item) => item.classList.remove('active'));
      root.querySelectorAll('.client-tab-panel').forEach((panel) => panel.classList.add('hidden'));
      tab.classList.add('active');
      root.querySelector(`#${tab.dataset.clientTab}`).classList.remove('hidden');
    };
  });

  bindCustomSelects(root, () => {});
  bindMoneyInputs(root);

  root.querySelectorAll('[data-payment-id]').forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm('Delete this payment entry?')) return;
      try {
        if (demo) {
          const index = demoWorkspace.payments.findIndex((payment) => payment.id === button.dataset.paymentId);
          if (index >= 0) demoWorkspace.payments.splice(index, 1);
        } else {
          await deletePayment(clientId, button.dataset.paymentId);
        }
        await refresh();
      } catch (error) {
        window.alert(error.message);
      }
    };
  });

  const profileForm = root.querySelector('#client-profile-form');
  profileForm.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(profileForm);
    const payload = {
      name: values.name,
      email: values.email || '',
      default_fee: Number(values.default_fee_ils || 0),
      currency: values.default_fee_currency || DEFAULT_DISPLAY_CURRENCY,
      notes: values.notes || '',
    };
    try {
      if (demo) {
        const savedClient = demoWorkspace.clients.find((item) => item.id === clientId);
        if (savedClient) Object.assign(savedClient, payload);
      } else {
        await updateClient(clientId, payload);
      }
      await refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };

  const paymentForm = root.querySelector('#payment-form');
  paymentForm.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(paymentForm);
    const payload = {
      amount: Number(values.payment_amount_ils || 0),
      currency: values.payment_amount_currency || DEFAULT_DISPLAY_CURRENCY,
      payment_date: values.payment_date,
      meeting_id: values.meeting_id || undefined,
      notes: values.notes || undefined,
    };
    if (!payload.amount || payload.amount <= 0) {
      window.alert('Enter a payment amount.');
      return;
    }
    try {
      if (demo) {
        demoWorkspace.payments.push({ ...payload, id: crypto.randomUUID(), client_id: clientId });
      } else {
        await createPayment(clientId, payload);
      }
      await refresh();
    } catch (error) {
      window.alert(error.message);
    }
  };
}

async function openClientProfile(clientId) {
  const client = workspace.clients.find((item) => item.id === clientId);
  if (!client) return;

    const finance = demo ? demoClientFinance(clientId, month) : await loadClientFinance(clientId, month);
  document.body.insertAdjacentHTML('beforeend', renderClientFinanceProfile(client, exchangeRate, finance));
  const modal = document.querySelector('#client-profile-backdrop');
  const form = document.querySelector('#client-profile-form');

  document.querySelector('#close-client-profile').onclick = () => modal.remove();
  bindCustomSelects(modal, () => {});
  bindMoneyInputs(modal);

  document.querySelectorAll('[data-payment-id]').forEach((button) => {
    button.onclick = async () => {
      if (!window.confirm('Delete this payment entry?')) return;
      if (demo) {
        const index = demoWorkspace.payments.findIndex((payment) => payment.id === button.dataset.paymentId);
        if (index >= 0) demoWorkspace.payments.splice(index, 1);
      } else {
        await deletePayment(clientId, button.dataset.paymentId);
      }
      modal.remove();
      await openClientProfile(clientId);
    };
  });

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

  const paymentForm = document.querySelector('#payment-form');
  paymentForm.onsubmit = async (event) => {
    event.preventDefault();
    const values = formValues(paymentForm);
    const payload = {
      amount: Number(values.payment_amount_ils || 0),
      currency: values.payment_amount_currency || DEFAULT_DISPLAY_CURRENCY,
      payment_date: values.payment_date,
      meeting_id: values.meeting_id || undefined,
      notes: values.notes || undefined,
    };
    if (!payload.amount || payload.amount <= 0) {
      window.alert('Enter a payment amount.');
      return;
    }

    try {
      if (demo) {
        demoWorkspace.payments.push({ ...payload, id: crypto.randomUUID(), client_id: clientId });
      } else {
        await createPayment(clientId, payload);
      }
      modal.remove();
      await openClientProfile(clientId);
    } catch (error) {
      window.alert(error.message);
    }
  };
}

function demoClientFinance(clientId, reportMonth = month) {
  const meetings = (workspace?.meetings || []).filter((meeting) => meeting.client_id === clientId);
  const payments = demoWorkspace.payments.filter((payment) => payment.client_id === clientId);
  const charged = meetings.filter((meeting) => meeting.status === 'completed').reduce((sum, meeting) => sum + Number(meeting.cost || 0), 0);
  const paid = payments.filter((payment) => payment.payment_date?.startsWith(reportMonth)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const meetingBalances = meetings.map((meeting) => {
    const meetingPaid = payments
      .filter((payment) => payment.meeting_id === meeting.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      id: meeting.id,
      meeting_date: meeting.meeting_date,
      start_time: meeting.start_time,
      status: meeting.status,
      currency: meeting.currency || DEFAULT_DISPLAY_CURRENCY,
      charged: meeting.status === 'completed' ? Number(meeting.cost || 0) : 0,
      anticipated: meeting.status === 'scheduled' ? Number(meeting.cost || 0) : 0,
      paid: meetingPaid,
      owed: meeting.status === 'completed' ? Math.max(Number(meeting.cost || 0) - meetingPaid, 0) : 0,
    };
  });
  const anticipated = meetings.filter((meeting) => meeting.status === 'scheduled').reduce((sum, meeting) => sum + Number(meeting.cost || 0), 0);
  return { meetings, meeting_balances: meetingBalances, payments, totals: { charged, paid, owed: Math.max(charged - paid, 0), anticipated } };
}

function demoMoneyManagement(reportMonth) {
  return {
    month: reportMonth,
    clients: demoWorkspace.clients.map((client) => {
      const finance = demoClientFinance(client.id, reportMonth);
      return {
        id: client.id,
        name: client.name,
        email: client.email,
        currency: client.currency || DEFAULT_DISPLAY_CURRENCY,
        ...finance.totals,
      };
    }),
  };
}

function openReminderModal(reminder = null) {
  document.body.insertAdjacentHTML('beforeend', renderReminderModal(reminder, workspace.clients, workspace.user?.reminder_email || workspace.user?.email || ''));
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
  } catch (error) {
    console.error('Clinic Manager boot failed:', error);
    renderLogin(root, { demo, error: error.message });
    bindLogin();
  }
}
