import express from "express";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Persistent storage
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

app.get("/admin", async (req, res) => {

  const { data, error } = await supabase
    .from("campaigns")
    .select("*");

  if (error) {
    return res.send("Error loading campaigns: " + error.message);
  }

  const rows = data.map(campaign => {
    const id = campaign.id;

    const fullLink = `${req.protocol}://${req.get("host")}/r/${id}?ref=MA576&sub_id=clickid&source=source_id&subsource=sub_source_id&sub1=title&sub2=image&sub3=firstname&sub4=lastname&sub5=addrsss&sub6=postcode&sub7=city&sub8=country&sub9=email&sub10=123456890&pixel=fbpixel`;

    return `
      <tr>
        <td>${escapeHtml(campaign.name)}</td>
        <td>${escapeHtml(campaign.country)}</td>
        <td>${(campaign.links || []).length}</td>
        <td style="display:flex; gap:10px;">
  <a href="/admin/${id}">Open</a>
  <button onclick="copyLink('${fullLink}')">Copy</button>
  <a href="/admin/${id}/edit">Edit</a>
  <form method="POST" action="/admin/delete" onsubmit="return confirm('Delete this campaign?');">
    <input type="hidden" name="campaignId" value="${id}" />
    <button style="color:red;">Delete</button>
  </form>
</td>
      </tr>
    `;
  }).join("");

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

app.get("/admin/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.send("Campaign not found");
  }

  const links = data.links || [];

  const linkRows = links.map(l =>
    `<li>${escapeHtml(l.url)} — <b>${escapeHtml(l.weight)}</b>%</li>`
  ).join("");

  res.send(`
    <div style="font-family:system-ui,Segoe UI,Arial;padding:20px;max-width:900px;margin:auto;">
      <h1>Campaign: ${escapeHtml(data.name)}</h1>
      <p><b>Country:</b> ${escapeHtml(data.country || "-")}</p>

      <p><b>Redirect link:</b> 
        <a href="/r/${escapeHtml(id)}" target="_blank">
          /r/${escapeHtml(id)}
        </a>
      </p>

      <h3>Links</h3>
      <ul>${linkRows || "<li>No links yet</li>"}</ul>

      <form method="POST" action="/admin/add-link">
        <input type="hidden" name="campaignId" value="${escapeHtml(id)}" />
        <input name="url" placeholder="https://example.com" required />
        <input name="weight" type="number" placeholder="Weight %" required />
        <button>Add link</button>
      </form>

      <p><a href="/admin">← Back</a></p>
    </div>
  `);
});

// --- admin actions (no extra software) ---
app.post("/admin/create", async (req, res) => {
  const id = generateId();

  const campaign = {
    id,
    name: req.body.name || "Unnamed",
    country: req.body.country || "ALL",
    links: []
  };

  const { error } = await supabase.from("campaigns").insert([campaign]);

  if (error) {
    return res.send("Error: " + error.message);
  }

  res.redirect("/admin");
});

app.post("/admin/add-link", async (req, res) => {
  const { campaignId, url, weight } = req.body;

  const { data, error } = await supabase
    .from("campaigns")
    .select("links")
    .eq("id", campaignId)
    .single();

  if (error || !data) {
    return res.send("Campaign not found");
  }

  const links = data.links || [];
  links.push({ url, weight: Number(weight) });

  await supabase
    .from("campaigns")
    .update({ links })
    .eq("id", campaignId);

  res.redirect("/admin/" + campaignId);
});

// --- redirect endpoint ---
app.get("/r/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("campaigns")
    .select("links")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).send("Campaign not found");
  }

  const links = data.links || [];

  if (!links.length) {
    return res.status(404).send("No links in campaign");
  }

  const target = pickWeighted(links);

  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";

  res.redirect(302, target + query);
});


app.post("/admin/delete", async (req, res) => {
  const { campaignId } = req.body;

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId);

  if (error) {
    return res.send("Error deleting campaign: " + error.message);
  }

  res.redirect("/admin");
});



app.get("/admin/:id/edit", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.send("Campaign not found");
  }

  res.send(`
    <div style="font-family:system-ui;padding:20px;max-width:900px;margin:auto;">
      <h1>Edit Campaign</h1>

      <form method="POST" action="/admin/update">
        <input type="hidden" name="campaignId" value="${id}" />

        <div style="margin-bottom:10px;">
          <label>Name</label><br/>
          <input name="name" value="${escapeHtml(data.name)}" required style="padding:8px;width:300px;" />
        </div>

        <div style="margin-bottom:10px;">
          <label>Country</label><br/>
          <input name="country" value="${escapeHtml(data.country)}" style="padding:8px;width:300px;" />
        </div>

        <button style="padding:10px 16px;">Save</button>
      </form>

      <p><a href="/admin">← Back</a></p>
    </div>
  `);
});

app.post("/admin/update", async (req, res) => {
  const { campaignId, name, country } = req.body;

  const { error } = await supabase
    .from("campaigns")
    .update({
      name,
      country
    })
    .eq("id", campaignId);

  if (error) {
    return res.send("Error updating campaign: " + error.message);
  }

  res.redirect("/admin/" + campaignId);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));