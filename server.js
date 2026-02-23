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
  const rows = Object.entries(campaigns)
  .map(([id, campaign]) => {
    const fullLink = `${req.protocol}://${req.get("host")}/r/${id}?ref=MA576&sub_id=clickid&source=source_id&subsource=sub_source_id&sub1=title&sub2=image&sub3=firstname&sub4=lastname&sub5=addrsss&sub6=postcode&sub7=city&sub8=country&sub9=email&sub10=123456890&pixel=fbpixel`;

    return `
      <tr>
        <td>${escapeHtml(campaign.name)}</td>
        <td>${escapeHtml(campaign.country)}</td>
        <td>${campaign.links.length}</td>
        <td style="display:flex; gap:10px;">
          <a href="/admin/${id}">Open</a>
          <button onclick="copyLink('${fullLink}')">Copy</button>
        </td>
      </tr>
    `;
  })
  .join("");
    

  res.send(`
    <div style="font-family:system-ui;padding:20px;max-width:900px;margin:auto;">
      <h1>Campaigns</h1>

      <form method="POST" action="/admin/create" style="margin-bottom:20px; display:flex; gap:8px;">
        <input name="name" placeholder="Campaign name" required style="padding:8px;" />
        <input name="country" placeholder="Country" style="padding:8px;" />
        <button style="padding:8px 16px;">Create</button>
      </form>

      <table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <th>Name</th>
          <th>Country</th>
          <th>Links</th>
          <th></th>
        </tr>
        ${rows}
      </table>
    </div>

<script>
function copyLink(link) {
  navigator.clipboard.writeText(link);
  alert("Link copied!");
}
</script>

`);
});

app.get("/admin/:id", (req, res) => {
  const id = req.params.id;
  const campaign = campaigns[id];

  if (!campaign) {
    return res.send("Campaign not found");
  }

  const linkRows = campaign.links.map(l =>
    `<li>${escapeHtml(l.url)} — ${l.weight}%</li>`
  ).join("");

  res.send(`
    <div style="font-family:system-ui;padding:20px;max-width:900px;margin:auto;">
      <a href="/admin">← Back</a>

      <h1>${escapeHtml(campaign.name)}</h1>

      <p><b>Country:</b> ${escapeHtml(campaign.country)}</p>

      <p>
        <b>Link:</b><br>
        <a href="/r/${id}" target="_blank">
          ${req.protocol}://${req.get("host")}/r/${id}
        </a>
      </p>

      <h3>Links</h3>
      <ul>${linkRows}</ul>

      <h3>Add Link</h3>
      <form method="POST" action="/admin/add-link">
        <input type="hidden" name="campaignId" value="${id}" />
        <input name="url" placeholder="https://example.com" required style="padding:8px; width:300px;" />
        <input name="weight" type="number" placeholder="Weight %" required style="padding:8px;" />
        <button style="padding:8px;">Add</button>
      </form>
    </div>
  `);
});

// --- admin actions (no extra software) ---
app.post("/admin/create", (req, res) => {
  const id = generateId();

  campaigns[id] = {
    name: req.body.name || "Unnamed",
    country: req.body.country || "ALL",
    links: []
  };

  saveData();

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

  campaigns[campaignId].links.push({ url, weight: w });

  saveData();

  res.redirect("/admin/" + campaignId);
});
// --- redirect endpoint ---
app.get("/r/:id", (req, res) => {
  const campaign = campaigns[req.params.id];
if (!campaign) {
  return res.status(404).send("Campaign not found");
}

const links = campaign.links;

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