const SUPABASE_URL = "https://dqoxbsoubpsapalfwifh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Kbptq7udQeaGgqOt7Un3vA_eEm6Iunu";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
document.getElementById("signUpBtn").addEventListener("click", async () => {
  const name = document.getElementById("authName").value.trim();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  const message = document.getElementById("authMessage");

  if (!name || !email || !password) {
    message.textContent = "Please fill in all fields.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = "Account created successfully.";
});

document.getElementById("signInBtn").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  const message = document.getElementById("authMessage");

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = "";
  await routeAfterAuth();

});
const services = [
  {name:"Plumbing", icon:"🚰", desc:"Leaks, taps, toilets, pipes and water issues."},
  {name:"Electrical", icon:"🔌", desc:"Sockets, lights, wiring and electrical faults."},
  {name:"Carpentry", icon:"🪚", desc:"Doors, cabinets, furniture and woodwork."},
  {name:"Painting", icon:"🎨", desc:"Walls, rooms, touch-ups and repainting."},
  {name:"Appliance Repair", icon:"🔧", desc:"Home appliances that need inspection or repair."},
  {name:"Masonry", icon:"🧱", desc:"Walls, cracks, tiles and general building work."},
  {name:"Cleaning", icon:"🧹", desc:"Home, office and move-in/move-out cleaning."},
  {name:"General Handyman", icon:"🛠️", desc:"Small repairs and maintenance around the property."}
];

const technicians = {
  "Plumbing": {name:"David Mwangi", initials:"DM", rating:"4.8", jobs:"126", area:"Nairobi"},
  "Electrical": {name:"Brian Otieno", initials:"BO", rating:"4.9", jobs:"98", area:"Nairobi"},
  "Carpentry": {name:"Peter Kamau", initials:"PK", rating:"4.7", jobs:"74", area:"Nairobi"},
  "Painting": {name:"Samuel Kariuki", initials:"SK", rating:"4.8", jobs:"61", area:"Nairobi"},
  "Appliance Repair": {name:"James Wekesa", initials:"JW", rating:"4.7", jobs:"83", area:"Nairobi"},
  "Masonry": {name:"Joseph Maina", initials:"JM", rating:"4.8", jobs:"112", area:"Nairobi"},
  "Cleaning": {name:"Mary Wanjiku", initials:"MW", rating:"4.9", jobs:"143", area:"Nairobi"},
  "General Handyman": {name:"Alex Njoroge", initials:"AN", rating:"4.8", jobs:"91", area:"Nairobi"}
};

let requests = JSON.parse(localStorage.getItem("fixmate_requests") || "[]");

function renderServices() {
  document.getElementById("homeServices").innerHTML = services.slice(0,8).map(s => `
    <article class="service" onclick="startRequest('${s.name}')">
      <div class="service-icon">${s.icon}</div><h3>${s.name}</h3><p>${s.desc}</p>
    </article>`).join("");
  document.getElementById("serviceSelect").innerHTML =
    '<option value="">Choose a service</option>' +
    services.map(s => `<option>${s.name}</option>`).join("");
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
    document.body.classList.toggle("auth-mode", id === "auth");
  window.scrollTo({top:0, behavior:"smooth"});
  if (id === "requests") renderRequests();
  if (id === "technician-dashboard") renderTechnicianJobs();
  if (id === "techHome") renderTechHome();
}

let currentRole = null;
let technicianRecord = null;

async function routeAfterAuth() {
  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  document.body.classList.remove("role-customer", "role-technician");

  if (authError || !user) {
    currentRole = null;
    technicianRecord = null;
    showView("auth");
    return;
  }

  const { data: tech } = await supabaseClient
    .from("technicians")
    .select("id, rating, jobs_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  technicianRecord = tech || null;
  currentRole = tech ? "technician" : "customer";
  document.body.classList.add(currentRole === "technician" ? "role-technician" : "role-customer");

  showView(currentRole === "technician" ? "techHome" : "home");
}

async function checkAuth() {
  await routeAfterAuth();
}

checkAuth();


document.addEventListener("click", e => {
  const navBtn = e.target.closest("[data-view]");
  if (navBtn) {
    showView(navBtn.dataset.view);
    return;
  }

  const jobBtn = e.target.closest("[data-job-action]");
  if (jobBtn) handleJobAction(jobBtn);
});

const STATUS_LABELS = {
  requested: "Requested",
  matched: "Matched",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  technician_completed: "Awaiting confirmation",
  completed: "Completed"
};

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

const JOB_TRANSITIONS = {
  start: {
    from: "confirmed",
    to: "in_progress",
    actor: "technician",
    success: "Job started."
  },
  finish: {
    from: "in_progress",
    to: "technician_completed",
    actor: "technician",
    success: "Marked as complete. Waiting for the customer to confirm."
  },
  "confirm-completion": {
    from: "technician_completed",
    to: "completed",
    actor: "customer",
    success: "Completion confirmed. Job closed."
  }
};

async function currentTechnicianId(userId) {
  if (technicianRecord) return technicianRecord.id;

  const { data } = await supabaseClient
    .from("technicians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return data ? data.id : null;
}

// The `.eq("status", from)` guard makes each transition happen at most once,
// so a double-click or a second tab cannot advance the same job twice.
async function handleJobAction(btn) {
  const transition = JOB_TRANSITIONS[btn.dataset.jobAction];
  const jobId = btn.dataset.jobId;

  if (!transition || !jobId || btn.disabled) return;

  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Please log in again.");
    showView("auth");
    return;
  }

  const technicianId = transition.actor === "technician"
    ? await currentTechnicianId(user.id)
    : null;

  if (transition.actor === "technician" && !technicianId) {
    showToast("Technician profile not found.");
    return;
  }

  btn.disabled = true;

  try {
    const { data: updated, error } = await supabaseClient
      .from("jobs")
      .update({ status: transition.to })
      .eq("id", jobId)
      .eq("status", transition.from)
      .eq(transition.actor === "technician" ? "technician_id" : "customer_id",
          transition.actor === "technician" ? technicianId : user.id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Job status update error:", error);
      showToast("We couldn't update this job.");
      return;
    }

    if (!updated) {
      await explainUnchangedJob(jobId, transition);
      return;
    }

    showToast(transition.success);
  } finally {
    btn.disabled = false;
  }

  await refreshJobViews();
}

// An update that matched zero rows is either a repeat submission (the job moved
// on without us) or a write RLS rejected. Distinguish so the toast is truthful.
async function explainUnchangedJob(jobId, transition) {
  const { data: current } = await supabaseClient
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (current && current.status === transition.from) {
    showToast("Your account isn't allowed to update this job.");
  } else {
    showToast("This job has already been updated.");
  }

  await refreshJobViews();
}

async function refreshJobViews() {
  if (currentRole === "technician") {
    await renderTechnicianJobs();
    await renderTechHome();
    return;
  }

  await renderRequests();
}

function jobActionMarkup(job, role) {
  const id = escapeHtml(job.id);

  if (role === "technician") {
    if (job.status === "confirmed") {
      return `
      <div class="job-actions">
        <p class="job-note">Ready to start.</p>
        <button class="primary small" data-job-action="start" data-job-id="${id}">Start Job</button>
      </div>`;
    }
    if (job.status === "in_progress") {
      return `
      <div class="job-actions">
        <p class="job-note">Work is in progress.</p>
        <button class="primary small" data-job-action="finish" data-job-id="${id}">Mark Work Completed</button>
      </div>`;
    }
    if (job.status === "technician_completed") {
      return `<div class="job-actions"><p class="job-note">Awaiting customer confirmation.</p></div>`;
    }
    if (job.status === "completed") {
      return `<div class="job-actions"><p class="job-note">Customer confirmed — job closed.</p></div>`;
    }
    return "";
  }

  if (job.status === "in_progress") {
    return `<div class="job-actions"><p class="job-note">Your technician is working on this.</p></div>`;
  }
  if (job.status === "technician_completed") {
    return `
      <div class="job-actions">
        <p class="job-note">The technician marked this work as complete.</p>
        <button class="primary small" data-job-action="confirm-completion" data-job-id="${id}">Confirm Completion</button>
      </div>`;
  }
  if (job.status === "completed") {
    return `<div class="job-actions"><p class="job-note">Completed.</p></div>`;
  }
  return "";
}

async function renderTechHome() {
  const headline = document.getElementById("techStatsHeadline");
  const sub = document.getElementById("techStatsSub");

  if (!headline || !sub) return;

  if (!technicianRecord) {
    headline.textContent = "Technician profile not found";
    sub.textContent = "Contact support to finish setting up your account.";
    return;
  }

  const { data: jobs, error } = await supabaseClient
    .from("jobs")
    .select("status")
    .eq("technician_id", technicianRecord.id);

  if (error) {
    console.error("Error loading technician stats:", error);
    headline.textContent = `${technicianRecord.rating ?? "—"} rating`;
    sub.textContent = "Assigned Jobs will appear once loaded.";
    return;
  }

  const active = jobs.filter(j => j.status === "confirmed" || j.status === "in_progress").length;
  const awaiting = jobs.filter(j => j.status === "technician_completed").length;
  const completed = jobs.filter(j => j.status === "completed").length;

  // jobs_completed is a stored baseline; jobs closed through the app are
  // counted here so the total stays correct without writing to `technicians`.
  const jobsDone = (technicianRecord.jobs_completed ?? 0) + completed;

  headline.textContent = `${technicianRecord.rating ?? "—"} rating · ${jobsDone} jobs done`;
  sub.textContent = [
    `${active} active job${active === 1 ? "" : "s"} waiting on you.`,
    awaiting > 0 ? `${awaiting} awaiting customer confirmation.` : ""
  ].filter(Boolean).join(" ");
}

function startRequest(service) {
  showView("request");
  document.getElementById("serviceSelect").value = service;
}

document.getElementById("requestForm").addEventListener("submit", async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(e.target).entries());

  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Please log in before making a request.");
    showView("auth");
    return;
  }

  const { data: job, error } = await supabaseClient
    .from("jobs")
    .insert({
      customer_id: user.id,
      service: data.service,
      description: data.description,
      location: data.location,
      status: "requested"
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    showToast("We couldn't submit your request.");
    return;
  }

  const { data: tech, error: techError } = await supabaseClient
  .from("technicians")
  .select(`
    id,
    skills,
    service_areas,
    available,
    rating,
    jobs_completed,
    users (
      full_name
    )
  `)
  .contains("skills", [data.service])
  .eq("available", true)
  .order("rating", { ascending: false })
  .limit(1)
  .single();

if (techError || !tech) {
  console.error("Technician matching error:", techError);

  showToast("No available technician found for this service.");
  return;
}

const technician = {
  id: tech.id,
  name: tech.users.full_name,
  rating: tech.rating,
  jobs: tech.jobs_completed,
  initials: tech.users.full_name
    .split(" ")
    .map(name => name[0])
    .join("")
    .slice(0, 2)
};

const { error: matchError } = await supabaseClient
  .from("jobs")
  .update({
    technician_id: tech.id,
    status: "matched"
  })
  .eq("id", job.id)
  .eq("customer_id", user.id);

if (matchError) {
  console.error("Error saving technician match:", matchError);
  showToast("Technician found, but we couldn't save the match.");
  return;
}

const request = {
  id: job.id,
  ...data,
  technician,
  status: "Request submitted",
  created: new Date(job.created_at).toLocaleString()
};

  requests.unshift(request);
  localStorage.setItem("fixmate_requests", JSON.stringify(requests));

  renderMatch(request);
  showView("match");
});

function renderMatch(r) {
  document.getElementById("matchCard").innerHTML = `
    <div class="technician">
      <div class="avatar">${r.technician.initials}</div>
      <div><div class="tech-name">${r.technician.name}</div><div class="verified">✓ Verified technician · ${r.technician.rating} rating · ${r.technician.jobs} jobs</div></div>
    </div>
    <div class="job-details">
      <div class="detail"><small>Service</small><strong>${r.service}</strong></div>
      <div class="detail"><small>Location</small><strong>${escapeHtml(r.location)}</strong></div>
      <div class="detail"><small>Timing</small><strong>${r.timing}</strong></div>
      <div class="detail"><small>Request ID</small><strong>${r.id}</strong></div>
    </div>
    <p><strong>Your description</strong><br>${escapeHtml(r.description)}</p>
    <button class="primary full" onclick="confirmJob('${r.id}')">Confirm Request</button>
  `;
}

async function confirmJob(id) {
  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Please log in again.");
    showView("auth");
    return;
  }

  const { data: job, error } = await supabaseClient
    .from("jobs")
    .update({
      status: "confirmed"
    })
    .eq("id", id)
    .eq("customer_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error confirming request:", error);
    showToast("We couldn't confirm your request.");
    return;
  }

  showToast("Request confirmed.");

  await renderRequests();
  showView("requests");
}

async function renderRequests() {
  const el = document.getElementById("requestList");

  if (!el) return;

  el.innerHTML = `<div class="empty"><p>Loading your requests...</p></div>`;

  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    el.innerHTML = `<div class="empty"><h3>Please sign in.</h3></div>`;
    return;
  }

  const { data: jobs, error } = await supabaseClient
    .from("jobs")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading jobs:", error);
    el.innerHTML = `<div class="empty"><h3>We couldn't load your requests.</h3></div>`;
    return;
  }

  if (!jobs || jobs.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <h3>No requests yet.</h3>
        <p>Your FixMate jobs will appear here after you make a request.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = jobs.map(job => `
    <article class="request-item">
      <div class="request-top">
        <div>
          <strong>${escapeHtml(job.service)}</strong><br>
          <small>${job.id}</small>
        </div>
        <span class="badge">${escapeHtml(statusLabel(job.status))}</span>
      </div>

      <p>${escapeHtml(job.description || "No description provided.")}</p>

      <div>
        <small>Location: <strong>${escapeHtml(job.location)}</strong></small>
      </div>

      <div>
        <small>
          Submitted:
          <strong>${new Date(job.created_at).toLocaleString()}</strong>
        </small>
      </div>
      ${jobActionMarkup(job, "customer")}
    </article>
  `).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[c]));
}

function showToast(message) {
  const t = document.getElementById("toast");

  if (!t) return;

  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2600);
}

async function renderTechnicianJobs() {
  const el = document.getElementById("technicianJobs");

  if (!el) return;

  el.innerHTML = `
    <div class="empty">
      <p>Loading your jobs...</p>
    </div>
  `;

  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    el.innerHTML = `
      <div class="empty">
        <h3>Please sign in.</h3>
      </div>
    `;
    return;
  }

  const { data: technician, error: technicianError } = await supabaseClient
    .from("technicians")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (technicianError || !technician) {
    el.innerHTML = `
      <div class="empty">
        <h3>Technician profile not found.</h3>
      </div>
    `;
    return;
  }

  const { data: jobs, error: jobsError } = await supabaseClient
    .from("jobs")
    .select("*")
    .eq("technician_id", technician.id)
    .order("created_at", { ascending: false });

  if (jobsError) {
    console.error("Error loading technician jobs:", jobsError);

    el.innerHTML = `
      <div class="empty">
        <h3>We couldn't load your jobs.</h3>
      </div>
    `;
    return;
  }

  if (!jobs || jobs.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <h3>No assigned jobs yet.</h3>
        <p>New FixMate jobs assigned to you will appear here.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = jobs.map(job => `
    <article class="request-item">
      <div class="request-top">
        <div>
          <strong>${escapeHtml(job.service)}</strong><br>
          <small>${job.id}</small>
        </div>

        <span class="badge">
          ${escapeHtml(statusLabel(job.status))}
        </span>
      </div>

      <p>${escapeHtml(job.description || "No description provided.")}</p>

      <div>
        <small>
          Location:
          <strong>${escapeHtml(job.location)}</strong>
        </small>
      </div>

      <div>
        <small>
          Submitted:
          <strong>${new Date(job.created_at).toLocaleString()}</strong>
        </small>
      </div>
      ${jobActionMarkup(job, "technician")}
    </article>
  `).join("");
}

document.querySelectorAll("#logoutBtn, #logoutBtnMobile").forEach(btn => {
  btn.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      showToast("Couldn't log out.");
      return;
    }

    currentRole = null;
    technicianRecord = null;
    document.body.classList.remove("role-customer", "role-technician");
    showView("auth");
    showToast("You have been logged out.");
  });
});

renderServices();
renderRequests();
renderTechnicianJobs();
