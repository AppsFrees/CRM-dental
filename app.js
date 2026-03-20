let currentPatientId = null;

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupPatients();
  setupPatientDetail();
  setupAppointments();
  setupPaymentsGlobal();
  setupReports();
  loadInitialData();
});

function setupNavigation() {
  const buttons = document.querySelectorAll(".top-nav button");
  const views = document.querySelectorAll(".view");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = "view-" + btn.dataset.view;
      views.forEach((v) => v.classList.remove("active"));
      document.getElementById(viewId).classList.add("active");
      if (viewId === "view-dashboard") refreshDashboard();
      if (viewId === "view-payments") refreshGlobalPayments();
      if (viewId === "view-reports") refreshReports();
      if (viewId === "view-appointments") refreshAppointmentsList();
    });
  });
}

// -------- Pacientes --------
function setupPatients() {
  document.getElementById("btn-new-patient").addEventListener("click", () => {
    openPatientDetail(null);
  });

  document.getElementById("patient-search").addEventListener("input", refreshPatientList);

  document.getElementById("btn-back-to-patients").addEventListener("click", () => {
    document.getElementById("view-patient-detail").classList.remove("active");
    document.getElementById("view-patients").classList.add("active");
  });

  document.getElementById("form-patient").addEventListener("submit", savePatient);

  document.getElementById("btn-delete-patient").addEventListener("click", deleteCurrentPatient);

  document.getElementById("btn-open-whatsapp").addEventListener("click", () => {
    const phone = document.getElementById("patient-phone").value;
    const name = document.getElementById("patient-fullName").value || "";
    openWhatsApp(phone, "Hola " + name + ", le escribimos de la clínica dental.");
  });
}

async function refreshPatientList() {
  const tbody = document.getElementById("patient-list");
  tbody.innerHTML = "";
  const term = (document.getElementById("patient-search").value || "").toLowerCase();
  const patients = await dbGetAll("patients");

  patients
    .filter((p) => {
      if (!term) return true;
      return (
        (p.fullName || "").toLowerCase().includes(term) ||
        (p.dni || "").toLowerCase().includes(term) ||
        (p.phone || "").toLowerCase().includes(term)
      );
    })
    .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
    .forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.fullName || ""}</td>
        <td>${p.dni || ""}</td>
        <td>${p.phone || ""}</td>
        <td><button data-id="${p.id}">Ver</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => openPatientDetail(p.id));
      tbody.appendChild(tr);
    });
}

async function openPatientDetail(id) {
  document.getElementById("view-patients").classList.remove("active");
  document.getElementById("view-patient-detail").classList.add("active");

  currentPatientId = id;

  // Tabs
  const tabButtons = document.querySelectorAll("#view-patient-detail .tabs button");
  const tabContents = document.querySelectorAll("#view-patient-detail .tab-content");
  tabButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    })
  );

  if (!id) {
    // Nuevo paciente
    document.getElementById("patient-detail-name").textContent = "Nuevo paciente";
    document.getElementById("patient-id").value = "";
    document.getElementById("form-patient").reset();
    document.getElementById("form-clinical-history").reset();
    clearToothList();
    clearTreatmentList();
    clearPaymentList();
    clearDocumentList();
    return;
  }

  const patient = await dbGet("patients", id);
  if (!patient) return;

  document.getElementById("patient-detail-name").textContent = patient.fullName || "Paciente";
  document.getElementById("patient-id").value = patient.id;
  document.getElementById("patient-fullName").value = patient.fullName || "";
  document.getElementById("patient-dni").value = patient.dni || "";
  document.getElementById("patient-phone").value = patient.phone || "";
  document.getElementById("patient-email").value = patient.email || "";
  document.getElementById("patient-birthDate").value = patient.birthDate || "";
  document.getElementById("patient-address").value = patient.address || "";
  document.getElementById("patient-emergencyContact").value = patient.emergencyContact || "";
  document.getElementById("patient-notes").value = patient.notes || "";

  // Historia clínica
  const history = await dbGet("clinicalHistories", id);
  document.getElementById("history-allergies").value = history?.allergies || "";
  document.getElementById("history-systemic").value = history?.systemicDiseases || "";
  document.getElementById("history-medications").value = history?.medications || "";
  document.getElementById("history-pregnancy").value = history?.pregnancy || "";
  document.getElementById("history-habits").value = history?.habits || "";
  document.getElementById("history-notes").value = history?.notes || "";

  // Odontograma, tratamientos, pagos, documentos
  refreshToothList();
  refreshTreatmentList();
  refreshPaymentList();
  refreshDocumentList();
}

async function savePatient(event) {
  event.preventDefault();
  const id = document.getElementById("patient-id").value || generateId("pat");
  const patient = {
    id,
    fullName: document.getElementById("patient-fullName").value.trim(),
    dni: document.getElementById("patient-dni").value.trim(),
    phone: document.getElementById("patient-phone").value.trim(),
    email: document.getElementById("patient-email").value.trim(),
    birthDate: document.getElementById("patient-birthDate").value || "",
    address: document.getElementById("patient-address").value.trim(),
    emergencyContact: document.getElementById("patient-emergencyContact").value.trim(),
    notes: document.getElementById("patient-notes").value.trim(),
    createdAt: new Date().toISOString()
  };

  if (!patient.fullName) {
    alert("El nombre del paciente es obligatorio.");
    return;
  }

  await dbPut("patients", patient);
  document.getElementById("patient-id").value = id;
  currentPatientId = id;
  refreshPatientList();
  alert("Paciente guardado.");
}

async function deleteCurrentPatient() {
  if (!currentPatientId) return;
  if (!confirm("¿Eliminar paciente y todos sus registros?")) return;
  await dbDelete("patients", currentPatientId);
  // Borrados simples en cascada
  const allStores = ["appointments", "toothRecords", "treatments", "payments", "clinicalHistories", "documents"];
  for (const store of allStores) {
    const items = await dbGetAll(store);
    for (const item of items) {
      if (item.patientId === currentPatientId) {
        await dbDelete(store, item.id || item.patientId);
      }
    }
  }
  currentPatientId = null;
  document.getElementById("view-patient-detail").classList.remove("active");
  document.getElementById("view-patients").classList.add("active");
  refreshPatientList();
}

// -------- Historia clínica --------
function setupPatientDetail() {
  document.getElementById("form-clinical-history").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentPatientId) {
      alert("Primero guarda el paciente.");
      return;
    }
    const history = {
      patientId: currentPatientId,
      allergies: document.getElementById("history-allergies").value.trim(),
      systemicDiseases: document.getElementById("history-systemic").value.trim(),
      medications: document.getElementById("history-medications").value.trim(),
      pregnancy: document.getElementById("history-pregnancy").value.trim(),
      habits: document.getElementById("history-habits").value.trim(),
      notes: document.getElementById("history-notes").value.trim()
    };
    await dbPut("clinicalHistories", history);
    alert("Historia clínica guardada.");
  });

  // Odontograma
  document.getElementById("form-tooth-record").addEventListener("submit", saveToothRecord);

  // Tratamientos
  document.getElementById("form-treatment").addEventListener("submit", saveTreatment);

  // Pagos
  document.getElementById("form-payment").addEventListener("submit", savePayment);

  // Documentos
  document.getElementById("form-document").addEventListener("submit", saveDocument);
}

// -------- Odontograma --------
async function saveToothRecord(e) {
  e.preventDefault();
  if (!currentPatientId) {
    alert("Primero guarda el paciente.");
    return;
  }
  const toothNumber = document.getElementById("tooth-number").value.trim();
  if (!toothNumber) {
    alert("La pieza es obligatoria.");
    return;
  }
  const id = generateId("tooth");
  const record = {
    id,
    patientId: currentPatientId,
    toothNumber,
    status: document.getElementById("tooth-status").value.trim(),
    treatment: document.getElementById("tooth-treatment").value.trim(),
    notes: document.getElementById("tooth-notes").value.trim()
  };
  await dbPut("toothRecords", record);
  document.getElementById("form-tooth-record").reset();
  refreshToothList();
}

async function refreshToothList() {
  const tbody = document.getElementById("tooth-list");
  tbody.innerHTML = "";
  const records = await dbGetAll("toothRecords");
  records
    .filter((r) => r.patientId === currentPatientId)
    .sort((a, b) => (a.toothNumber || "").localeCompare(b.toothNumber || ""))
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.toothNumber}</td>
        <td>${r.status}</td>
        <td>${r.treatment || ""}</td>
        <td>${r.notes || ""}</td>
        <td><button data-id="${r.id}">Borrar</button></td>
      `;
      tr.querySelector("button").addEventListener("click", async () => {
        if (confirm("¿Eliminar registro de pieza?")) {
          await dbDelete("toothRecords", r.id);
          refreshToothList();
        }
      });
      tbody.appendChild(tr);
    });
}

function clearToothList() {
  document.getElementById("tooth-list").innerHTML = "";
}

// -------- Tratamientos --------
async function saveTreatment(e) {
  e.preventDefault();
  if (!currentPatientId) {
    alert("Primero guarda el paciente.");
    return;
  }
  const id = document.getElementById("treatment-id").value || generateId("treat");
  const treatment = {
    id,
    patientId: currentPatientId,
    name: document.getElementById("treatment-name").value.trim(),
    description: document.getElementById("treatment-description").value.trim(),
    tooth: document.getElementById("treatment-tooth").value.trim(),
    price: Number(document.getElementById("treatment-price").value) || 0,
    discount: Number(document.getElementById("treatment-discount").value) || 0,
    status: document.getElementById("treatment-status").value
  };
  if (!treatment.name) {
    alert("El nombre del tratamiento es obligatorio.");
    return;
  }
  await dbPut("treatments", treatment);
  document.getElementById("treatment-id").value = "";
  document.getElementById("form-treatment").reset();
  refreshTreatmentList();
  refreshPaymentList();
}

async function refreshTreatmentList() {
  const tbody = document.getElementById("treatment-list");
  tbody.innerHTML = "";
  const treatments = await dbGetAll("treatments");
  treatments
    .filter((t) => t.patientId === currentPatientId)
    .forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.name}</td>
        <td>${t.tooth || ""}</td>
        <td>${formatNumber(t.price)}</td>
        <td>${formatNumber(t.discount)}</td>
        <td>${t.status}</td>
        <td><button data-id="${t.id}">Borrar</button></td>
      `;
      tr.querySelector("button").addEventListener("click", async () => {
        if (confirm("¿Eliminar tratamiento?")) {
          await dbDelete("treatments", t.id);
          refreshTreatmentList();
          refreshPaymentList();
        }
      });
      tbody.appendChild(tr);
    });
}

function clearTreatmentList() {
  document.getElementById("treatment-list").innerHTML = "";
}

// -------- Pagos --------
async function savePayment(e) {
  e.preventDefault();
  if (!currentPatientId) {
    alert("Primero guarda el paciente.");
    return;
  }
  const id = document.getElementById("payment-id").value || generateId("pay");
  const payment = {
    id,
    patientId: currentPatientId,
    date: document.getElementById("payment-date").value || formatDateISO(new Date()),
    amount: Number(document.getElementById("payment-amount").value) || 0,
    discount: Number(document.getElementById("payment-discount").value) || 0,
    method: document.getElementById("payment-method").value,
    status: "registrado"
  };
  if (!payment.amount) {
    alert("El monto es obligatorio.");
    return;
  }
  await dbPut("payments", payment);
  document.getElementById("payment-id").value = "";
  document.getElementById("form-payment").reset();
  refreshPaymentList();
  refreshGlobalPayments();
  refreshReports();
}

async function refreshPaymentList() {
  const tbody = document.getElementById("payment-list");
  tbody.innerHTML = "";
  const payments = await dbGetAll("payments");
  const patientPayments = payments.filter((p) => p.patientId === currentPatientId);

  let totalTreatments = 0;
  const treatments = await dbGetAll("treatments");
  treatments
    .filter((t) => t.patientId === currentPatientId)
    .forEach((t) => {
      totalTreatments += (t.price || 0) - (t.discount || 0);
    });

  let totalPayments = 0;
  patientPayments.forEach((p) => {
    totalPayments += (p.amount || 0) - (p.discount || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.date}</td>
      <td>${formatNumber(p.amount)}</td>
      <td>${formatNumber(p.discount)}</td>
      <td>${p.method}</td>
      <td><button data-id="${p.id}">Borrar</button></td>
    `;
    tr.querySelector("button").addEventListener("click", async () => {
      if (confirm("¿Eliminar pago?")) {
        await dbDelete("payments", p.id);
        refreshPaymentList();
        refreshGlobalPayments();
        refreshReports();
      }
    });
    tbody.appendChild(tr);
  });

  const pending = totalTreatments - totalPayments;
  document.getElementById("balance-total-treatments").textContent = formatNumber(totalTreatments);
  document.getElementById("balance-total-payments").textContent = formatNumber(totalPayments);
  document.getElementById("balance-pending").textContent = formatNumber(pending);
}

function clearPaymentList() {
  document.getElementById("payment-list").innerHTML = "";
}

// -------- Documentos --------
async function saveDocument(e) {
  e.preventDefault();
  if (!currentPatientId) {
    alert("Primero guarda el paciente.");
    return;
  }
  const id = document.getElementById("document-id").value || generateId("doc");
  const doc = {
    id,
    patientId: currentPatientId,
    type: document.getElementById("document-type").value.trim(),
    url: document.getElementById("document-url").value.trim(),
    notes: document.getElementById("document-notes").value.trim()
  };
  if (!doc.url) {
    alert("La URL es obligatoria.");
    return;
  }
  await dbPut("documents", doc);
  document.getElementById("document-id").value = "";
  document.getElementById("form-document").reset();
  refreshDocumentList();
}

async function refreshDocumentList() {
  const tbody = document.getElementById("document-list");
  tbody.innerHTML = "";
  const docs = await dbGetAll("documents");
  docs
    .filter((d) => d.patientId === currentPatientId)
    .forEach((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.type || ""}</td>
        <td><a href="${d.url}" target="_blank">Abrir</a></td>
        <td>${d.notes || ""}</td>
        <td><button data-id="${d.id}">Borrar</button></td>
      `;
      tr.querySelector("button").addEventListener("click", async () => {
        if (confirm("¿Eliminar documento?")) {
          await dbDelete("documents", d.id);
          refreshDocumentList();
        }
      });
      tbody.appendChild(tr);
    });
}

function clearDocumentList() {
  document.getElementById("document-list").innerHTML = "";
}

// -------- Agenda --------
function setupAppointments() {
  document.getElementById("btn-new-appointment").addEventListener("click", () => openAppointmentModal());

  document.getElementById("btn-close-appointment-modal").addEventListener("click", () => {
    document.getElementById("appointment-modal").classList.add("hidden");
  });

  document.getElementById("form-appointment").addEventListener("submit", saveAppointment);

  document.getElementById("btn-appointment-calendar").addEventListener("click", () => {
    const patientSelect = document.getElementById("appointment-patientId");
    const patientName =
      patientSelect.options[patientSelect.selectedIndex]?.text || "";
    const date = document.getElementById("appointment-date").value;
    const time = document.getElementById("appointment-time").value;
    const reason = document.getElementById("appointment-reason").value;
    openCalendarEvent({
      title: "Cita dental - " + patientName,
      details: reason,
      startDate: date,
      startTime: time
    });
  });

  document.getElementById("appointments-date-filter").addEventListener("change", refreshAppointmentsList);
}

async function openAppointmentModal(id) {
  document.getElementById("appointment-modal").classList.remove("hidden");
  document.getElementById("form-appointment").reset();
  document.getElementById("appointment-id").value = id || "";

  // Llenar lista de pacientes
  const select = document.getElementById("appointment-patientId");
  select.innerHTML = "";
  const patients = await dbGetAll("patients");
  patients
    .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
    .forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.fullName;
      select.appendChild(opt);
    });

  if (id) {
    const appt = await dbGet("appointments", id);
    if (appt) {
      document.getElementById("appointment-patientId").value = appt.patientId;
      document.getElementById("appointment-date").value = appt.date;
      document.getElementById("appointment-time").value = appt.time;
      document.getElementById("appointment-reason").value = appt.reason;
      document.getElementById("appointment-status").value = appt.status;
      document.getElementById("appointment-notes").value = appt.notes || "";
    }
  } else {
    const today = formatDateISO(new Date());
    document.getElementById("appointment-date").value = today;
  }
}

async function saveAppointment(e) {
  e.preventDefault();
  const id = document.getElementById("appointment-id").value || generateId("appt");
  const appt = {
    id,
    patientId: document.getElementById("appointment-patientId").value,
    date: document.getElementById("appointment-date").value,
    time: document.getElementById("appointment-time").value,
    reason: document.getElementById("appointment-reason").value.trim(),
    status: document.getElementById("appointment-status").value,
    notes: document.getElementById("appointment-notes").value.trim()
  };
  if (!appt.patientId || !appt.date || !appt.time || !appt.reason) {
    alert("Paciente, fecha, hora y motivo son obligatorios.");
    return;
  }

  // Validación de no duplicar cita mismo paciente-mismo horario
  const appointments = await dbGetAll("appointments");
  const clash = appointments.find(
    (a) =>
      a.id !== id && a.date === appt.date && a.time === appt.time && a.patientId === appt.patientId
  );
  if (clash) {
    if (!confirm("Ya existe una cita para ese paciente a esa hora. ¿Continuar?")) {
      return;
    }
  }

  await dbPut("appointments", appt);
  document.getElementById("appointment-modal").classList.add("hidden");
  refreshAppointmentsList();
  refreshDashboard();
  refreshReports();
}

async function refreshAppointmentsList() {
  const tbody = document.getElementById("appointment-list");
  tbody.innerHTML = "";
  const dateFilter =
    document.getElementById("appointments-date-filter").value ||
    formatDateISO(new Date());
  document.getElementById("appointments-date-filter").value = dateFilter;

  const [appointments, patients] = await Promise.all([
    dbGetAll("appointments"),
    dbGetAll("patients")
  ]);

  const patientMap = {};
  patients.forEach((p) => (patientMap[p.id] = p.fullName || "Paciente"));

  appointments
    .filter((a) => a.date === dateFilter)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    .forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.time}</td>
        <td>${patientMap[a.patientId] || ""}</td>
        <td>${a.reason}</td>
        <td>${a.status}</td>
        <td>
          <button data-id="${a.id}">Editar</button>
          <button data-del="${a.id}" class="btn-danger">X</button>
        </td>
      `;
      tr.querySelector("button[data-id]").addEventListener("click", () => openAppointmentModal(a.id));
      tr.querySelector("button[data-del]").addEventListener("click", async () => {
        if (confirm("¿Eliminar cita?")) {
          await dbDelete("appointments", a.id);
          refreshAppointmentsList();
          refreshDashboard();
          refreshReports();
        }
      });
      tbody.appendChild(tr);
    });
}

// -------- Pagos globales --------
function setupPaymentsGlobal() {}

async function refreshGlobalPayments() {
  const tbody = document.getElementById("payments-global-list");
  if (!tbody) return;
  tbody.innerHTML = "";
  const [payments, patients] = await Promise.all([
    dbGetAll("payments"),
    dbGetAll("patients")
  ]);
  const patientMap = {};
  patients.forEach((p) => (patientMap[p.id] = p.fullName || "Paciente"));

  payments
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${patientMap[p.patientId] || ""}</td>
        <td>${p.date}</td>
        <td>${formatNumber(p.amount)}</td>
        <td>${p.method}</td>
      `;
      tbody.appendChild(tr);
    });
}

// -------- Dashboard & reportes --------
function setupReports() {}

async function refreshDashboard() {
  const [patients, appointments, payments, treatments] = await Promise.all([
    dbGetAll("patients"),
    dbGetAll("appointments"),
    dbGetAll("payments"),
    dbGetAll("treatments")
  ]);

  document.getElementById("dashboard-patient-count").textContent = patients.length;

  const today = formatDateISO(new Date());
  const todayAppointments = appointments.filter((a) => a.date === today);
  document.getElementById("dashboard-today-appointments").textContent =
    todayAppointments.length;

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  let income = 0;
  payments.forEach((p) => {
    const d = new Date(p.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      income += (p.amount || 0) - (p.discount || 0);
    }
  });
  document.getElementById("dashboard-month-income").textContent = formatNumber(income);
}

async function refreshReports() {
  const [patients, appointments, payments, treatments] = await Promise.all([
    dbGetAll("patients"),
    dbGetAll("appointments"),
    dbGetAll("payments"),
    dbGetAll("treatments")
  ]);

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  let newPatients = 0;
  patients.forEach((p) => {
    const d = new Date(p.createdAt || now);
    if (d.getMonth() === month && d.getFullYear() === year) {
      newPatients++;
    }
  });
  document.getElementById("report-new-patients").textContent = newPatients;

  const pendingAppointments = appointments.filter(
    (a) => a.status === "programada" || a.status === "confirmada"
  );
  document.getElementById("report-pending-appointments").textContent =
    pendingAppointments.length;

  const treatmentTotals = {};
  treatments.forEach((t) => {
    const net = (t.price || 0) - (t.discount || 0);
    treatmentTotals[t.patientId] = (treatmentTotals[t.patientId] || 0) + net;
  });

  const paymentTotals = {};
  payments.forEach((p) => {
    const paid = (p.amount || 0) - (p.discount || 0);
    paymentTotals[p.patientId] = (paymentTotals[p.patientId] || 0) + paid;
  });

  let totalPending = 0;
  Object.keys(treatmentTotals).forEach((pid) => {
    const pending = (treatmentTotals[pid] || 0) - (paymentTotals[pid] || 0);
    if (pending > 0) totalPending += pending;
  });

  document.getElementById("report-pending-balance").textContent =
    formatNumber(totalPending);
}

function loadInitialData() {
  refreshPatientList();
  refreshDashboard();
  refreshAppointmentsList();
  refreshGlobalPayments();
  refreshReports();
}
