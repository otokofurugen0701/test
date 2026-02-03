const STORAGE_KEY = "quadrant-todo-tasks";
const HIGH_THRESHOLD = 3;
const HIGH_VALUE = 4;
const LOW_VALUE = 2;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const notesInput = document.getElementById("notes");
const dueDateInput = document.getElementById("dueDate");
const importanceInput = document.getElementById("importance");
const urgencyInput = document.getElementById("urgency");
const importanceValue = document.getElementById("importance-value");
const urgencyValue = document.getElementById("urgency-value");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
const clearCompletedButton = document.getElementById("clear-completed");

const taskList = document.getElementById("task-list");
const todayList = document.getElementById("today-list");
const listEmpty = document.getElementById("list-empty");
const todayEmpty = document.getElementById("today-empty");
const countOpen = document.getElementById("count-open");
const countDueToday = document.getElementById("count-due-today");
const countOverdue = document.getElementById("count-overdue");
const dropzones = Array.from(document.querySelectorAll(".dropzone"));

let tasks = loadTasks();
let editId = null;

importanceInput.addEventListener("input", () => {
  importanceValue.textContent = importanceInput.value;
});

urgencyInput.addEventListener("input", () => {
  urgencyValue.textContent = urgencyInput.value;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }

  if (editId) {
    const task = tasks.find((item) => item.id === editId);
    if (task) {
      task.title = title;
      task.notes = notesInput.value.trim();
      task.dueDate = dueDateInput.value;
      task.importance = Number(importanceInput.value);
      task.urgency = Number(urgencyInput.value);
      task.updatedAt = new Date().toISOString();
    }
  } else {
    const now = new Date().toISOString();
    tasks.unshift({
      id: generateId(),
      title,
      notes: notesInput.value.trim(),
      dueDate: dueDateInput.value,
      importance: Number(importanceInput.value),
      urgency: Number(urgencyInput.value),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
  }

  saveTasks(tasks);
  resetForm();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
});

clearCompletedButton.addEventListener("click", () => {
  tasks = tasks.filter((task) => task.status !== "done");
  saveTasks(tasks);
  render();
});

dropzones.forEach((zone) => {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");
    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === "done") {
      return;
    }
    task.importance = zone.dataset.importance === "high" ? HIGH_VALUE : LOW_VALUE;
    task.urgency = zone.dataset.urgency === "high" ? HIGH_VALUE : LOW_VALUE;
    task.updatedAt = new Date().toISOString();
    saveTasks(tasks);
    render();
  });
});

render();

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse saved tasks", error);
  }
  return [];
}

function saveTasks(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resetForm() {
  form.reset();
  editId = null;
  submitButton.textContent = "Add task";
  cancelEditButton.hidden = true;
  importanceValue.textContent = importanceInput.value;
  urgencyValue.textContent = urgencyInput.value;
}

function startEdit(task) {
  editId = task.id;
  titleInput.value = task.title;
  notesInput.value = task.notes || "";
  dueDateInput.value = task.dueDate || "";
  importanceInput.value = String(task.importance);
  urgencyInput.value = String(task.urgency);
  importanceValue.textContent = importanceInput.value;
  urgencyValue.textContent = urgencyInput.value;
  submitButton.textContent = "Update task";
  cancelEditButton.hidden = false;
  titleInput.focus();
}

function render() {
  const todayKey = getTodayKey();
  const openTasks = tasks.filter((task) => task.status !== "done");
  const dueToday = openTasks.filter((task) => task.dueDate === todayKey);
  const overdue = openTasks.filter((task) => isOverdue(task, todayKey));

  countOpen.textContent = String(openTasks.length);
  countDueToday.textContent = String(dueToday.length);
  countOverdue.textContent = String(overdue.length);

  renderList(taskList, sortTasks(tasks), { showActions: true });
  renderList(todayList, sortTasks(dueToday), { showActions: true });

  listEmpty.hidden = tasks.length > 0;
  todayEmpty.hidden = dueToday.length > 0;

  renderQuadrants(openTasks);
}

function renderList(container, items, options) {
  container.textContent = "";
  items.forEach((task) => {
    container.appendChild(createTaskCard(task, options));
  });
}

function renderQuadrants(items) {
  dropzones.forEach((zone) => {
    zone.textContent = "";
  });

  items.forEach((task) => {
    const quadrantKey = getQuadrantKey(task);
    const zone = dropzones.find(
      (target) =>
        target.dataset.importance === quadrantKey.importance &&
        target.dataset.urgency === quadrantKey.urgency
    );
    if (zone) {
      zone.appendChild(
        createTaskCard(task, {
          tag: "div",
          showActions: false,
          showCheckbox: false,
          draggable: true,
        })
      );
    }
  });
}

function createTaskCard(task, options = {}) {
  const {
    tag = "li",
    showActions = true,
    showCheckbox = true,
    draggable = true,
  } = options;
  const card = document.createElement(tag);
  card.className = "task-card";
  if (task.status === "done") {
    card.classList.add("done");
  }
  card.dataset.taskId = task.id;

  if (draggable && task.status !== "done") {
    card.draggable = true;
    card.addEventListener("dragstart", handleDragStart);
  }

  const header = document.createElement("div");
  header.className = "task-header";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;
  header.appendChild(title);

  if (showActions) {
    const actions = document.createElement("div");
    actions.className = "task-actions";

    if (showCheckbox) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.status === "done";
      checkbox.addEventListener("change", () => {
        task.status = checkbox.checked ? "done" : "open";
        task.updatedAt = new Date().toISOString();
        saveTasks(tasks);
        render();
      });
      actions.appendChild(checkbox);
    }

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEdit(task));
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      if (window.confirm("Delete this task?")) {
        tasks = tasks.filter((item) => item.id !== task.id);
        saveTasks(tasks);
        render();
      }
    });
    actions.appendChild(deleteButton);

    header.appendChild(actions);
  }

  card.appendChild(header);

  if (task.notes) {
    const notes = document.createElement("div");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    card.appendChild(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.appendChild(createBadge(`I:${task.importance}`));
  meta.appendChild(createBadge(`U:${task.urgency}`));

  if (task.dueDate) {
    const overdue = isOverdue(task, getTodayKey());
    meta.appendChild(
      createBadge(`Due ${task.dueDate}`, overdue ? "badge-danger" : null)
    );
  }

  if (task.status === "done") {
    meta.appendChild(createBadge("Done", "badge-success"));
  }

  card.appendChild(meta);
  return card;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = className ? `badge ${className}` : "badge";
  badge.textContent = text;
  return badge;
}

function handleDragStart(event) {
  const taskId = event.currentTarget.dataset.taskId;
  event.dataTransfer.setData("text/plain", taskId);
  event.dataTransfer.effectAllowed = "move";
}

function getQuadrantKey(task) {
  const importance = task.importance >= HIGH_THRESHOLD ? "high" : "low";
  const urgency = task.urgency >= HIGH_THRESHOLD ? "high" : "low";
  return { importance, urgency };
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(task, todayKey) {
  return Boolean(task.dueDate && task.dueDate < todayKey);
}

function sortTasks(items) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "done" ? 1 : -1;
    }
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate) {
      return -1;
    }
    if (b.dueDate) {
      return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
