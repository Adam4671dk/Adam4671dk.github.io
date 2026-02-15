import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const sidebarNavItems = document.querySelectorAll('.nav-item');
const dashboardSections = document.querySelectorAll('.dashboard-section');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.dashboard-sidebar');
const modalBackdrop = document.getElementById('modal-backdrop');

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  window.location.href = '/login.html';
});

sidebarNavItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    showSection(section);
    sidebarNavItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    if (sidebar) sidebar.classList.remove('active');
  });
});

menuToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

modalBackdrop.addEventListener('click', () => {
  closeModal();
});

async function initDashboard() {
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');

  if (!token || !userId) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const { data } = await supabase.auth.getUser(token);
    if (!data.user) throw new Error('Invalid session');
    currentUser = data.user;
  } catch (error) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    window.location.href = '/login.html';
    return;
  }

  userNameEl.textContent = currentUser.email?.split('@')[0] || 'User';
  loadDashboardData();
  showSection('overview');
}

function showSection(sectionId) {
  dashboardSections.forEach(section => section.classList.remove('active'));
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active');
}

async function loadDashboardData() {
  if (!currentUser) return;

  try {
    const [{ data: tokens }, { data: webhooks }, { data: profile }] = await Promise.all([
      supabase.from('bot_tokens').select('*').eq('user_id', currentUser.id),
      supabase.from('discord_webhooks').select('*').eq('user_id', currentUser.id),
      supabase.from('user_profiles').select('has_2fa, admin_token').eq('user_id', currentUser.id).maybeSingle()
    ]);

    const botTokens = tokens?.filter(t => t.token_type === 'discord') || [];
    const customTokens = tokens?.filter(t => t.token_type === 'custom') || [];

    document.getElementById('token-count').textContent = customTokens.length;
    document.getElementById('webhook-count').textContent = webhooks?.length || 0;
    document.getElementById('bot-count').textContent = botTokens.length;
    document.getElementById('2fa-status').textContent = profile?.has_2fa ? 'Active' : 'Inactive';

    renderTokensList(customTokens);
    renderWebhooksList(webhooks || []);
    renderBotTokensList(botTokens);
    renderAccountSettings(profile);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

function renderTokensList(tokens) {
  const list = document.getElementById('tokens-list');
  if (!tokens.length) {
    list.innerHTML = '<p class="empty-state">Ingen tokens oprettet</p>';
    return;
  }

  list.innerHTML = tokens.map(token => `
    <div class="token-item">
      <div>
        <div class="token-name">${escapeHtml(token.name)}</div>
        <div class="token-date">Oprettet: ${new Date(token.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyToClipboard('${token.token}')">Kopier</button>
        <button class="delete-btn" onclick="deleteToken('${token.id}')">Slet</button>
      </div>
    </div>
  `).join('');
}

function renderWebhooksList(webhooks) {
  const list = document.getElementById('webhooks-list');
  if (!webhooks.length) {
    list.innerHTML = '<p class="empty-state">Ingen webhooks konfigureret</p>';
    return;
  }

  list.innerHTML = webhooks.map(webhook => `
    <div class="webhook-item">
      <div>
        <div class="token-name">${escapeHtml(webhook.name)}</div>
        <div class="token-date">${webhook.active ? 'Aktiv' : 'Inaktiv'} · Oprettet: ${new Date(webhook.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyToClipboard('${webhook.webhook_url}')">Kopier URL</button>
        <button class="delete-btn" onclick="deleteWebhook('${webhook.id}')">Slet</button>
      </div>
    </div>
  `).join('');
}

function renderBotTokensList(tokens) {
  const list = document.getElementById('bot-tokens-list');
  if (!tokens.length) {
    list.innerHTML = '<p class="empty-state">Ingen bot tokens tilføjet</p>';
    return;
  }

  list.innerHTML = tokens.map(token => `
    <div class="bot-token-item">
      <div>
        <div class="token-name">${escapeHtml(token.name)}</div>
        <div class="token-date">${token.active ? 'Aktiv' : 'Inaktiv'} · Oprettet: ${new Date(token.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyToClipboard('${token.token}')">Kopier</button>
        <button class="delete-btn" onclick="deleteToken('${token.id}')">Slet</button>
      </div>
    </div>
  `).join('');
}

function renderAccountSettings(profile) {
  const emailInput = document.getElementById('account-email');
  if (emailInput && currentUser) {
    emailInput.value = currentUser.email || '';
  }
}

window.copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert('Kopieret til udklipsholder');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

window.deleteToken = async (id) => {
  if (!confirm('Slet denne token?')) return;

  try {
    await supabase.from('bot_tokens').delete().eq('id', id).eq('user_id', currentUser.id);
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved sletning: ' + error.message);
  }
};

window.deleteWebhook = async (id) => {
  if (!confirm('Slet denne webhook?')) return;

  try {
    await supabase.from('discord_webhooks').delete().eq('id', id).eq('user_id', currentUser.id);
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved sletning: ' + error.message);
  }
};

document.getElementById('add-token-btn')?.addEventListener('click', () => {
  openModal('add-token-modal');
});

document.getElementById('cancel-token')?.addEventListener('click', closeModal);

document.getElementById('token-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('token-name').value;
  const token = `token_${Math.random().toString(36).substr(2, 32)}`;

  try {
    const { error } = await supabase.from('bot_tokens').insert({
      user_id: currentUser.id,
      token,
      token_type: 'custom',
      name,
      active: true
    });

    if (error) throw error;

    closeModal();
    document.getElementById('token-form').reset();
    loadDashboardData();
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
});

document.getElementById('add-webhook-btn')?.addEventListener('click', async () => {
  const webhookUrl = prompt('Indtast Discord webhook URL:');
  if (!webhookUrl) return;

  try {
    const { error } = await supabase.from('discord_webhooks').insert({
      user_id: currentUser.id,
      webhook_url: webhookUrl,
      name: 'Discord Webhook',
      active: true
    });

    if (error) throw error;
    loadDashboardData();
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
});

document.getElementById('add-bot-btn')?.addEventListener('click', async () => {
  const botToken = prompt('Indtast Discord bot token:');
  if (!botToken) return;

  try {
    const { error } = await supabase.from('bot_tokens').insert({
      user_id: currentUser.id,
      token: botToken,
      token_type: 'discord',
      name: 'Discord Bot Token',
      active: true
    });

    if (error) throw error;
    loadDashboardData();
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
});

document.getElementById('setup-2fa-btn')?.addEventListener('click', setupTwoFA);

async function setupTwoFA() {
  try {
    const secret = generateSecret();

    document.getElementById('2fa-setup').style.display = 'none';
    document.getElementById('2fa-qr').style.display = 'block';

    const qrElement = document.getElementById('qr-code');
    qrElement.textContent = `Secret: ${secret}\n\nScan with your authenticator app`;
    qrElement.style.wordBreak = 'break-all';
    qrElement.style.whiteSpace = 'pre-wrap';

    const verifyBtn = document.getElementById('verify-2fa-btn');
    verifyBtn.onclick = null;
    verifyBtn.addEventListener('click', verify2FACode);
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
}

async function verify2FACode(e) {
  if (e) e.preventDefault();

  const code = document.getElementById('2fa-verify-code').value;
  const secret = document.getElementById('qr-code').textContent.match(/Secret: (\w+)/)?.[1];

  if (!secret) {
    alert('Secret not found');
    return;
  }

  try {
    const { error: insertError } = await supabase.from('user_2fa_secrets').insert({
      user_id: currentUser.id,
      secret,
      verified: true
    });

    if (insertError) throw insertError;

    const { error: updateError } = await supabase.from('user_profiles')
      .update({ has_2fa: true })
      .eq('user_id', currentUser.id);

    if (updateError) throw updateError;

    alert('2FA aktiveret!');
    document.getElementById('2fa-setup').style.display = 'block';
    document.getElementById('2fa-qr').style.display = 'none';
    document.getElementById('2fa-verify-code').value = '';
    loadDashboardData();
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
}

document.getElementById('change-password-btn')?.addEventListener('click', async () => {
  const newPassword = prompt('Indtast ny adgangskode:');
  if (!newPassword) return;

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    alert('Adgangskode ændret!');
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
});

document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
  if (!confirm('Er du sikker? Dette kan ikke fortrydes.')) return;
  if (!confirm('Dit konto og alle data vil blive permanent slettet. Bekræft igen.')) return;

  try {
    await supabase.from('user_profiles').delete().eq('user_id', currentUser.id);
    await supabase.auth.admin.deleteUser(currentUser.id);
    window.location.href = '/login.html';
  } catch (error) {
    alert('Fejl: ' + error.message);
  }
});

function openModal(modalId) {
  modalBackdrop.classList.add('active');
  document.getElementById(modalId).classList.add('active');
}

function closeModal() {
  modalBackdrop.classList.remove('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

initDashboard();
