import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// TEMP database (in memory)
const campaigns = {
  "abc123": [
    { url: "https://google.com", weight: 10 },
    { url: "https://bing.com", weight: 20 },
    { url: "https://duckduckgo.com", weight: 70 }
  ]
};

// weighted random picker
function pickWeighted(links) {
  const total = links.reduce((sum, l) => sum + l.weight, 0);
  const rand = Math.random() * total;

  let cumulative = 0;

  for (const link of links) {
    cumulative += link.weight;
    if (rand < cumulative) {
      return link.url;
    }
  }
}

// redirect endpoint
app.get("/r/:id", (req, res) => {
  const links = campaigns[req.params.id];

  if (!links) {
    return res.status(404).send("Campaign not found");
  }

  const target = pickWeighted(links);
  res.redirect(302, target);
});

// test route
app.get("/", (req, res) => {
  res.send("Splitter running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});