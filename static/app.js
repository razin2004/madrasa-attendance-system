// Global State
let currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
let systemInfo = { client_ip: '127.0.0.1', allowed_wifi_ip: '127.0.0.1' };

// Ultra-Premium Glassmorphic Toast Notification System
window.showToast = function(title, type = 'info') {
    let container = document.getElementById('masjidToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'masjidToastContainer';
        container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full max-w-md px-4';
        document.body.appendChild(container);
    }

    const toastId = 'toast_' + Date.now();
    const typeConfigs = {
        success: {
            border: 'border-emerald-500/50 shadow-emerald-950/60',
            bgBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            icon: 'check-circle',
            barBg: 'bg-gradient-to-r from-emerald-500 to-teal-400',
            glow: 'rgba(16, 185, 129, 0.35)',
            text: 'text-white'
        },
        error: {
            border: 'border-rose-500/50 shadow-rose-950/60',
            bgBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            icon: 'alert-circle',
            barBg: 'bg-gradient-to-r from-rose-500 to-red-400',
            glow: 'rgba(244, 63, 94, 0.35)',
            text: 'text-white'
        },
        warning: {
            border: 'border-amber-500/50 shadow-amber-950/60',
            bgBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            icon: 'alert-triangle',
            barBg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
            glow: 'rgba(245, 158, 11, 0.35)',
            text: 'text-white'
        },
        info: {
            border: 'border-blue-500/50 shadow-blue-950/60',
            bgBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
            icon: 'info',
            barBg: 'bg-gradient-to-r from-blue-500 to-indigo-400',
            glow: 'rgba(59, 130, 246, 0.35)',
            text: 'text-white'
        }
    };

    const config = typeConfigs[type] || typeConfigs.info;

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `pointer-events-auto w-full max-w-sm rounded-2xl bg-slate-950/95 backdrop-blur-2xl border ${config.border} p-3.5 shadow-2xl transition-all duration-300 transform -translate-y-4 opacity-0 scale-95 flex flex-col gap-2 relative overflow-hidden`;
    toast.style.boxShadow = `0 12px 35px -5px ${config.glow}, 0 0 1px 1px rgba(255,255,255,0.08)`;

    toast.innerHTML = `
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl ${config.bgBadge} border flex items-center justify-center flex-shrink-0 shadow-inner">
                    <i data-lucide="${config.icon}" class="w-4 h-4"></i>
                </div>
                <div class="text-xs font-semibold ${config.text} leading-snug tracking-wide pr-2">
                    ${title}
                </div>
            </div>
            <button type="button" onclick="this.closest('.pointer-events-auto').remove()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition flex-shrink-0">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
        </div>
        <div class="w-full bg-slate-800/40 h-1 rounded-full overflow-hidden">
            <div class="h-full ${config.barBg} transition-all duration-[3500ms] ease-linear w-full" id="${toastId}_bar"></div>
        </div>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    // Trigger smooth enter animation
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-4', 'opacity-0', 'scale-95');
        toast.classList.add('translate-y-0', 'opacity-100', 'scale-100');
        const bar = document.getElementById(`${toastId}_bar`);
        if (bar) {
            setTimeout(() => { bar.style.width = '0%'; }, 50);
        }
    });

    // Auto remove after 3.8s with fade-out
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
            toast.classList.add('-translate-y-4', 'opacity-0', 'scale-95');
            setTimeout(() => {
                if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }
    }, 3800);
};

// SweetAlert2 Confirmation Modal Helper (Unified Islamic Dark Glass Theme)
async function confirmAction(title, text, confirmButtonText = 'Yes, Proceed') {
    if (window.Swal) {
        const result = await Swal.fire({
            title: title,
            text: text,
            icon: 'question',
            background: '#070d1e',
            color: '#f8fafc',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#334155',
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            backdrop: 'rgba(7, 13, 30, 0.75)',
            customClass: {
                popup: 'rounded-3xl border border-blue-800/50 shadow-2xl p-6',
                title: 'text-base sm:text-lg font-bold text-white tracking-wide',
                htmlContainer: 'text-xs sm:text-sm text-slate-300',
                confirmButton: 'rounded-xl px-4 py-2 font-bold text-xs shadow-lg transition active:scale-95',
                cancelButton: 'rounded-xl px-4 py-2 font-semibold text-xs shadow transition active:scale-95'
            }
        });
        return result.isConfirmed;
    }
    return confirm(`${title}\n${text}`);
}

// 1-Click Credential Preset Helper
window.fillCredentials = function(username, password, role) {
    const loginUsernameInput = document.getElementById('loginUsernameInput');
    const loginPasswordInput = document.getElementById('loginPasswordInput');
    const toggleUstadhRole = document.getElementById('toggleUstadhRole');
    const toggleAdminRole = document.getElementById('toggleAdminRole');
    const toggleSuperAdminRole = document.getElementById('toggleSuperAdminRole');

    if (loginUsernameInput) loginUsernameInput.value = username;
    if (loginPasswordInput) loginPasswordInput.value = password;
    if (role === 'SUPER_ADMIN' && toggleSuperAdminRole) toggleSuperAdminRole.click();
    if (role === 'ADMIN' && toggleAdminRole) toggleAdminRole.click();
    if (role === 'USTADH' && toggleUstadhRole) toggleUstadhRole.click();

    showToast(`Loaded ${role.replace('_', ' ')} credentials preset`, "info");
};

// Simulated Time Helper
window.setSimulatedTime = function(timeStr) {
    const overrideTimePicker = document.getElementById('overrideTimePicker');
    if (!overrideTimePicker) return;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    overrideTimePicker.value = `${dateStr}T${timeStr}`;
};

// Device Key Generator & Retriever Helper
window.getOrCreateDeviceKey = function() {
    let key = localStorage.getItem('device_key');
    if (!key) {
        key = "USTADH-DEV-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_key', key);
    }
    return key;
};

// Generic Logout Handler with Confirmation
window.handleLogout = async function() {
    const confirmed = await confirmAction("Confirm Sign Out", "Are you sure you want to sign out of your session?", "Yes, Sign Out");
    if (confirmed) {
        sessionStorage.clear();
        showToast("Signed out successfully.", "info");
        setTimeout(() => {
            window.location.href = "/login";
        }, 500);
    }
};

window.confirmAndLogout = window.handleLogout;

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Digital Clock & Date
    const liveClockEl = document.getElementById('liveClock');
    const liveDateEl = document.getElementById('liveDate');
    function updateClock() {
        if (!liveClockEl || !liveDateEl) return;
        const now = new Date();
        liveClockEl.textContent = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
        liveDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 2. Unified Login Elements
    const unifiedLoginForm = document.getElementById('unifiedLoginForm');
    const selectedRoleInput = document.getElementById('selectedRoleInput');
    const toggleUstadhRole = document.getElementById('toggleUstadhRole');
    const toggleAdminRole = document.getElementById('toggleAdminRole');
    const toggleSuperAdminRole = document.getElementById('toggleSuperAdminRole');
    const loginUsernameInput = document.getElementById('loginUsernameInput');
    const loginPasswordInput = document.getElementById('loginPasswordInput');
    const roleSubtitle = document.getElementById('roleSubtitle');
    const btnTogglePassword = document.getElementById('btnTogglePassword');
    const pwdToggleText = document.getElementById('pwdToggleText');

    if (toggleUstadhRole && toggleAdminRole && toggleSuperAdminRole) {
        toggleUstadhRole.addEventListener('click', () => {
            if (selectedRoleInput) selectedRoleInput.value = "USTADH";
            toggleUstadhRole.className = "py-2.5 rounded-xl transition-all duration-200 bg-blue-600 text-white shadow flex items-center justify-center gap-1";
            toggleAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            toggleSuperAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            if (roleSubtitle) roleSubtitle.textContent = "Sign in to access your Ustadh Mobile Portal";
            if (loginUsernameInput) loginUsernameInput.placeholder = "e.g. ustadh_bilal";
        });

        toggleAdminRole.addEventListener('click', () => {
            if (selectedRoleInput) selectedRoleInput.value = "ADMIN";
            toggleAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 bg-blue-600 text-white shadow flex items-center justify-center gap-1";
            toggleUstadhRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            toggleSuperAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            if (roleSubtitle) roleSubtitle.textContent = "Sign in to access Principal Admin Console";
            if (loginUsernameInput) loginUsernameInput.placeholder = "e.g. admin";
        });

        toggleSuperAdminRole.addEventListener('click', () => {
            if (selectedRoleInput) selectedRoleInput.value = "SUPER_ADMIN";
            toggleSuperAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 bg-amber-600 text-white shadow flex items-center justify-center gap-1";
            toggleUstadhRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            toggleAdminRole.className = "py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-1";
            if (roleSubtitle) roleSubtitle.textContent = "Sign in to Masjid Management Super Admin Console";
            if (loginUsernameInput) loginUsernameInput.placeholder = "e.g. superadmin";
        });
    }

    if (btnTogglePassword && loginPasswordInput) {
        btnTogglePassword.addEventListener('click', () => {
            if (loginPasswordInput.type === 'password') {
                loginPasswordInput.type = 'text';
                if (pwdToggleText) pwdToggleText.textContent = 'Hide';
            } else {
                loginPasswordInput.type = 'password';
                if (pwdToggleText) pwdToggleText.textContent = 'Show';
            }
        });
    }

    if (unifiedLoginForm) {
        unifiedLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginUsernameInput ? loginUsernameInput.value.trim() : '';
            const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';
            const localDeviceKey = localStorage.getItem('device_key');

            if (!username || !password) {
                showToast("Please enter both username and password", "warning");
                return;
            }

            showToast("Authenticating credentials...", "info");

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        device_key: localDeviceKey
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.detail || "Sign in failed", "error");
                    return;
                }

                currentUser = data.user;
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

                // Silent device key storage for Ustadh role
                if (data.role === 'USTADH' && currentUser.device_key) {
                    localStorage.setItem('device_key', currentUser.device_key);
                }

                showToast(data.message, "success");

                // Role-based redirect
                setTimeout(() => {
                    window.location.href = data.redirect_url;
                }, 600);

            } catch (err) {
                showToast("Network error during sign in.", "error");
            }
        });
    }

    // Logout Button Bindings
    const btnSuperAdminLogout = document.getElementById('btnSuperAdminLogout');
    const btnAdminLogout = document.getElementById('btnAdminLogout');
    const btnUstadhLogout = document.getElementById('btnUstadhLogout');
    if (btnSuperAdminLogout) btnSuperAdminLogout.addEventListener('click', window.handleLogout);
    if (btnAdminLogout) btnAdminLogout.addEventListener('click', window.handleLogout);
    if (btnUstadhLogout) btnUstadhLogout.addEventListener('click', window.handleLogout);

    // ===================================================================
    // 3. SUPER ADMIN DASHBOARD LOGIC (MULTI-IP & ADMINS)
    // ===================================================================
    const allowedIpsTableBody = document.getElementById('allowedIpsTableBody');
    const totalAllowedIpsBadge = document.getElementById('totalAllowedIpsBadge');
    const addIpForm = document.getElementById('addIpForm');
    const newIpAddressInput = document.getElementById('newIpAddressInput');
    const newIpDescriptionInput = document.getElementById('newIpDescriptionInput');

    const createAdminForm = document.getElementById('createAdminForm');
    const newAdminFullName = document.getElementById('newAdminFullName');
    const newAdminUsername = document.getElementById('newAdminUsername');
    const newAdminPassword = document.getElementById('newAdminPassword');
    const adminsTableBody = document.getElementById('adminsTableBody');
    const btnRefreshAdmins = document.getElementById('btnRefreshAdmins');
    const btnRefreshMasterAudit = document.getElementById('btnRefreshMasterAudit');

    if (window.location.pathname.includes('/superadmin') || allowedIpsTableBody) {
        loadSuperAdminAllowedIps();
        loadSuperAdminAdminsList();
        loadSuperAdminMasterAudit();
    }

    async function loadSuperAdminAllowedIps() {
        if (!allowedIpsTableBody) return;
        try {
            const res = await fetch('/api/superadmin/ips');
            if (!res.ok) return;
            const ips = await res.json();

            if (totalAllowedIpsBadge) {
                totalAllowedIpsBadge.textContent = `${ips.length} Active IP(s)`;
            }

            if (ips.length === 0) {
                allowedIpsTableBody.innerHTML = `<tr><td colspan="3" class="py-3 text-center text-slate-500 italic">No whitelisted IPs.</td></tr>`;
                return;
            }

            allowedIpsTableBody.innerHTML = ips.map(ip => `
                <tr class="hover:bg-slate-900/50 transition">
                    <td class="py-2.5 px-3 font-mono font-bold text-emerald-400">${ip.ip_address}</td>
                    <td class="py-2.5 px-3 text-slate-300">${ip.description}</td>
                    <td class="py-2.5 px-3 text-right">
                        <button onclick="superAdminDeleteIp(${ip.id})" class="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/40 rounded text-[10px] font-medium transition">
                            Delete
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (e) {
            console.error("Error loading allowed IPs", e);
        }
    }

    if (addIpForm) {
        addIpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ipStr = newIpAddressInput ? newIpAddressInput.value.trim() : '';
            const desc = newIpDescriptionInput ? newIpDescriptionInput.value.trim() : '';

            if (!ipStr) {
                showToast("Please enter an IP address", "warning");
                return;
            }

            showToast("Whitelisting IP address...", "info");

            try {
                const res = await fetch('/api/superadmin/ips/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: ipStr, description: desc || "Madrasa WiFi Network" })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message, "success");
                    addIpForm.reset();
                    loadSuperAdminAllowedIps();
                } else {
                    showToast(data.detail || "Failed to add IP", "error");
                }
            } catch (err) {
                showToast("Network error adding IP", "error");
            }
        });
    }

    window.superAdminDeleteIp = async function(ipId) {
        const confirmed = await confirmAction("Remove Whitelisted IP", "Are you sure you want to remove this IP from authorized networks?", "Yes, Remove");
        if (confirmed) {
            try {
                const res = await fetch(`/api/superadmin/ips/${ipId}`, { method: 'DELETE' });
                const data = await res.json();
                showToast(data.message, "info");
                loadSuperAdminAllowedIps();
            } catch (e) {
                showToast("Error deleting IP", "error");
            }
        }
    };

    async function loadSuperAdminAdminsList() {
        if (!adminsTableBody) return;
        try {
            const res = await fetch('/api/superadmin/admins');
            if (!res.ok) return;
            const admins = await res.json();

            if (admins.length === 0) {
                adminsTableBody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-slate-500 italic">No Admin accounts provisioned.</td></tr>`;
                return;
            }

            adminsTableBody.innerHTML = admins.map(a => {
                const statusBadge = a.is_active
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Blocked</span>`;

                const btnText = a.is_active ? "Block Admin" : "Activate";
                const btnColor = a.is_active ? "bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-800/60" : "bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800/60";

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-2 px-3 font-semibold text-white">${a.full_name}</td>
                        <td class="py-2 px-3 font-mono text-slate-300">${a.username}</td>
                        <td class="py-2 px-3">${statusBadge}</td>
                        <td class="py-2 px-3">
                            <button onclick="superAdminToggleBlock(${a.id})" class="px-2 py-1 ${btnColor} border rounded text-[11px] font-medium transition">
                                ${btnText}
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error loading admins", e);
        }
    }

    if (createAdminForm) {
        createAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = newAdminFullName.value.trim();
            const username = newAdminUsername.value.trim();
            const password = newAdminPassword.value.trim();

            showToast("Creating Admin account...", "info");

            try {
                const res = await fetch('/api/superadmin/admins/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_name: fullName, username: username, password: password })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message, "success");
                    createAdminForm.reset();
                    loadSuperAdminAdminsList();
                } else {
                    showToast(data.detail || "Failed to create Admin", "error");
                }
            } catch (err) {
                showToast("Network error creating Admin", "error");
            }
        });
    }

    window.superAdminToggleBlock = async function(adminId) {
        const confirmed = await confirmAction("Toggle Admin Status", "Are you sure you want to change this Admin's access status?", "Confirm");
        if (confirmed) {
            try {
                const res = await fetch('/api/superadmin/admins/toggle-block', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_id: adminId })
                });
                const data = await res.json();
                showToast(data.message, "info");
                loadSuperAdminAdminsList();
            } catch (e) {
                showToast("Error updating Admin status", "error");
            }
        }
    };

    if (btnRefreshAdmins) btnRefreshAdmins.addEventListener('click', loadSuperAdminAdminsList);

    // Master View-Only Audit
    const totalUstadhCount = document.getElementById('totalUstadhCount');
    const totalLeaveCount = document.getElementById('totalLeaveCount');
    const totalAttendanceCount = document.getElementById('totalAttendanceCount');
    const auditUstadhsTableBody = document.getElementById('auditUstadhsTableBody');
    const auditLeavesTableBody = document.getElementById('auditLeavesTableBody');
    const auditAttendanceTableBody = document.getElementById('auditAttendanceTableBody');

    async function loadSuperAdminMasterAudit() {
        if (!auditUstadhsTableBody) return;
        try {
            const res = await fetch('/api/superadmin/audit/all');
            if (!res.ok) return;
            const data = await res.json();

            if (totalUstadhCount) totalUstadhCount.textContent = data.total_ustadhs;
            if (totalLeaveCount) totalLeaveCount.textContent = data.total_leave_requests;
            if (totalAttendanceCount) totalAttendanceCount.textContent = data.total_attendance_records;

            auditUstadhsTableBody.innerHTML = data.ustadhs.length ? data.ustadhs.map(u => `
                <tr class="hover:bg-slate-900/50">
                    <td class="py-2 px-3 font-semibold text-white">${u.full_name}</td>
                    <td class="py-2 px-3 font-mono text-slate-300">${u.username}</td>
                    <td class="py-2 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">${u.device_count} Device(s)</span></td>
                </tr>
            `).join('') : `<tr><td colspan="3" class="py-3 text-center text-slate-500 italic">No Ustadh profiles found.</td></tr>`;

            auditLeavesTableBody.innerHTML = data.leaves.length ? data.leaves.map(l => {
                const statusBadge = l.status === 'APPROVED' 
                    ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">Approved</span>`
                    : (l.status === 'REJECTED' 
                        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">Declined</span>`
                        : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Pending</span>`);

                return `
                    <tr class="hover:bg-slate-900/50">
                        <td class="py-2 px-3 font-semibold text-white">${l.ustadh_name}</td>
                        <td class="py-2 px-3 font-mono text-slate-300">${l.start_date} to ${l.end_date}</td>
                        <td class="py-2 px-3 text-slate-300">${l.reason}</td>
                        <td class="py-2 px-3">${statusBadge}</td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="4" class="py-3 text-center text-slate-500 italic">No leave applications.</td></tr>`;

            auditAttendanceTableBody.innerHTML = data.attendance_logs.length ? data.attendance_logs.map(a => {
                const clockInStr = new Date(a.clock_in).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                const clockOutStr = a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

                const lateBadge = a.is_late 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">Late (+${a.late_minutes}m)</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">On Time</span>`;

                const earlyBadge = a.clock_out 
                    ? (a.is_early 
                        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">Early (-${a.early_minutes}m)</span>`
                        : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">Full Shift</span>`)
                    : `<span class="text-slate-500">Active</span>`;

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-2.5 px-3 font-semibold text-white">${a.ustadh_name}</td>
                        <td class="py-2.5 px-3 font-mono">${clockInStr}</td>
                        <td class="py-2.5 px-3">${lateBadge}</td>
                        <td class="py-2.5 px-3 font-mono">${clockOutStr}</td>
                        <td class="py-2.5 px-3">${earlyBadge}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-400">${a.ip}</td>
                        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">${a.status}</span></td>
                    </tr>
                `;
            }).join('') : `<tr><td colspan="7" class="py-4 text-center text-slate-500 italic">No attendance records today.</td></tr>`;

        } catch (e) {
            console.error("Error loading master audit", e);
        }
    }

    if (btnRefreshMasterAudit) btnRefreshMasterAudit.addEventListener('click', loadSuperAdminMasterAudit);

    // ===================================================================
    // 4. ADMIN (PRINCIPAL) DASHBOARD LOGIC
    // ===================================================================
    const createUstadhForm = document.getElementById('createUstadhForm');
    const newUstadhFullName = document.getElementById('newUstadhFullName');
    const newUstadhUsername = document.getElementById('newUstadhUsername');
    const newUstadhPassword = document.getElementById('newUstadhPassword');
    const newUstadhShift = document.getElementById('newUstadhShift');
    const adminUstadhTableBody = document.getElementById('adminUstadhTableBody');
    const btnRefreshUstadhs = document.getElementById('btnRefreshUstadhs');
    const adminLeavesTableBody = document.getElementById('adminLeavesTableBody');
    const btnRefreshLeaves = document.getElementById('btnRefreshLeaves');
    const adminAttendanceTableBody = document.getElementById('adminAttendanceTableBody');
    const btnRefreshAttendance = document.getElementById('btnRefreshAttendance');

    if (window.location.pathname.includes('/admin') || adminUstadhTableBody) {
        loadAdminUstadhsList();
        loadAdminLeavesList();
        loadAdminAttendanceSheet();
    }

    if (createUstadhForm) {
        createUstadhForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = newUstadhFullName.value.trim();
            const username = newUstadhUsername.value.trim();
            const password = newUstadhPassword.value.trim();
            const shiftId = parseInt(newUstadhShift.value);

            showToast("Provisioning Ustadh account...", "info");

            try {
                const res = await fetch('/api/admin/ustadhs/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_name: fullName, username: username, password: password, shift_id: shiftId })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message, "success");
                    createUstadhForm.reset();
                    loadAdminUstadhsList();
                } else {
                    showToast(data.detail || "Failed to create Ustadh", "error");
                }
            } catch (err) {
                showToast("Network error creating Ustadh", "error");
            }
        });
    }

    async function loadAdminUstadhsList() {
        if (!adminUstadhTableBody) return;
        try {
            const res = await fetch('/api/admin/ustadhs');
            if (!res.ok) return;
            const ustadhs = await res.json();

            if (ustadhs.length === 0) {
                adminUstadhTableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500 italic">No Ustadh profiles provisioned yet.</td></tr>`;
                return;
            }

            adminUstadhTableBody.innerHTML = ustadhs.map(u => {
                const deviceCountBadge = u.registered_device_count > 0
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">${u.registered_device_count} Device(s) Registered</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">0 Devices (1st Login Pending)</span>`;

                const multiDeviceBadge = u.can_add_device
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">2nd Device Authorized</span>`
                    : `<span class="text-slate-500 text-[11px]">Standard Device Mode</span>`;

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-2.5 px-3 font-semibold text-white">${u.full_name}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-300">${u.username}</td>
                        <td class="py-2.5 px-3">${deviceCountBadge}</td>
                        <td class="py-2.5 px-3">${multiDeviceBadge}</td>
                        <td class="py-2.5 px-3 flex items-center gap-1.5">
                            <button onclick="adminResetUstadhDevice('${u.username}')" class="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded text-[11px] font-medium transition">
                                Reset Phone
                            </button>
                            <button onclick="adminAllowAdditionalDevice('${u.username}')" class="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded text-[11px] font-medium transition">
                                + Add Phone
                            </button>
                            <button onclick="adminDeleteUstadh(${u.id}, '${u.full_name}')" class="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-[11px] font-medium transition">
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error loading Ustadhs", e);
        }
    }

    window.adminResetUstadhDevice = async function(username) {
        const confirmed = await confirmAction("Reset Device Bindings", `Are you sure you want to clear registered devices for '${username}'? Next login will pair to their new phone.`, "Yes, Reset");
        if (confirmed) {
            try {
                const res = await fetch('/api/admin/ustadhs/reset-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username })
                });
                const data = await res.json();
                showToast(data.message, "info");
                loadAdminUstadhsList();
            } catch (e) {
                showToast("Failed to reset device", "error");
            }
        }
    };

    window.adminAllowAdditionalDevice = async function(username) {
        const confirmed = await confirmAction("Authorize Secondary Device", `Are you sure you want to authorize Ustadh '${username}' to pair a 2nd device on their next clock-in?`, "Yes, Authorize");
        if (confirmed) {
            try {
                const res = await fetch('/api/admin/ustadhs/allow-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username })
                });
                const data = await res.json();
                showToast(data.message, "success");
                loadAdminUstadhsList();
            } catch (e) {
                showToast("Failed to authorize device", "error");
            }
        }
    };

    window.adminDeleteUstadh = async function(ustadhId, fullName) {
        const confirmed = await confirmAction("Confirm Deletion", `Are you sure you want to delete the Ustadh profile for '${fullName}'?`, "Yes, Delete");
        if (confirmed) {
            try {
                const res = await fetch(`/api/admin/ustadhs/${ustadhId}`, { method: 'DELETE' });
                const data = await res.json();
                showToast(data.message, "info");
                loadAdminUstadhsList();
            } catch (e) {
                showToast("Failed to delete Ustadh profile", "error");
            }
        }
    };

    if (btnRefreshUstadhs) btnRefreshUstadhs.addEventListener('click', loadAdminUstadhsList);

    // Leave Review Panel
    async function loadAdminLeavesList() {
        if (!adminLeavesTableBody) return;
        try {
            const res = await fetch('/api/admin/leaves');
            if (!res.ok) return;
            const leaves = await res.json();

            if (leaves.length === 0) {
                adminLeavesTableBody.innerHTML = `<tr><td colspan="5" class="py-3 text-center text-slate-500 italic">No leave applications submitted yet.</td></tr>`;
                return;
            }

            adminLeavesTableBody.innerHTML = leaves.map(l => {
                const statusBadge = l.status === 'APPROVED' 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Approved</span>`
                    : (l.status === 'REJECTED' 
                        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Declined</span>`
                        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">Pending Review</span>`);

                const actionButtons = l.status === 'PENDING' ? `
                    <div class="flex items-center gap-1.5">
                        <button onclick="adminReviewLeave(${l.id}, 'APPROVED')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold transition shadow">
                            Accept
                        </button>
                        <button onclick="adminReviewLeave(${l.id}, 'REJECTED')" class="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-[10px] font-semibold transition">
                            Decline
                        </button>
                    </div>
                ` : `<span class="text-[11px] text-slate-500">Processed</span>`;

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-2 px-3 font-semibold text-white">${l.ustadh_name}</td>
                        <td class="py-2 px-3 font-mono text-slate-300">${l.start_date} to ${l.end_date}</td>
                        <td class="py-2 px-3 text-slate-300">${l.reason}</td>
                        <td class="py-2 px-3">${statusBadge}</td>
                        <td class="py-2 px-3">${actionButtons}</td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error loading leaves", e);
        }
    }

    window.adminReviewLeave = async function(leaveId, decision) {
        const actionText = decision === 'APPROVED' ? "Accept" : "Decline";
        const confirmed = await confirmAction(`${actionText} Leave Request`, `Are you sure you want to ${actionText.toLowerCase()} this leave application?`, `Yes, ${actionText}`);
        if (confirmed) {
            try {
                const res = await fetch('/api/admin/leaves/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leave_id: leaveId, status: decision })
                });
                const data = await res.json();
                showToast(data.message, decision === 'APPROVED' ? "success" : "info");
                loadAdminLeavesList();
            } catch (e) {
                showToast("Failed to process leave decision", "error");
            }
        }
    };

    if (btnRefreshLeaves) btnRefreshLeaves.addEventListener('click', loadAdminLeavesList);

    // Attendance Sheet
    async function loadAdminAttendanceSheet() {
        if (!adminAttendanceTableBody) return;
        try {
            const res = await fetch('/api/admin/attendance');
            if (!res.ok) return;
            const logs = await res.json();

            if (logs.length === 0) {
                adminAttendanceTableBody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500 italic">No attendance records today.</td></tr>`;
                return;
            }

            adminAttendanceTableBody.innerHTML = logs.map(l => {
                const clockInStr = new Date(l.clock_in_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                const clockOutStr = l.clock_out_time ? new Date(l.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

                const lateBadge = l.is_late_in 
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Late (+${l.late_minutes}m)</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">On Time</span>`;

                const earlyBadge = l.clock_out_time 
                    ? (l.is_early_out 
                        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Early (-${l.early_minutes}m)</span>`
                        : `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">Full Shift</span>`)
                    : `<span class="text-slate-500">Active</span>`;

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-2.5 px-3 font-semibold text-white">${l.ustadh_name}</td>
                        <td class="py-2.5 px-3 font-mono">${clockInStr}</td>
                        <td class="py-2.5 px-3">${lateBadge}</td>
                        <td class="py-2.5 px-3 font-mono">${clockOutStr}</td>
                        <td class="py-2.5 px-3">${earlyBadge}</td>
                        <td class="py-2.5 px-3 font-mono text-slate-400">${l.ip_address}</td>
                        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">${l.status}</span></td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error loading attendance sheet", e);
        }
    }

    if (btnRefreshAttendance) btnRefreshAttendance.addEventListener('click', loadAdminAttendanceSheet);

    // ===================================================================
    // 5. USTADH (MOBILE PORTAL) LOGIC
    // ===================================================================
    const greetingHeader = document.getElementById('greetingHeader');
    const subGreetingText = document.getElementById('subGreetingText');
    const attendanceStateBadge = document.getElementById('attendanceStateBadge');
    const btnClockIn = document.getElementById('btnClockIn');
    const btnClockOut = document.getElementById('btnClockOut');
    const overrideTimePicker = document.getElementById('overrideTimePicker');
    const simulatedIpInput = document.getElementById('simulatedIpInput');
    const btnApplySimulatedIp = document.getElementById('btnApplySimulatedIp');
    const btnResetIp = document.getElementById('btnResetIp');
    const btnCorruptDeviceKey = document.getElementById('btnCorruptDeviceKey');
    const logsTableBody = document.getElementById('logsTableBody');
    const btnRefreshLogs = document.getElementById('btnRefreshLogs');
    const submitLeaveForm = document.getElementById('submitLeaveForm');
    const leaveStartDate = document.getElementById('leaveStartDate');
    const leaveEndDate = document.getElementById('leaveEndDate');
    const leaveReason = document.getElementById('leaveReason');
    const ustadhLeavesTableBody = document.getElementById('ustadhLeavesTableBody');

    if (window.location.pathname.includes('/ustadh') || document.getElementById('ustadhActionCard')) {
        if (currentUser) {
            if (greetingHeader) greetingHeader.textContent = `Asalamu Alaikum, ${currentUser.full_name}!`;
            if (subGreetingText) subGreetingText.textContent = `Shift: ${currentUser.shift_name || 'Standard Shift'}`;
            fetchUstadhAttendanceLogs();
            fetchUstadhLeaves();
        }
    }

    if (btnApplySimulatedIp) {
        btnApplySimulatedIp.addEventListener('click', () => {
            const customIp = simulatedIpInput ? simulatedIpInput.value.trim() : '';
            if (!customIp) {
                showToast("Please enter an IP address to simulate.", "warning");
                return;
            }
            showToast(`Simulated network IP set to ${customIp}`, "info");
        });
    }

    if (btnResetIp) {
        btnResetIp.addEventListener('click', () => {
            if (simulatedIpInput) simulatedIpInput.value = '';
            showToast(`Using actual Madrasa WiFi connection.`, "info");
        });
    }

    if (btnCorruptDeviceKey) {
        btnCorruptDeviceKey.addEventListener('click', async () => {
            const confirmed = await confirmAction("Simulate Unregistered Phone", "Are you sure you want to corrupt your stored device token to simulate an unrecognized mobile device?", "Yes, Simulate");
            if (confirmed) {
                localStorage.setItem('device_key', "USTADH-DEV-INVALID-CORRUPTED-KEY");
                showToast("Device key corrupted. Next clock-in will trigger unregistered device alert.", "warning");
            }
        });
    }

    if (btnClockIn) {
        btnClockIn.addEventListener('click', async () => {
            if (!currentUser) {
                showToast("Please sign in first!", "error");
                return;
            }

            const deviceKey = window.getOrCreateDeviceKey();
            const customIp = simulatedIpInput ? simulatedIpInput.value.trim() : null;
            const overrideTime = (overrideTimePicker && overrideTimePicker.value) ? new Date(overrideTimePicker.value).toISOString() : null;

            showToast("Marking Clock-In...", "info");

            try {
                const res = await fetch('/api/ustadh/clock-in', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ustadh_id: currentUser.id,
                        device_key: deviceKey,
                        override_time: overrideTime,
                        custom_ip: customIp || null
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    // Polite toast message (No raw technical error codes)
                    showToast(data.detail || "Clock-In Failed", "error");
                    return;
                }

                showToast(data.message, "success");
                fetchUstadhAttendanceLogs();

            } catch (err) {
                showToast("Network error executing clock-in.", "error");
            }
        });
    }

    if (btnClockOut) {
        btnClockOut.addEventListener('click', async () => {
            if (!currentUser) {
                showToast("Please sign in first!", "error");
                return;
            }

            const deviceKey = window.getOrCreateDeviceKey();
            const customIp = simulatedIpInput ? simulatedIpInput.value.trim() : null;
            const overrideTime = (overrideTimePicker && overrideTimePicker.value) ? new Date(overrideTimePicker.value).toISOString() : null;

            showToast("Marking Clock-Out...", "info");

            try {
                const res = await fetch('/api/ustadh/clock-out', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ustadh_id: currentUser.id,
                        device_key: deviceKey,
                        override_time: overrideTime,
                        custom_ip: customIp || null
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.detail || "Clock-Out Failed", "error");
                    return;
                }

                showToast(data.message, "success");
                fetchUstadhAttendanceLogs();

            } catch (err) {
                showToast("Network error executing clock-out.", "error");
            }
        });
    }

    async function fetchUstadhAttendanceLogs() {
        if (!currentUser) return;
        try {
            const res = await fetch(`/api/ustadh/attendance/${currentUser.id}`);
            if (!res.ok) return;
            const data = await res.json();

            if (attendanceStateBadge) {
                if (data.is_currently_clocked_in) {
                    if (btnClockIn) btnClockIn.disabled = true;
                    if (btnClockOut) btnClockOut.disabled = false;
                    attendanceStateBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                    attendanceStateBadge.textContent = 'Status: CLOCKED IN';
                } else {
                    if (btnClockIn) btnClockIn.disabled = false;
                    if (btnClockOut) btnClockOut.disabled = true;
                    attendanceStateBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700';
                    attendanceStateBadge.textContent = 'Status: NOT CLOCKED IN';
                }
            }

            renderUstadhLogsTable(data.logs);

        } catch (e) {
            console.error("Error loading attendance history", e);
        }
    }

    function renderUstadhLogsTable(logs) {
        if (!logsTableBody) return;
        if (!logs || logs.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-slate-500 italic">No attendance records.</td></tr>`;
            return;
        }

        logsTableBody.innerHTML = logs.map(r => {
            const clockInStr = new Date(r.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const clockOutStr = r.clock_out_time ? new Date(r.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

            const lateBadge = r.is_late_in 
                ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Late (+${r.late_minutes}m)</span>`
                : `<span class="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400">On Time</span>`;

            const statusBadge = r.status === 'CLOCKED_IN'
                ? `<span class="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300 font-semibold">In</span>`
                : `<span class="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300">Out</span>`;

            return `
                <tr class="hover:bg-slate-900/50 transition">
                    <td class="py-2 px-2 font-mono">${clockInStr}</td>
                    <td class="py-2 px-2">${lateBadge}</td>
                    <td class="py-2 px-2 font-mono">${clockOutStr}</td>
                    <td class="py-2 px-2">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', () => {
            if (currentUser) fetchUstadhAttendanceLogs();
        });
    }

    if (submitLeaveForm) {
        submitLeaveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const sDate = leaveStartDate ? leaveStartDate.value : '';
            const eDate = leaveEndDate ? leaveEndDate.value : '';
            const reason = leaveReason ? leaveReason.value.trim() : '';

            showToast("Submitting leave request...", "info");

            try {
                const res = await fetch('/api/ustadh/leaves/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ustadh_id: currentUser.id,
                        start_date: sDate,
                        end_date: eDate,
                        reason: reason
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    showToast(data.detail || "Failed to submit leave request", "error");
                    return;
                }

                showToast(data.message, "success");
                submitLeaveForm.reset();
                fetchUstadhLeaves();

            } catch (err) {
                showToast("Network error submitting leave request", "error");
            }
        });
    }

    async function fetchUstadhLeaves() {
        if (!ustadhLeavesTableBody || !currentUser) return;
        try {
            const res = await fetch(`/api/ustadh/leaves/${currentUser.id}`);
            if (!res.ok) return;
            const leaves = await res.json();

            if (leaves.length === 0) {
                ustadhLeavesTableBody.innerHTML = `<tr><td colspan="3" class="py-2 text-center text-slate-500 italic text-[10px]">No leave applications submitted.</td></tr>`;
                return;
            }

            ustadhLeavesTableBody.innerHTML = leaves.map(l => {
                const statusBadge = l.status === 'APPROVED'
                    ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">Approved</span>`
                    : (l.status === 'REJECTED'
                        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">Declined</span>`
                        : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Pending Review</span>`);

                return `
                    <tr class="hover:bg-slate-900/50 transition">
                        <td class="py-1.5 px-2 font-mono text-[10px]">${l.start_date} to ${l.end_date}</td>
                        <td class="py-1.5 px-2 text-[10px] text-slate-300">${l.reason}</td>
                        <td class="py-1.5 px-2">${statusBadge}</td>
                    </tr>
                `;
            }).join('');

        } catch (e) {
            console.error("Error loading Ustadh leaves", e);
        }
    }
});
