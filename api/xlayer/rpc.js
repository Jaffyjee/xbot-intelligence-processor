const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_getTransactionReceipt",
  "eth_call"
]);

const MAX_BODY_BYTES = 20000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rpcUrl = process.env.XLAYER_RPC_URL;
  if (!rpcUrl) return res.status(503).json({ error: "XLAYER_RPC_URL is not configured" });

  try {
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (raw.length > MAX_BODY_BYTES) return res.status(413).json({ error: "Request too large" });

    const payload = JSON.parse(raw);
    if (!payload || typeof payload.method !== "string" || !ALLOWED_METHODS.has(payload.method)) {
      return res.status(400).json({ error: "RPC method is not allowed" });
    }

    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: payload.id ?? Date.now(),
        method: payload.method,
        params: Array.isArray(payload.params) ? payload.params : []
      })
    });

    const text = await upstream.text();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).send(text);
  } catch (error) {
    return res.status(502).json({
      error: "X Layer RPC upstream request failed",
      message: error?.message || "Unknown RPC error"
    });
  }
}
