import crypto from "node:crypto";

const TRANSISTOR_CONTRACT = "0x7bE7280e31984d18f62218519985EC5DcCa751De";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TRANSFER_SINGLE_TOPIC = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
const TRANSFER_BATCH_TOPIC = "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";
const OKX_BASE = "https://web3.okx.com";
const OKX_PATH = "/api/v5/xlayer/log/by-address-and-topic";

function topicAddress(topic) {
  return topic ? "0x" + topic.slice(-40).toLowerCase() : "";
}

function word(data, index) {
  const start = 2 + index * 64;
  return data.slice(start, start + 64);
}

function uint(data, index) {
  const w = word(data, index);
  return w ? BigInt("0x" + w) : 0n;
}

function batch(data) {
  try {
    const idsOffset = Number(uint(data, 0));
    const valuesOffset = Number(uint(data, 1));
    const idsBase = 2 + idsOffset / 32;
    const valuesBase = 2 + valuesOffset / 32;
    const count = Math.min(Number(uint(data, idsBase)), Number(uint(data, valuesBase)), 100);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        tokenId: uint(data, idsBase + 1 + i).toString(),
        amount: uint(data, valuesBase + 1 + i).toString()
      });
    }
    return out;
  } catch {
    return [];
  }
}

function parseOkxLog(log) {
  if (!log || String(log.address || "").toLowerCase() !== TRANSISTOR_CONTRACT.toLowerCase()) return [];
  const topics = Array.isArray(log.topics) ? log.topics : [];
  if (topics.length < 4) return [];
  const topic0 = String(topics[0]).toLowerCase();
  if (topic0 !== TRANSFER_SINGLE_TOPIC && topic0 !== TRANSFER_BATCH_TOPIC) return [];
  if (topicAddress(topics[2]) !== ZERO_ADDRESS) return [];

  const to = topicAddress(topics[3]);
  const data = log.data || "0x";
  const base = {
    contractAddress: TRANSISTOR_CONTRACT,
    txHash: log.txId,
    blockNumber: Number(log.height),
    logIndex: Number(log.logIndex),
    to,
    time: Number(log.transactionTime) || 0,
    source: "okx"
  };

  if (topic0 === TRANSFER_SINGLE_TOPIC) {
    return [{
      ...base,
      tokenId: uint(data, 0).toString(),
      amount: uint(data, 1).toString()
    }];
  }

  return batch(data).map(item => ({ ...base, ...item }));
}

function sign(timestamp, method, requestPath, queryString) {
  const prehash = timestamp + method + requestPath + queryString;
  return crypto.createHmac("sha256", process.env.OKX_API_SECRET).update(prehash).digest("base64");
}

async function okxGet(topic0) {
  const params = new URLSearchParams({
    chainShortName: "XLAYER",
    address: TRANSISTOR_CONTRACT,
    topic0
  });
  const query = "?" + params.toString();
  const timestamp = new Date().toISOString();
  const response = await fetch(OKX_BASE + OKX_PATH + query, {
    method: "GET",
    headers: {
      "OK-ACCESS-KEY": process.env.OKX_API_KEY,
      "OK-ACCESS-SIGN": sign(timestamp, "GET", OKX_PATH, query),
      "OK-ACCESS-PASSPHRASE": process.env.OKX_API_PASSPHRASE,
      "OK-ACCESS-TIMESTAMP": timestamp
    }
  });

  const json = await response.json();
  if (!response.ok || json.code !== "0") {
    throw new Error(json.msg || "OKX API request failed");
  }
  return Array.isArray(json.data) ? json.data : [];
}

async function rpcVerifyTransactions(events) {
  const rpcUrl = process.env.XLAYER_RPC_URL;
  if (!rpcUrl) return { events, verified: false };

  const uniqueTxs = [...new Set(events.map(e => e.txHash).filter(Boolean))];
  const receiptResults = await Promise.all(uniqueTxs.slice(0, 80).map(async txHash => {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: txHash,
          method: "eth_getTransactionReceipt",
          params: [txHash]
        })
      });
      const json = await response.json();
      const receipt = json.result;
      return [txHash.toLowerCase(), receipt?.status === "0x1" ? receipt : null];
    } catch {
      return [txHash.toLowerCase(), null];
    }
  }));

  const receipts = new Map(receiptResults);

  function decodeReceiptLog(log) {
    if (String(log.address || "").toLowerCase() !== TRANSISTOR_CONTRACT.toLowerCase()) return [];
    const topics = Array.isArray(log.topics) ? log.topics : [];
    if (topics.length < 4) return [];
    const topic0 = String(topics[0] || "").toLowerCase();
    if (topicAddress(topics[2]) !== ZERO_ADDRESS) return [];

    const data = log.data || "0x";
    if (topic0 === TRANSFER_SINGLE_TOPIC) {
      return [{
        tokenId: uint(data, 0).toString(),
        amount: uint(data, 1).toString()
      }];
    }
    if (topic0 === TRANSFER_BATCH_TOPIC) return batch(data);
    return [];
  }

  const verifiedEvents = events.filter(event => {
    const receipt = receipts.get(String(event.txHash).toLowerCase());
    if (!receipt) return false;

    return receipt.logs?.some(log => {
      if (Number(BigInt(log.logIndex || "0x0")) !== event.logIndex) return false;
      const decoded = decodeReceiptLog(log);
      return decoded.some(item =>
        item.tokenId === String(event.tokenId) &&
        item.amount === String(event.amount)
      );
    });
  }).map(event => ({ ...event, verified: true, source: "okx+rpcs" }));

  return { events: verifiedEvents, verified: true };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OKX_API_KEY || !process.env.OKX_API_SECRET || !process.env.OKX_API_PASSPHRASE) {
    return res.status(503).json({ error: "OKX API credentials are not configured" });
  }

  try {
    const requested = Math.max(1, Math.min(80, Number(req.query?.limit || 40)));
    const [single, multi] = await Promise.all([
      okxGet(TRANSFER_SINGLE_TOPIC),
      okxGet(TRANSFER_BATCH_TOPIC)
    ]);

    const all = [...single.flatMap(parseOkxLog), ...multi.flatMap(parseOkxLog)]
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);

    const unique = [];
    const seen = new Set();
    for (const event of all) {
      const key = event.txHash + ":" + event.logIndex + ":" + event.tokenId;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(event);
      }
      if (unique.length >= requested) break;
    }

    const verification = await rpcVerifyTransactions(unique);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      contract: TRANSISTOR_CONTRACT,
      count: verification.events.length,
      source: verification.verified ? "OKX + premium X Layer RPC" : "OKX indexed data",
      events: verification.events
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Unable to retrieve verified XBOT mint events",
      message: error?.message || "Unknown error"
    });
  }
}
