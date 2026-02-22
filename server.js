import express from "express";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Persistent storage
const DATA_FILE = "./data.json";

let campaigns = {};

// Load data on startup
if (fs.existsSync(DATA_FILE)) {
  const raw = fs.readFileSync(DATA_FILE);
  campaigns = JSON.parse(raw);
}

// Save function
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(campaigns, null, 2));
}

// --- helpers ---
function generateId() {
  return Math.random().toString(36).substring(2, 8);
}

function pickWeighted(links) {
  const total = links.reduce((sum, l) => sum + Number(l.weight || 0), 0);
  const rand = Math.random() * total;

  let cumulative = 0;
  for (const link of links) {
    cumulative += Number(link.weight || 0);
    if (rand < cumulative) return link.url;
  }
  return links[links.length - 1].url;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// --- pages ---
app.get("/", (req, res) => {
  res.send(`Splitter running 🚀<br><br>
  Go to <a href="/admin">/admin</a> to create campaigns.`);
});

app.get("/admin", (req, res) => {
  const list = Object.entries(campaigns)
    .map(([id, links]) => {
      const linkRows = links.map(l =>
        `<li>${escapeHtml(l.url)} — <b>${escapeHtml(l.weight)}</b>%</li>`
      ).join("");

      return `
        <div style="border:1px solid #ddd;padding:12px;border-radius:10px;margin:12px 0;">
          <div><b>Campaign:</b> ${escapeHtml(id)}</div>
          <div><b>Redirect link:</b> <a href="/r/${escapeHtml(id)}" target="_blank">/r/${escapeHtml(id)}</a></div>
          <div style="margin-top:8px;"><b>Links:</b></div>
          <ul>${linkRows || "<li><i>No links yet</i></li>"}</ul>

          <form method="POST" action="/admin/add-link" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <input type="hidden" name="campaignId" value="${escapeHtml(id)}" />
            <input name="url" placeholder="https://example.com" style="padding:8px;min-width:260px;" required />
            <input name="weight" type="number" min="0" step="1" placeholder="Weight %" style="padding:8px;width:120px;" required />
            <button style="padding:8px 14px;cursor:pointer;">Add link</button>
          </form>
        </div>
      `;
    })
    .join("");

  res.send(`
    <div style="font-family:system-ui,Segoe UI,Arial;padding:20px;max-width:900px;margin:auto;">
      <h1>Splitter Admin</h1>

      <form method="POST" action="/admin/create" style="margin:14px 0;">
        <button style="padding:10px 16px;cursor:pointer;">+ Create new campaign</button>
      </form>

      ${list || "<p>No campaigns yet. Click “Create new campaign”.</p>"}

      <hr style="margin:24px 0;" />
      <p style="color:#555;">
        Tip: Weights don’t have to add up to 100 — they’re treated as relative. (10/20/70 works great.)
      </p>
    </div>
  `);
});

// --- admin actions (no extra software) ---
app.post("/admin/create", (req, res) => {
  const id = generateId();
  campaigns[id] = [];

  saveData(); // <-- ADD THIS

  res.redirect("/admin");
});

app.post("/admin/add-link", (req, res) => {
  const { campaignId, url, weight } = req.body;

  if (!campaigns[campaignId]) {
    return res.status(404).send("Campaign not found");
  }

  // basic URL sanity check
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Bad protocol");
  } catch {
    return res.status(400).send('Invalid URL. Must start with "http://" or "https://".');
  }

  const w = Number(weight);
  if (!Number.isFinite(w) || w < 0) {
    return res.status(400).send("Weight must be a number 0 or greater.");
  }

  campaigns[campaignId].push({ url, weight: w });
res.redirect("/admin");
});

// --- redirect endpoint ---
app.get("/r/:id", (req, res) => {
  const links = campaigns[req.params.id];

  if (!links || links.length === 0) {
    return res.status(404).send("Campaign not found or has no links");
  }

  const total = links.reduce((sum, l) => sum + Number(l.weight || 0), 0);
  if (total <= 0) {
    return res.status(400).send("All weights are 0. Add a link with weight > 0.");
  }

  const target = pickWeighted(links);

// Get everything after "?"
const queryString = req.originalUrl.split("?")[1];

let finalUrl = target;

if (queryString) {
  if (target.includes("?")) {
    finalUrl = target + "&" + queryString;
  } else {
    finalUrl = target + "?" + queryString;
  }
}

res.redirect(302, finalUrl);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));