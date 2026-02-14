import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://0ec90b57d6e95fcbda198a32f.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const sidebarNavItems = document.querySelectorAll('.nav-item');
const dashboardSections = document.querySelectorAll('.dashboard-section');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.dashboard-sidebar');

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});

sidebarNavItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    showSection(section);
    sidebarNavItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    if (menuToggle) sidebar.classList.remove('active');
  });
});

menuToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

async function initDashboard() {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  const { data } = await supabase.auth.getUser(token);
  currentUser = data.user;

  if (!currentUser) {
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
    const { data: tokens } = await supabase
      .from('bot_tokens')
      .select('*')
      .eq('user_id', currentUser.id);

    const { data: webhooks } = await supabase
      .from('discord_webhooks')
      .select('*')
      .eq('user_id', currentUser.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('has_2fa, admin_token')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    document.getElementById('token-count').textContent = tokens?.length || 0;
    document.getElementById('webhook-count').textContent = webhooks?.length || 0;
    document.getElementById('bot-count').textContent = tokens?.length || 0;
    document.getElementById('2fa-status').textContent = profile?.has_2fa ? 'Active' : 'Inactive';

    renderTokensList(tokens || []);
    renderWebhooksList(webhooks || []);
    renderBotTokensList(tokens || []);
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
        <div class="token-name">${token.name}</div>
        <div class="token-date">Oprettet: ${new Date(token.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyToken('${token.token}')">Kopier</button>
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
        <div class="token-name">${webhook.name}</div>
        <div class="token-date">${webhook.active ? 'Aktiv' : 'Inaktiv'} · Oprettet: ${new Date(webhook.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyWebhook('${webhook.webhook_url}')">Kopier URL</button>
        <button class="delete-btn" onclick="deleteWebhook('${webhook.id}')">Slet</button>
      </div>
    </div>
  `).join('');
}

function renderBotTokensList(tokens) {
  const list = document.getElementById('bot-tokens-list');
  const botTokens = tokens.filter(t => t.token_type === 'discord');

  if (!botTokens.length) {
    list.innerHTML = '<p class="empty-state">Ingen bot tokens tilføjet</p>';
    return;
  }

  list.innerHTML = botTokens.map(token => `
    <div class="bot-token-item">
      <div>
        <div class="token-name">${token.name}</div>
        <div class="token-date">${token.active ? 'Aktiv' : 'Inaktiv'} · Oprettet: ${new Date(token.created_at).toLocaleDateString('da-DK')}</div>
      </div>
      <div class="token-actions">
        <button class="copy-btn" onclick="copyToken('${token.token}')">Kopier</button>
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

window.copyToken = async (token) => {
  try {
    await navigator.clipboard.writeText(token);
    alert('Token kopieret til udklipsholder');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

window.copyWebhook = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    alert('Webhook URL kopieret til udklipsholder');
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

window.deleteToken = async (id) => {
  if (!confirm('Slet denne token?')) return;

  try {
    await supabase.from('bot_tokens').delete().eq('id', id);
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved sletning af token: ' + error.message);
  }
};

window.deleteWebhook = async (id) => {
  if (!confirm('Slet denne webhook?')) return;

  try {
    await supabase.from('discord_webhooks').delete().eq('id', id);
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved sletning af webhook: ' + error.message);
  }
};

document.getElementById('add-token-btn')?.addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.add('active');
  document.getElementById('add-token-modal').classList.add('active');
});

document.getElementById('cancel-token')?.addEventListener('click', () => {
  document.getElementById('modal-backdrop').classList.remove('active');
  document.getElementById('add-token-modal').classList.remove('active');
});

document.getElementById('token-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('token-name').value;
  const permissions = {
    read: document.querySelector('input[name="read"]').checked,
    write: document.querySelector('input[name="write"]').checked,
    admin: document.querySelector('input[name="admin"]').checked
  };

  const token = `token_${Math.random().toString(36).substr(2, 32)}`;

  try {
    await supabase.from('bot_tokens').insert({
      user_id: currentUser.id,
      token,
      token_type: 'custom',
      name,
      active: true
    });

    document.getElementById('modal-backdrop').classList.remove('active');
    document.getElementById('add-token-modal').classList.remove('active');
    document.getElementById('token-form').reset();
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved oprettelse af token: ' + error.message);
  }
});

document.getElementById('add-webhook-btn')?.addEventListener('click', () => {
  const webhookUrl = prompt('Indtast Discord webhook URL:');
  if (!webhookUrl) return;

  addWebhook(webhookUrl);
});

document.getElementById('add-bot-btn')?.addEventListener('click', () => {
  const botToken = prompt('Indtast Discord bot token:');
  if (!botToken) return;

  addBotToken(botToken);
});

async function addWebhook(url) {
  try {
    await supabase.from('discord_webhooks').insert({
      user_id: currentUser.id,
      webhook_url: url,
      name: 'Discord Webhook',
      active: true
    });
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved tilføjelse af webhook: ' + error.message);
  }
}

async function addBotToken(token) {
  try {
    await supabase.from('bot_tokens').insert({
      user_id: currentUser.id,
      token,
      token_type: 'discord',
      name: 'Discord Bot Token',
      active: true
    });
    loadDashboardData();
  } catch (error) {
    alert('Fejl ved tilføjelse af bot token: ' + error.message);
  }
}

document.getElementById('setup-2fa-btn')?.addEventListener('click', () => {
  setupTwoFA();
});

async function setupTwoFA() {
  try {
    const secret = generateSecret();
    const qrCode = generateQRCode(secret, currentUser.email);

    document.getElementById('2fa-setup').style.display = 'none';
    document.getElementById('2fa-qr').style.display = 'block';

    const qrElement = document.getElementById('qr-code');
    qrElement.textContent = 'QR Code: ' + secret;
    qrElement.style.fontSize = '12px';
    qrElement.style.wordBreak = 'break-all';

    document.getElementById('verify-2fa-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      const code = document.getElementById('2fa-verify-code').value;

      if (verifyCode(secret, code)) {
        await supabase.from('user_2fa_secrets').insert({
          user_id: currentUser.id,
          secret,
          verified: true
        });

        await supabase.from('user_profiles')
          .update({ has_2fa: true })
          .eq('user_id', currentUser.id);

        alert('2FA успешно активирован!');
        document.getElementById('2fa-setup').style.display = 'block';
        document.getElementById('2fa-qr').style.display = 'none';
        loadDashboardData();
      } else {
        alert('Неправильный код');
      }
    });
  } catch (error) {
    alert('Ошибка при настройке 2FA: ' + error.message);
  }
}

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function generateQRCode(secret, email) {
  return `otpauth://totp/Camara:${email}?secret=${secret}&issuer=Camara`;
}

function verifyCode(secret, code) {
  return code.length === 6 && /^\d+$/.test(code);
}

initDashboard();
