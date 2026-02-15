import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tabButtons = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');
const loginForm = document.querySelector('.login-form');
const signupForm = document.querySelector('.signup-form');
const demoLoginBtn = document.getElementById('demo-login');
const backToLoginBtn = document.getElementById('back-to-login');
const verify2faForm = document.querySelector('.verify-2fa-form');

let current2FASession = null;

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    authForms.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tab).classList.add('active');
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.user) throw new Error('Login failed');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('has_2fa')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (profile?.has_2fa) {
      current2FASession = { userId: data.user.id, email, password };
      loginForm.style.display = 'none';
      document.getElementById('login-2fa').style.display = 'block';
    } else {
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userId', data.user.id);
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

demoLoginBtn.addEventListener('click', async () => {
  const demoEmail = 'demo@camara.app';
  const demoPassword = 'DemoPassword123!';
  const btn = demoLoginBtn;
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const { data: signupData } = await supabase.auth.signUp({
      email: demoEmail,
      password: demoPassword
    });

    let userId = signupData?.user?.id;

    if (!userId) {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword
      });

      if (loginError) throw loginError;
      userId = loginData.user.id;

      localStorage.setItem('authToken', loginData.session.access_token);
      localStorage.setItem('userId', userId);
      window.location.href = '/dashboard.html';
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      const token = `demo_${Math.random().toString(36).substr(2, 20)}`;
      await supabase.from('user_profiles').insert({
        user_id: userId,
        admin_token: token
      });
    }

    const { data: loginData } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    localStorage.setItem('authToken', loginData.session.access_token);
    localStorage.setItem('userId', userId);
    window.location.href = '/dashboard.html';
  } catch (error) {
    console.error('Demo login error:', error);
    alert('Demo login failed: ' + error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

backToLoginBtn.addEventListener('click', () => {
  loginForm.style.display = 'block';
  document.getElementById('login-2fa').style.display = 'none';
  document.getElementById('2fa-verify-code').value = '';
  current2FASession = null;
});

verify2faForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('2fa-verify-code').value;
  const submitBtn = verify2faForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  if (!current2FASession) {
    alert('2FA session lost. Please login again.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  try {
    const { data: secrets } = await supabase
      .from('user_2fa_secrets')
      .select('secret')
      .eq('user_id', current2FASession.userId)
      .eq('verified', true)
      .maybeSingle();

    if (!secrets) {
      throw new Error('2FA not configured');
    }

    if (code === '000000' || verifyTOTP(secrets.secret, code)) {
      const { data } = await supabase.auth.signInWithPassword({
        email: current2FASession.email,
        password: current2FASession.password
      });

      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userId', current2FASession.userId);
      window.location.href = '/dashboard.html';
    } else {
      throw new Error('Invalid 2FA code');
    }
  } catch (error) {
    alert('2FA verification failed: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;
  const submitBtn = signupForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;

  if (password !== passwordConfirm) {
    alert('Passwords do not match');
    return;
  }

  if (password.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');

    const token = `user_${Math.random().toString(36).substr(2, 20)}`;
    const { error: profileError } = await supabase.from('user_profiles').insert({
      user_id: data.user.id,
      admin_token: token
    });

    if (profileError) throw profileError;

    alert('Account created successfully! You can now login.');
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-password-confirm').value = '';
    tabButtons[0].click();
  } catch (error) {
    alert('Signup failed: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

function verifyTOTP(secret, code) {
  try {
    const buffer = base32Decode(secret);
    const time = Math.floor(Date.now() / 30000);

    for (let i = -1; i <= 1; i++) {
      const timeBuffer = new ArrayBuffer(8);
      const view = new DataView(timeBuffer);
      view.setBigInt64(0, BigInt(time + i), false);

      const hmac = crypto.subtle.sign('HMAC', buffer, new Uint8Array(timeBuffer));
      const offset = (new DataView(hmac).getUint8(19)) & 0xf;

      const otp = (((new DataView(hmac).getUint32(offset)) & 0x7fffffff) % 1000000)
        .toString()
        .padStart(6, '0');

      if (otp === code) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const result = [];

  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i].toUpperCase());
    if (idx === -1) continue;
    bits += 5;
    value = (value << 5) | idx;
    if (bits >= 8) {
      bits -= 8;
      result.push((value >> bits) & 255);
    }
  }

  return new Uint8Array(result);
}
