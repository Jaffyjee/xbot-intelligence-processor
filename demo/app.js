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
    const isActive = state[input] === value;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
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
      td.className = value === 1 ? "one" : "zero";
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

/* -----------------------------
   Live X Layer mint tracker
   ----------------------------- */

const X_LAYER_HTTP = "https://rpc.xlayer.tech";
const X_LAYER_WSS = "wss://ws.xlayer.tech";
const TRANSISTOR_CONTRACT = "0x7bE7280e31984d18f62218519985EC5DcCa751De";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const LIVE_HISTORY_BLOCKS = 250000;
const MAX_FEED_ITEMS = 80;
const RPC_TIMEOUT_MS = 9000;
let liveEvents = [];
let liveSocket = null;
let pollTimer = null;
let liveBusy = false;
let lastLiveBlock = null;

function hexToBigInt(hex) {
  try {
    return BigInt(hex || "0x0");
  } catch {
    return 0n;
  }
}

function shortAddress(value) {
  if (!value) return "—";
  return value.slice(0, 6) + "…" + value.slice(-4);
}

function formatUnits(value) {
  const n = typeof value === "bigint" ? value : BigInt(value || 0);
  return n.toLocaleString("en-US");
}

function formatTime(ms) {
  if (!ms) return "time unavailable";
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return new Date(ms).toLocaleString();
}

async function rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(X_LAYER_HTTP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("RPC HTTP " + response.status);
    const json = await response.json();
    if (json.error) throw new Error(json.error.message || "RPC error");
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function topicAddress(topic) {
  if (!topic) return "";
  return "0x" + topic.slice(-40).toLowerCase();
}

function decodeWord(data, index) {
  const start = 2 + index * 64;
  return data.slice(start, start + 64);
}

function decodeUintWord(data, index) {
  const word = decodeWord(data, index);
  return word ? BigInt("0x" + word) : 0n;
}

function decodeBatch(data) {
  try {
    const offsetIds = Number(decodeUintWord(data, 0));
    const offsetValues = Number(decodeUintWord(data, 1));
    const idsBase = 2 + offsetIds / 32;
    const valuesBase = 2 + offsetValues / 32;
    const idCount = Number(decodeUintWord(data, idsBase));
    const valueCount = Number(decodeUintWord(data, valuesBase));
    const count = Math.min(idCount, valueCount, 100);
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({
        tokenId: decodeUintWord(data, idsBase + 1 + i).toString(),
        amount: decodeUintWord(data, valuesBase + 1 + i)
      });
    }
    return items;
  } catch {
    return [];
  }
}

function parseMintLog(log) {
  if (!log?.topics || log.topics.length < 4) return [];
  const from = topicAddress(log.topics[2]);
  if (from !== ZERO_ADDRESS) return [];

  const to = topicAddress(log.topics[3]);
  const data = log.data || "0x";
  const isBatch = data.length > 130;
  if (!isBatch) {
    return [{
      txHash: log.transactionHash,
      blockNumber: Number(hexToBigInt(log.blockNumber)),
      logIndex: Number(hexToBigInt(log.logIndex)),
      to,
      tokenId: decodeUintWord(data, 0).toString(),
      amount: decodeUintWord(data, 1)
    }];
  }

  return decodeBatch(data).map(item => ({
    txHash: log.transactionHash,
    blockNumber: Number(hexToBigInt(log.blockNumber)),
    logIndex: Number(hexToBigInt(log.logIndex)),
    to,
    tokenId: item.tokenId,
    amount: item.amount
  }));
}

function mergeEvents(items) {
  const map = new Map();
  [...liveEvents, ...items].forEach(item => {
    const key = item.txHash + ":" + item.logIndex + ":" + item.tokenId;
    map.set(key, item);
  });
  liveEvents = [...map.values()]
    .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
    .slice(0, MAX_FEED_ITEMS);
}

function renderLiveFeed() {
  const feed = document.getElementById("mintFeed");
  if (!feed) return;

  if (!liveEvents.length) {
    feed.innerHTML = '<div class="emptyFlow">No transistor mint events were found in the loaded history yet. Keep this page open and new mints will appear automatically.</div>';
    return;
  }

  feed.innerHTML = liveEvents.map((event, index) => {
    const liveClass = index === 0 ? " flowNew" : "";
    return '<article class="flow' + liveClass + '">' +
      '<div class="flowIcon">M</div>' +
      '<div class="flowMain">' +
        '<div class="flowTitle">XBOT Transistor Mint · Token #' + event.tokenId + '</div>' +
        '<div class="flowMeta">TO <code>' + shortAddress(event.to) + '</code> · BLOCK ' + event.blockNumber.toLocaleString() + ' · <a href="https://www.oklink.com/x-layer/tx/' + event.txHash + '" target="_blank" rel="noopener">TX ' + shortAddress(event.txHash) + ' ↗</a></div>' +
      '</div>' +
      '<div class="flowAmount"><strong>+' + formatUnits(event.amount) + '</strong><span>' + (event.live ? "LIVE" : formatTime(event.time)) + '</span></div>' +
    '</article>';
  }).join("");

  const count = liveEvents.length;
  const units = liveEvents.reduce((sum, item) => sum + item.amount, 0n);
  setText("mintCount", count.toLocaleString());
  setText("mintUnits", formatUnits(units));
}

function setLiveStatus(kind, text) {
  const dot = document.getElementById("liveDot");
  const label = document.getElementById("liveConnection");
  if (dot) dot.className = "liveDot " + (kind === "on" ? "on" : kind === "warn" ? "warn" : "");
  if (label) label.textContent = text;
}

async function loadRecentMints() {
  if (liveBusy) return;
  liveBusy = true;
  try {
    setLiveStatus("warn", "SYNCING X LAYER");
    const latestHex = await rpc("eth_blockNumber");
    const latest = Number(hexToBigInt(latestHex));
    lastLiveBlock = latest;
    setText("liveBlock", latest.toLocaleString());

    const from = Math.max(0, latest - LIVE_HISTORY_BLOCKS);
    const logs = await rpc("eth_getLogs", [{
      address: TRANSISTOR_CONTRACT,
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + latest.toString(16)
    }]);

    const parsed = [];
    for (const log of logs || []) {
      parsed.push(...parseMintLog(log));
    }
    parsed.forEach(item => { item.time = Date.now(); item.live = false; });
    mergeEvents(parsed);
    renderLiveFeed();
    setLiveStatus("on", "LIVE · X LAYER CONNECTED");
  } catch (error) {
    console.warn("XBOT live tracker:", error);
    setLiveStatus("warn", "RPC RETRYING");
  } finally {
    liveBusy = false;
  }
}

async function pollLatestBlock() {
  try {
    const latest = Number(hexToBigInt(await rpc("eth_blockNumber")));
    setText("liveBlock", latest.toLocaleString());
    if (lastLiveBlock === null) {
      lastLiveBlock = latest;
      return;
    }
    if (latest <= lastLiveBlock) return;

    const logs = await rpc("eth_getLogs", [{
      address: TRANSISTOR_CONTRACT,
      fromBlock: "0x" + (lastLiveBlock + 1).toString(16),
      toBlock: "0x" + latest.toString(16)
    }]);

    const parsed = [];
    for (const log of logs || []) parsed.push(...parseMintLog(log));
    parsed.forEach(item => { item.time = Date.now(); item.live = true; });
    if (parsed.length) {
      mergeEvents(parsed);
      renderLiveFeed();
    }
    lastLiveBlock = latest;
  } catch (error) {
    console.warn("XBOT block poll:", error);
  }
}

function startHttpFallback() {
  if (pollTimer) return;
  pollTimer = setInterval(pollLatestBlock, 5000);
}

function startWebSocket() {
  if (!("WebSocket" in window)) {
    startHttpFallback();
    return;
  }

  try {
    liveSocket = new WebSocket(X_LAYER_WSS);
    liveSocket.onopen = () => {
      setLiveStatus("on", "LIVE · X LAYER WEBSOCKET");
      liveSocket.send(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_subscribe",
        params: ["logs", { address: TRANSISTOR_CONTRACT }]
      }));
    };

    liveSocket.onmessage = async message => {
      try {
        const payload = JSON.parse(message.data);
        if (payload.method !== "eth_subscription" || !payload.params?.result) return;
        const parsed = parseMintLog(payload.params.result);
        if (!parsed.length) return;
        parsed.forEach(item => { item.time = Date.now(); item.live = true; });
        mergeEvents(parsed);
        renderLiveFeed();
        const block = Number(hexToBigInt(payload.params.result.blockNumber));
        lastLiveBlock = Math.max(lastLiveBlock || 0, block);
        setText("liveBlock", block.toLocaleString());
      } catch (error) {
        console.warn("XBOT websocket event:", error);
      }
    };

    liveSocket.onerror = () => {
      setLiveStatus("warn", "WS UNAVAILABLE · HTTP FALLBACK");
      startHttpFallback();
    };

    liveSocket.onclose = () => {
      setLiveStatus("warn", "WS RECONNECTING");
      startHttpFallback();
      setTimeout(startWebSocket, 6000);
    };
  } catch {
    startHttpFallback();
  }
}

async function initLiveTracker() {
  await loadRecentMints();
  startWebSocket();
  startHttpFallback();
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

document.getElementById("refreshLive")?.addEventListener("click", loadRecentMints);

render();
initLiveTracker();
