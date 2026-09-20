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

  message.textContent = "You are now signed in.";
  showView("home");
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
}
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    showView("home");
  } else {
    showView("auth");
  }
}

checkAuth();


document.addEventListener("click", e => {
  const btn = e.target.closest("[data-view]");
  if (btn) showView(btn.dataset.view);
});

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

  const tech = technicians[data.service] || technicians["General Handyman"];

  const request = {
    id: job.id,
    ...data,
    technician: tech,
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

function confirmJob(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  r.status = "Confirmed";
  localStorage.setItem("fixmate_requests", JSON.stringify(requests));
  showToast("Request confirmed.");
  renderRequests();
  showView("requests");
}

function renderRequests() {
  const el = document.getElementById("requestList");
  if (!requests.length) {
    el.innerHTML = `<div class="empty"><h3>No requests yet.</h3><p>Your FixMate jobs will appear here after you make a request.</p><button class="primary" data-view="request">Request a Fix</button></div>`;
    return;
  }
  el.innerHTML = requests.map(r => `
    <article class="request-item">
      <div class="request-top"><div><strong>${r.service}</strong><br><small>${r.id} · ${r.created}</small></div><span class="badge">${r.status}</span></div>
      <p>${escapeHtml(r.description)}</p>
      <div><small>Technician: <strong>${r.technician.name}</strong></small></div>
    </article>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function showToast(message) {
  const t = document.getElementById("toast");
  t.textContent = message; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

renderServices();
renderRequests();
