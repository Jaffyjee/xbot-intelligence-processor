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

  
/* -----------------------------
   XBOT direct wallet mint
   ----------------------------- */
const XBOT_CHAIN_ID = "0xc4"; // 196
const XBOT_CHAIN_HEX = "0xc4";
const XBOT_CONTRACT = TRANSISTOR_CONTRACT;
const XBOT_UNIT_PRICE_WEI = 9000000000000000n; // 0.009 OKB
const XBOT_FALLBACK_PROTOCOL_FEE_WEI = 660000000000000n; // observed XBOT UI quote: 0.00066 OKB
const MINT_UINT_SELECTOR = "0xa0712d68"; // mint(uint256) legacy
const MINT_TWO_UINT_SELECTOR = "0x1b2ef1ca"; // mint(uint256,uint256)
const MINT_ADDRESS_TWO_UINT_SELECTOR = "0x156e29f6"; // mint(address,uint256,uint256)
const MINT_ADDRESS_TWO_UINT_BYTES_SELECTOR = "0x731133e9"; // mint(address,uint256,uint256,bytes)
const MINT_TWO_UINT_BYTES_SELECTOR = "0x08dc9f42"; // mint(uint256,uint256,bytes)
let walletAccount = null;
let walletProvider = null;
let mintProtocolFeeWei = XBOT_FALLBACK_PROTOCOL_FEE_WEI;

function hex32(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}
function address32(address) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
function bytesEmpty() {
  // ABI offset for the fourth (dynamic bytes) argument after
  // three 32-byte static arguments is 0x80.
  return "0000000000000000000000000000000000000000000000000000000000000080" +
    "0000000000000000000000000000000000000000000000000000000000000000";
}
function weiToOkb(wei) {
  const n = typeof wei === "bigint" ? wei : BigInt(wei || 0);
  const whole = n / 1000000000000000n;
  const frac = (n % 1000000000000000n).toString().padStart(15, "0").slice(0, 6);
  return whole.toString() + "." + frac.replace(/0+$/, "").padEnd(1, "0");
}
function setMintStatus(text, type = "") {
  const el = document.getElementById("mintStatus");
  if (el) { el.textContent = text; el.className = "mintStatus " + type; }
}
function shortWallet(a) { return a ? a.slice(0,6) + "…" + a.slice(-4) : "Not connected"; }

async function ensureXLayer() {
  if (!walletProvider) return false;
  const chain = await walletProvider.request({ method: "eth_chainId" });
  if (chain === XBOT_CHAIN_ID) return true;
  try {
    await walletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: XBOT_CHAIN_ID }] });
    return true;
  } catch (error) {
    if (error?.code === 4902) {
      await walletProvider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: XBOT_CHAIN_ID,
          chainName: "X Layer",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: [X_LAYER_HTTP],
          blockExplorerUrls: ["https://www.oklink.com/x-layer"]
        }]
      });
      return true;
    }
    throw error;
  }
}

async function readProtocolFee() {
  try {
    const result = await walletProvider.request({
      method: "eth_call",
      params: [{ to: XBOT_CONTRACT, data: "0xb0e21e8a" }, "latest"]
    });
    if (result && result !== "0x") {
      const fee = BigInt(result);
      if (fee >= 0n && fee < 1000000000000000000n) mintProtocolFeeWei = fee;
    }
  } catch {}
}

function updateMintQuote() {
  const input = document.getElementById("mintQuantity");
  if (!input) return;
  let q = Math.floor(Number(input.value || 1));
  q = Math.max(1, Math.min(1000000000, q));
  input.value = q;
  const total = XBOT_UNIT_PRICE_WEI * BigInt(q) + mintProtocolFeeWei;
  setText("mintUnitPrice", "0.009 OKB");
  setText("mintTotalPrice", weiToOkb(total) + " OKB");
}

async function connectWallet() {
  if (!window.ethereum) {
    setMintStatus("No EVM wallet detected. Open this page in MetaMask, OKX Wallet, or another compatible wallet.", "error");
    return;
  }
  walletProvider = window.ethereum;
  try {
    const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
    walletAccount = accounts?.[0];
    if (!walletAccount) throw new Error("No wallet account returned.");
    await ensureXLayer();
    await readProtocolFee();
    const balance = await walletProvider.request({ method: "eth_getBalance", params: [walletAccount, "latest"] });
    document.getElementById("walletAddress").textContent = shortWallet(walletAccount) + " · " + weiToOkb(BigInt(balance)) + " OKB";
    document.getElementById("connectWallet").textContent = "CONNECTED";
    document.getElementById("mintButton").textContent = "MINT XBOT TRANSISTORS";
    window.dispatchEvent(new CustomEvent("xbotwalletconnected", {
      detail: { address: walletAccount, chainId: XBOT_CHAIN_ID }
    }));
    setMintStatus("Wallet connected. Signing is ready. Every transaction or signature will require approval in your wallet.", "");
    updateMintQuote();
  } catch (error) {
    setMintStatus(error?.message || "Wallet connection cancelled.", "error");
  }
}

async function estimateMintData(quantity, valueHex) {
  // TapeOut processors use ERC-1155 transistor contracts, so the public
  // purchase entry point must identify which transistor type is being
  // purchased. XBOT uses token ID 0 (NAND) for the processor demo.
  // We probe read-only gas estimates first and only send the route that
  // the deployed contract actually accepts.
  const candidates = [
    {
      label: "mint(tokenId, quantity)",
      data: MINT_TWO_UINT_SELECTOR + hex32(0) + hex32(quantity)
    },
    {
      label: "mint(quantity, tokenId)",
      data: MINT_TWO_UINT_SELECTOR + hex32(quantity) + hex32(0)
    },
    {
      label: "mint(tokenId, quantity, bytes)",
      data: MINT_TWO_UINT_BYTES_SELECTOR + hex32(0) + hex32(quantity) +
        "0000000000000000000000000000000000000000000000000000000000000060" +
        "0000000000000000000000000000000000000000000000000000000000000000"
    },
    {
      label: "mint(recipient, tokenId, quantity)",
      data: MINT_ADDRESS_TWO_UINT_SELECTOR + address32(walletAccount) + hex32(0) + hex32(quantity)
    },
    {
      label: "mint(recipient, tokenId, quantity, bytes)",
      data: MINT_ADDRESS_TWO_UINT_BYTES_SELECTOR + address32(walletAccount) + hex32(0) + hex32(quantity) + bytesEmpty()
    },
    {
      label: "mint(quantity)",
      data: MINT_UINT_SELECTOR + hex32(quantity)
    }
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      await walletProvider.request({
        method: "eth_estimateGas",
        params: [{
          from: walletAccount,
          to: XBOT_CONTRACT,
          value: valueHex,
          data: candidate.data
        }]
      });
      return candidate;
    } catch (error) {
      failures.push(candidate.label);
    }
  }

  throw new Error(
    "The XBOT TapeOut transistor contract rejected every supported mint route. " +
    "No transaction was sent. Tried: " + failures.join(", ") + "."
  );
}

/**
 * Central wallet-signing callback.
 *
 * Every signing request is explicitly forwarded to the connected wallet.
 * The wallet remains the final authority: this page never receives a
 * private key and never auto-approves a signature.
 *
 * Supported request types:
 *   { type: "transaction", tx: {...} } -> eth_sendTransaction
 *   { type: "personal", message: "..." } -> personal_sign
 *   { type: "typedData", typedData: "..." } -> eth_signTypedData_v4
 *
 * A plain transaction object is also accepted for convenience.
 */
async function requestWalletSignature(request) {
  if (!walletProvider || !walletAccount) {
    throw new Error("Connect your wallet before requesting a signature.");
  }

  const normalized = request?.type ? request : { type: "transaction", tx: request };

  if (normalized.type === "transaction") {
    const tx = { ...(normalized.tx || {}) };
    tx.from = tx.from || walletAccount;

    if (!tx.to && !tx.data) {
      throw new Error("A transaction requires a destination or calldata.");
    }

    // This is the wallet callback: the connected wallet displays the
    // transaction and asks the user to approve/reject it.
    return walletProvider.request({
      method: "eth_sendTransaction",
      params: [tx]
    });
  }

  if (normalized.type === "personal") {
    if (!normalized.message) throw new Error("A message is required to sign.");
    return walletProvider.request({
      method: "personal_sign",
      params: [normalized.message, walletAccount]
    });
  }

  if (normalized.type === "typedData") {
    if (!normalized.typedData) throw new Error("Typed data is required to sign.");
    return walletProvider.request({
      method: "eth_signTypedData_v4",
      params: [walletAccount, typeof normalized.typedData === "string"
        ? normalized.typedData
        : JSON.stringify(normalized.typedData)]
    });
  }

  throw new Error("Unsupported wallet signing request type.");
}

// Public callback API for future XBOT transaction flows.
// Nothing is signed until a caller explicitly invokes one of these methods.
window.XBOTWallet = Object.freeze({
  getAddress: () => walletAccount,
  isConnected: () => Boolean(walletProvider && walletAccount),
  signTransaction: tx => requestWalletSignature({ type: "transaction", tx }),
  signMessage: message => requestWalletSignature({ type: "personal", message }),
  signTypedData: typedData => requestWalletSignature({ type: "typedData", typedData })
});

async function mintXBOT() {
  if (!walletProvider || !walletAccount) { await connectWallet(); return; }
  const input = document.getElementById("mintQuantity");
  const quantity = Math.floor(Number(input.value || 0));
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000000) {
    setMintStatus("Enter a whole-number quantity between 1 and 1,000,000,000.", "error");
    return;
  }

  const button = document.getElementById("mintButton");
  button.disabled = true;
  try {
    await ensureXLayer();
    await readProtocolFee();
    updateMintQuote();
    const total = XBOT_UNIT_PRICE_WEI * BigInt(quantity) + mintProtocolFeeWei;
    const valueHex = "0x" + total.toString(16);
    setMintStatus("Checking the live contract before asking your wallet to sign…");
    const candidate = await estimateMintData(quantity, valueHex);
    setMintStatus("Ready. Confirm the X Layer transaction in your wallet…");
    const txHash = await requestWalletSignature({
      from: walletAccount,
      to: XBOT_CONTRACT,
      value: valueHex,
      data: candidate.data
    });
    setMintStatus("Transaction submitted. Waiting for on-chain confirmation…");
    await waitForReceipt(txHash);
    showMintSuccess(quantity, txHash);
    setMintStatus("Mint confirmed successfully on X Layer.", "success");
    await loadRecentMints();
  } catch (error) {
    if (error?.code === 4001) setMintStatus("Transaction cancelled in wallet.", "error");
    else setMintStatus(error?.message || "Mint failed. No completed purchase was recorded.", "error");
  } finally {
    button.disabled = false;
  }
}

async function waitForReceipt(txHash) {
  for (let i = 0; i < 120; i++) {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("The transaction was mined but reverted. No transistor was minted.");
      return receipt;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Confirmation is taking longer than expected. Check the transaction on OKLink.");
}

function showMintSuccess(quantity, txHash) {
  const modal = document.getElementById("mintSuccessModal");
  setText("mintSuccessAmount", "+" + quantity.toLocaleString() + " XBOT Transistor" + (quantity === 1 ? "" : "s"));
  const tx = document.getElementById("mintSuccessTx");
  tx.href = "https://www.oklink.com/x-layer/tx/" + txHash;
  tx.textContent = "View confirmed transaction ↗";
  modal.classList.add("open");
}
function closeMintSuccess() { document.getElementById("mintSuccessModal")?.classList.remove("open"); }

document.getElementById("connectWallet")?.addEventListener("click", connectWallet);
document.getElementById("mintButton")?.addEventListener("click", mintXBOT);
document.getElementById("mintQuantity")?.addEventListener("input", updateMintQuote);
document.getElementById("closeMintSuccess")?.addEventListener("click", closeMintSuccess);
document.getElementById("mintSuccessModal")?.addEventListener("click", e => { if (e.target.id === "mintSuccessModal") closeMintSuccess(); });
if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", accounts => {
    walletAccount = accounts?.[0] || null;
    if (!walletAccount) {
      setText("walletAddress", "Not connected");
      setText("connectWallet", "CONNECT WALLET");
      setText("mintButton", "CONNECT WALLET TO MINT");
    } else connectWallet();
  });
  window.ethereum.on?.("chainChanged", () => { if (walletAccount) connectWallet(); });
}
updateMintQuote();


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


/* -----------------------------
   XBOT theme + bilingual interface
   ----------------------------- */
(function initTheme() {
  const root = document.documentElement;
  const button = document.getElementById("themeToggle");
  const saved = localStorage.getItem("xbot-theme");
  let mode = saved === "light" || saved === "dark" ? saved : "dark";

  function applyTheme() {
    root.setAttribute("data-theme", mode);
    if (button) {
      const icon = mode === "light" ? "☀" : "☾";
      button.innerHTML = '<span class="themeIcon">' + icon + '</span><span>' + mode.toUpperCase() + '</span>';
      button.setAttribute("aria-label", "Theme: " + mode + ". Click to switch.");
      button.title = "Theme: " + mode + " · click to switch";
    }
  }

  button?.addEventListener("click", () => {
    mode = mode === "dark" ? "light" : "dark";
    localStorage.setItem("xbot-theme", mode);
    applyTheme();
  });

  applyTheme();
})();

/* -----------------------------
   English / Simplified Chinese
   ----------------------------- */
(function initLanguage() {
  const group = document.getElementById("languageToggle");
  if (!group) return;

  let language = localStorage.getItem("xbot-language") === "zh" ? "zh" : "en";

  const zh = {
    "XBOT INTELLIGENCE PROCESSOR":"XBOT 智能处理器",
    "TAPEOUT CIRCUIT / ON-CHAIN LOGIC":"TAPEOUT 电路 / 链上逻辑",
    "Intelligence,":"智能，",
    "made deterministic.":"变得确定。",
    "Intelligence, made deterministic.":"让智能变得确定。",
    "A hardware-style consensus layer for XBOT. Three intelligence signals enter the processor; NAND logic deterministically decides whether two-of-three consensus is satisfied.":"为 XBOT 打造的硬件式共识层。三个智能信号进入处理器，由 NAND 逻辑确定性判断是否满足三选二共识。",
    "CIRCUIT":"电路",
    "NETWORK":"网络",
    "PRIMITIVE":"基础逻辑",
    "FUNCTION":"功能",
    "TRANSISTOR SUPPLY":"晶体管供应量",
    "UNIT MINT PRICE":"单个铸造价格",
    "PROCESSOR":"处理器",
    "CIRCUIT STATUS":"电路状态",
    "disclosed at deployment":"部署时公开披露",
    "excluding protocol fee":"不含协议费用",
    "DEPLOYED":"已部署",
    "X Layer · TapeOut":"X Layer · TapeOut",
    "TAPED OUT":"已完成 TapeOut",
    "reference 3.2.268":"参考编号 3.2.268",
    "Participation & submission":"参与与提交",
    "TapeOut requirement matrix":"TapeOut 要求矩阵",
    "X Layer × TapeOut":"X Layer × TapeOut",
    "Public supply + price":"公开供应量与价格",
    "TapeOut completed":"TapeOut 已完成",
    "Deterministic consensus":"确定性共识",
    "XBOT processor deployed on X Layer through TapeOut.":"XBOT 处理器已通过 TapeOut 部署在 X Layer。",
    "transistor supply/cap":"晶体管供应量/上限",
    "per transistor":"每个晶体管",
    "is the demonstrated XBOT Consensus circuit.":"是本项目展示的 XBOT 共识电路。",
    "Risk + Liquidity + Market → NAND network → 2-of-3 XBOT Consensus.":"风险 + 流动性 + 市场 → NAND 网络 → 三选二 XBOT 共识。",
    "Submission package":"提交材料",
    "Processor contract":"处理器合约",
    "Deployment wallet":"部署钱包",
    "Product demo":"产品演示",
    "Project description":"项目说明",
    "TapeOut circuit":"TapeOut 电路",
    "Network":"网络",
    "Intelligence inputs":"智能输入",
    "Binary signal control":"二进制信号控制",
    "Risk":"风险",
    "Liquidity":"流动性",
    "Market":"市场",
    "LOW":"低",
    "HIGH":"高",
    "Processor execution":"处理器执行",
    "Live NAND path":"实时 NAND 路径",
    "XBOT Consensus":"XBOT 共识",
    "ACTIVE SIGNALS":"活跃信号",
    "DECISION":"决策",
    "2 / 3 HIGH → CONSENSUS":"2 / 3 高 → 达成共识",
    "Run 8-case verification":"运行 8 种状态验证",
    "Reset":"重置",
    "RESET":"重置",
    "TapeOut asset lifecycle":"TapeOut 资产生命周期",
    "Primitive → reusable circuit":"基础元件 → 可复用电路",
    "Mint":"铸造",
    "Transistor asset":"晶体管资产",
    "Design":"设计",
    "Logic composition":"逻辑组合",
    "Tape Out":"Tape Out",
    "Burn":"销毁",
    "Result":"结果",
    "Circuit NFT":"电路 NFT",
    "Mint XBOT Transistors":"铸造 XBOT 晶体管",
    "Direct X Layer mint · wallet controlled":"直接在 X Layer 铸造 · 钱包控制",
    "Connect wallet":"连接钱包",
    "CONNECT WALLET":"连接钱包",
    "Quantity":"数量",
    "Estimated total":"预计总计",
    "Protocol fee":"协议费用",
    "MINT XBOT TRANSISTORS":"铸造 XBOT 晶体管",
    "CONNECT WALLET TO MINT":"连接钱包以铸造",
    "Live X Layer flow":"实时 X Layer 流程",
    "ERC-1155 mint activity · no API key":"ERC-1155 铸造活动 · 无需 API 密钥",
    "LIVE · X LAYER CONNECTED":"实时 · X LAYER 已连接",
    "LIVE · X LAYER WEBSOCKET":"实时 · X LAYER WebSocket",
    "SYNCING X LAYER":"正在同步 X LAYER",
    "RPC RETRYING":"RPC 重试中",
    "RPC RETRYING":"RPC 重试中",
    "On-chain proof":"链上证明",
    "Public deployment references":"公开部署信息",
    "Connect with XBOT":"连接 XBOT",
    "Official channels":"官方渠道",
    "Verification matrix":"验证矩阵",
    "Complete 2-of-3 state space":"完整三选二状态空间",
    "CURRENT":"当前",
    "ASSERT":"通过",
    "REJECT":"拒绝",
    "LOW / LOW / LOW":"低 / 低 / 低",
    "HIGH / HIGH / HIGH":"高 / 高 / 高",
    "Experimental digital-logic project.":"实验性数字逻辑项目。",
    "not financial advice":"非金融建议",
    "View confirmed transaction ↗":"查看已确认交易 ↗",
    "Mint confirmed successfully on X Layer.":"已在 X Layer 成功确认铸造。",
    "Transaction submitted. Waiting for on-chain confirmation…":"交易已提交，等待链上确认…",
    "Transaction cancelled in wallet.":"交易已在钱包中取消。",
    "Mint failed. No completed purchase was recorded.":"铸造失败，未记录完成的购买。",
    "Ready. Confirm the X Layer transaction in your wallet…":"准备就绪。请在钱包中确认 X Layer 交易…",
    "No transistor mint events were found in the loaded history yet. Keep this page open and new mints will appear automatically.":"当前加载的历史记录中尚未发现晶体管铸造事件。保持页面打开，新铸造会自动显示。",
    "XBOT Transistor Mint · Token #":"XBOT 晶体管铸造 · 代币 #",
    "just now":"刚刚",
    "time unavailable":"时间不可用",
    "LIVE":"实时",
    "TO ":"发送至 ",
    "BLOCK ":"区块 ",
    "TX ":"交易 "
  };

  const originalText = new WeakMap();

  function translateText(text) {
    if (!text) return text;
    const clean = text.trim();
    if (!clean) return text;
    if (language === "en") return originalTextValue(clean, text);
    if (zh[clean]) return text.replace(clean, zh[clean]);

    let translated = clean;
    Object.keys(zh)
      .filter(key => key.length > 3 && !key.includes(" · "))
      .sort((a,b) => b.length - a.length)
      .forEach(key => {
        translated = translated.split(key).join(zh[key]);
      });
    return text.replace(clean, translated);
  }

  function originalTextValue(clean, fallback) {
    return fallback;
  }

  function applyLanguage() {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";

    document.querySelectorAll("body *").forEach(el => {
      if (el.closest("#languageToggle")) return;
      if (el.children.length) return;
      if (!originalText.has(el)) originalText.set(el, el.textContent);
      const source = originalText.get(el);
      if (language === "zh") el.textContent = translateText(source);
      else el.textContent = source;
    });

    group.querySelectorAll("[data-language]").forEach(btn => {
      const active = btn.dataset.language === language;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    const title = language === "zh" ? "切换语言" : "Change language";
    group.setAttribute("aria-label", title);
  }

  group.querySelectorAll("[data-language]").forEach(btn => {
    btn.addEventListener("click", () => {
      language = btn.dataset.language;
      localStorage.setItem("xbot-language", language);
      applyLanguage();
    });
  });

  /* Translate dynamic text added later by the live feed / wallet UI. */
  const observer = new MutationObserver(mutations => {
    if (language !== "zh") return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        node.querySelectorAll("*").forEach(el => {
          if (el.closest("#languageToggle")) return;
          if (el.children.length) return;
          if (!originalText.has(el)) originalText.set(el, el.textContent);
          el.textContent = translateText(originalText.get(el));
        });
        if (!node.children?.length && node.textContent && !node.closest("#languageToggle")) {
          if (!originalText.has(node)) originalText.set(node, node.textContent);
          node.textContent = translateText(originalText.get(node));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  applyLanguage();
})();
