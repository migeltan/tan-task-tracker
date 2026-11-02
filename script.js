const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const clearButton = document.getElementById("clearButton");
const emptyState = document.getElementById("emptyState");
const contextInput = document.getElementById("contextInput");
const dueInput = document.getElementById("dueInput");
const contextList = document.getElementById("contextList");
const swatchBox = document.getElementById("swatches");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const filterButtons = document.querySelectorAll(".filter");

const STORAGE_KEY = "taskTracker.tasks";
const COLORS = ["none", "blue", "green", "amber", "rose", "violet"];
const RING_LENGTH = 2 * Math.PI * 18;

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pencil:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  "circle-check": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  "list-x":
    '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="m19 10-4 4"/><path d="m15 10 4 4"/>',
  clipboard:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><path d="M7.5 7.5h.01"/>',
  calendar:
    '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
};

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;
let selectedColor = "none";

function iconSvg(name) {
  return (
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>"
  );
}

function loadIcons() {
  document.querySelectorAll("[data-icon]").forEach(function (el) {
    el.innerHTML = iconSvg(el.dataset.icon);
  });
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    // Storage unavailable (e.g. private mode); the app still works for this session
  }
}

function colorLabel(name) {
  return name === "none"
    ? "No color"
    : name.charAt(0).toUpperCase() + name.slice(1);
}

// Color picker in the composer
function buildSwatches() {
  COLORS.forEach(function (name) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch c-" + name;
    swatch.dataset.color = name;
    swatch.title = colorLabel(name);
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", colorLabel(name));
    swatch.addEventListener("click", function () {
      selectedColor = name;
      updateSwatches();
    });
    swatchBox.appendChild(swatch);
  });
  updateSwatches();
}

function updateSwatches() {
  swatchBox.querySelectorAll(".swatch").forEach(function (swatch) {
    const on = swatch.dataset.color === selectedColor;
    swatch.classList.toggle("selected", on);
    swatch.setAttribute("aria-checked", String(on));
  });
}

// Work out how close a due date is (YYYY-MM-DD string from the date input)
function getDueInfo(due, done) {
  if (!due) return null;
  const parts = due.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;

  const dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate - today) / 86400000);

  const full = dueDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const short = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (done) return { label: short, status: "", full: full };
  if (diff < 0)
    return {
      label: Math.abs(diff) + "d overdue",
      status: "overdue",
      full: full,
    };
  if (diff === 0) return { label: "Today", status: "soon", full: full };
  if (diff === 1) return { label: "Tomorrow", status: "soon", full: full };
  if (diff <= 3)
    return { label: "In " + diff + " days", status: "soon", full: full };
  return { label: short, status: "", full: full };
}

function makeIconButton(className, icon, label) {
  const btn = document.createElement("button");
  btn.className = "icon-btn " + className;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = iconSvg(icon);
  return btn;
}

function createTaskItem(task) {
  const newTask = document.createElement("li");
  newTask.className =
    "task c-" + (task.color || "none") + (task.done ? " done" : "");

  const check = document.createElement("button");
  check.className = "check";
  check.title = task.done ? "Mark as active" : "Mark as done";
  check.setAttribute("aria-label", check.title);
  check.setAttribute("aria-pressed", String(task.done));
  check.innerHTML = iconSvg("check");
  check.addEventListener("click", function () {
    task.done = !task.done;
    saveTasks();
    render();
  });
  newTask.appendChild(check);

  if (editingId === task.id) {
    const fields = document.createElement("div");
    fields.className = "edit-fields";

    const editText = document.createElement("input");
    editText.type = "text";
    editText.className = "edit-text";
    editText.value = task.text;
    editText.setAttribute("aria-label", "Edit task");

    const editContext = document.createElement("input");
    editContext.type = "text";
    editContext.setAttribute("list", "contextList");
    editContext.placeholder = "Subject or category";
    editContext.value = task.context || "";
    editContext.setAttribute("aria-label", "Edit subject or category");

    const editDue = document.createElement("input");
    editDue.type = "date";
    editDue.value = task.due || "";
    editDue.setAttribute("aria-label", "Edit due date");

    const row = document.createElement("div");
    row.className = "edit-row";
    row.appendChild(editContext);
    row.appendChild(editDue);

    fields.appendChild(editText);
    fields.appendChild(row);
    newTask.appendChild(fields);

    function commit() {
      if (editingId !== task.id) return;
      const value = editText.value.trim();
      if (value !== "") task.text = value;
      task.context = editContext.value.trim();
      task.due = editDue.value;
      editingId = null;
      saveTasks();
      render();
    }

    fields.addEventListener("keydown", function (e) {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") {
        editingId = null;
        render();
      }
    });
    // Only save when focus leaves the whole edit group, not when moving between its inputs
    fields.addEventListener("focusout", function (e) {
      if (!fields.contains(e.relatedTarget)) commit();
    });

    const save = makeIconButton("save", "check", "Save");
    save.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    save.addEventListener("click", commit);
    newTask.appendChild(save);
  } else {
    const body = document.createElement("div");
    body.className = "task-body";

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;
    body.appendChild(text);

    const due = getDueInfo(task.due, task.done);
    if (task.context || due) {
      const meta = document.createElement("div");
      meta.className = "task-meta";

      if (task.context) {
        const context = document.createElement("span");
        context.className = "context";
        context.innerHTML = iconSvg("tag");
        const label = document.createElement("span");
        label.textContent = task.context;
        context.appendChild(label);
        meta.appendChild(context);
      }

      if (due) {
        const chip = document.createElement("span");
        chip.className = "due" + (due.status ? " " + due.status : "");
        chip.title = due.full;
        chip.innerHTML = iconSvg("calendar");
        const label = document.createElement("span");
        label.textContent = due.label;
        chip.appendChild(label);
        meta.appendChild(chip);
      }

      body.appendChild(meta);
    }
    newTask.appendChild(body);

    // Cycles through the palette; the row tint follows the color
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.title = "Change color";
    dot.setAttribute("aria-label", "Change color");
    dot.addEventListener("click", function () {
      const i = COLORS.indexOf(task.color || "none");
      task.color = COLORS[(i + 1) % COLORS.length];
      saveTasks();
      render();
    });
    newTask.appendChild(dot);

    const edit = makeIconButton("edit", "pencil", "Edit task");
    edit.addEventListener("click", function () {
      editingId = task.id;
      render();
    });
    newTask.appendChild(edit);

    const del = makeIconButton("delete", "trash", "Delete task");
    del.addEventListener("click", function () {
      tasks = tasks.filter(function (t) {
        return t.id !== task.id;
      });
      saveTasks();
      render();
    });
    newTask.appendChild(del);
  }

  return newTask;
}

// Suggest subjects that were already used
function updateContextList() {
  const seen = {};
  contextList.innerHTML = "";
  tasks.forEach(function (task) {
    if (task.context && !seen[task.context.toLowerCase()]) {
      seen[task.context.toLowerCase()] = true;
      const option = document.createElement("option");
      option.value = task.context;
      contextList.appendChild(option);
    }
  });
}

function render() {
  taskList.innerHTML = "";

  const visible = tasks.filter(function (task) {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "done") return task.done;
    return true;
  });

  visible.forEach(function (task) {
    taskList.appendChild(createTaskItem(task));
  });

  const doneCount = tasks.filter(function (task) {
    return task.done;
  }).length;
  const remaining = tasks.length - doneCount;
  const overdue = tasks.filter(function (task) {
    const info = getDueInfo(task.due, task.done);
    return info && info.status === "overdue";
  }).length;

  if (tasks.length > 0 && remaining === 0) {
    taskCount.textContent = "All done";
  } else {
    taskCount.textContent =
      remaining +
      " remaining" +
      (overdue > 0 ? " · " + overdue + " overdue" : "");
  }

  const percent = tasks.length
    ? Math.round((doneCount / tasks.length) * 100)
    : 0;
  progressText.textContent = percent + "%";
  progressBar.style.strokeDashoffset = RING_LENGTH * (1 - percent / 100);

  emptyState.hidden = visible.length > 0;
  clearButton.disabled = doneCount === 0;

  filterButtons.forEach(function (btn) {
    const active = btn.dataset.filter === currentFilter;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  updateContextList();

  if (editingId !== null) {
    const editText = taskList.querySelector(".edit-text");
    if (editText) {
      editText.focus();
      editText.select();
    }
  }
}

function addTask() {
  const taskText = taskInput.value.trim();

  if (taskText !== "") {
    tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: taskText,
      context: contextInput.value.trim(),
      due: dueInput.value,
      color: selectedColor,
      done: false,
    });
    saveTasks();
    taskInput.value = ""; // Clear the input field
    dueInput.value = "";
    render();
  }
  taskInput.focus();
}

addButton.addEventListener("click", addTask);

taskInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addTask();
});

contextInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") addTask();
});

filterButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    currentFilter = btn.dataset.filter;
    render();
  });
});

clearButton.addEventListener("click", function () {
  tasks = tasks.filter(function (task) {
    return !task.done;
  });
  saveTasks();
  render();
});

loadIcons();
buildSwatches();
render();
