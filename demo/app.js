const state = [0, 0, 0];

function consensus(inputs) {
  return inputs.reduce((sum, value) => sum + value, 0) >= 2 ? 1 : 0;
}

function render() {
  const output = consensus(state);
  const outputEl = document.getElementById("output");
  const statusEl = document.getElementById("status");

  outputEl.textContent = output;
  outputEl.className = "value " + (output ? "on" : "off");
  statusEl.textContent = output
    ? "At least two intelligence signals are active."
    : "Less than two signals are active.";

  document.querySelectorAll("[data-input]").forEach(button => {
    const input = Number(button.dataset.input);
    const value = Number(button.dataset.value);
    button.classList.toggle("active", state[input] === value);
  });

  renderTable();
}

function renderTable() {
  const body = document.getElementById("truthTable");
  body.innerHTML = "";

  for (let n = 0; n < 8; n++) {
    const row = [(n >> 2) & 1, (n >> 1) & 1, n & 1];
    const result = consensus(row);
    const tr = document.createElement("tr");

    if (row.every((value, index) => value === state[index])) {
      tr.className = "current";
    }

    [...row, result].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }
}

document.querySelectorAll("[data-input]").forEach(button => {
  button.addEventListener("click", () => {
    state[Number(button.dataset.input)] = Number(button.dataset.value);
    render();
  });
});

document.getElementById("reset").addEventListener("click", () => {
  state.fill(0);
  render();
});

document.getElementById("runAll").addEventListener("click", async () => {
  for (let n = 0; n < 8; n++) {
    state[0] = (n >> 2) & 1;
    state[1] = (n >> 1) & 1;
    state[2] = n & 1;
    render();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
});

render();
