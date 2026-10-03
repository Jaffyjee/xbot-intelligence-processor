const state = [0, 0, 0];
let running = false;

function nand(a, b) {
  return (a & b) ^ 1;
}

/*
  TapeOut/XBOT logical construction:
  N1 = NAND(Risk, Liquidity)
  N2 = NAND(Risk, Market)
  N3 = NAND(Liquidity, Market)
  N4 = NAND(N1, N2)
  N5 = NAND(N4, N4)
  OUT = NAND(N5, N3)

  This evaluates the documented 2-of-3 consensus function.
*/
function evaluate(inputs) {
  const [risk, liquidity, market] = inputs;
  const n1 = nand(risk, liquidity);
  const n2 = nand(risk, market);
  const n3 = nand(liquidity, market);
  const n4 = nand(n1, n2);
  const n5 = nand(n4, n4);
  const out = nand(n5, n3);

  return { n1, n2, n3, n4, n5, out };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function render() {
  const result = evaluate(state);
  const output = result.out;
  const active = state.reduce((sum, value) => sum + value, 0);

  const outputEl = document.getElementById("output");
  outputEl.textContent = output;
  outputEl.className = "out " + (output ? "on" : "off");
  outputEl.classList.remove("pulse");
  void outputEl.offsetWidth;
  outputEl.classList.add("pulse");

  setText("activeCount", active + " / 3");
  setText(
    "status",
    output
      ? "Consensus is asserted: at least two intelligence signals are HIGH."
      : "Consensus is not asserted: fewer than two intelligence signals are HIGH."
  );

  document.querySelectorAll("[data-input]").forEach(button => {
    const input = Number(button.dataset.input);
    const value = Number(button.dataset.value);
    const active = state[input] === value;\n    button.classList.toggle("active", active);\n    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-card]").forEach(card => {
    const index = Number(card.dataset.card);
    const high = state[index] === 1;
    card.classList.toggle("live", high);
    const pill = card.querySelector("[data-state]");
    if (pill) pill.textContent = high ? "HIGH" : "LOW";
  });

  Object.entries(result).forEach(([node, value]) => {
    const el = document.querySelector('[data-node="' + node + '"]');
    if (el) el.classList.toggle("active", value === 1);
  });

  document.querySelectorAll("[data-wire]").forEach(wire => wire.classList.remove("hot"));
  if (result.n1) document.querySelector('[data-wire="w1"]')?.classList.add("hot");
  if (result.n2) document.querySelector('[data-wire="w2"]')?.classList.add("hot");
  if (result.n4) document.querySelector('[data-wire="w3"]')?.classList.add("hot");
  if (result.n5) document.querySelector('[data-wire="w5"]')?.classList.add("hot");
  if (result.n3) document.querySelector('[data-wire="w6"]')?.classList.add("hot");

  renderTable();
}

function renderTable() {
  const body = document.getElementById("truthTable");
  body.innerHTML = "";

  for (let n = 0; n < 8; n++) {
    const row = [(n >> 2) & 1, (n >> 1) & 1, n & 1];
    const result = evaluate(row).out;
    const current = row.every((value, index) => value === state[index]);

    const tr = document.createElement("tr");
    if (current) tr.className = "current";

    [...row, result].forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      if (value === 1) td.className = "result1";
      else td.className = "result0";
      tr.appendChild(td);
    });

    const stateCell = document.createElement("td");
    stateCell.textContent = current ? "CURRENT" : (result ? "ASSERT" : "REJECT");
    stateCell.className = result ? "one" : "zero";
    tr.appendChild(stateCell);

    body.appendChild(tr);
  }
}

function setRunning(value) {
  running = value;
  const runButton = document.getElementById("runAll");
  runButton.disabled = value;
  runButton.textContent = value ? "⏳ Verifying..." : "▶ Run 8-case verification";
}

document.querySelectorAll("[data-input]").forEach(button => {
  button.addEventListener("click", () => {
    if (running) return;
    state[Number(button.dataset.input)] = Number(button.dataset.value);
    render();
  });
});

document.getElementById("reset").addEventListener("click", () => {
  if (running) return;
  state.fill(0);
  render();
});

document.getElementById("runAll").addEventListener("click", async () => {
  if (running) return;
  setRunning(true);

  for (let n = 0; n < 8; n++) {
    state[0] = (n >> 2) & 1;
    state[1] = (n >> 1) & 1;
    state[2] = n & 1;
    render();
    await new Promise(resolve => setTimeout(resolve, 650));
  }

  setRunning(false);
  render();
});

render();
