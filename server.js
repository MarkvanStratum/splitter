import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory DB (for now)
const campaigns = {};

// Generate random ID
function generateId() {
  return Math.random().toString(36).substring(2, 8);
}

// Weighted picker
function pickWeighted(links) {
  const total = links.reduce((sum, l) => sum + l.weight, 0);
  const rand = Math.random() * total;

  let cumulative = 0;
  for (const link of links) {
    cumulative += link.weight;
    if (rand < cumulative) return link.url;
  }
}

// ✅ Create campaign
app.post("/campaign", (req, res) => {
  const id = generateId();
  campaigns[id] = [];
  res.json({
    id,
    link: `/r/${id}`
  });
});

// ✅ Add link to campaign
app.post("/campaign/:id/link", (req, res) => {
  const { url, weight } = req.body;
  const { id } = req.params;

  if (!campaigns[id]) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  campaigns[id].push({ url, weight });

  res.json({ success: true });
});

// ✅ Get campaign
app.get("/campaign/:id", (req, res) => {
  const { id } = req.params;

  if (!campaigns[id]) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  res.json(campaigns[id]);
});

// ✅ Redirect
app.get("/r/:id", (req, res) => {
  const links = campaigns[req.params.id];

  if (!links || links.length === 0) {
    return res.status(404).send("Campaign not found or empty");
  }

  const target = pickWeighted(links);
  res.redirect(302, target);
});

// Home
app.get("/", (req, res) => {
  res.send("Splitter API running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});