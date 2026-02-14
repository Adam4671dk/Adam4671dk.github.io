import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://0ec90b57d6e95fcbda198a32f.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

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

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('has_2fa')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (profile?.has_2fa) {
      current2FASession = { userId: data.user.id, email };
      loginForm.style.display = 'none';
      document.getElementById('login-2fa').style.display = 'block';
    } else {
      sessionStorage.setItem('authToken', data.session.access_token);
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
});

demoLoginBtn.addEventListener('click', async () => {
  const demoEmail = 'demo@camara.app';
  const demoPassword = 'DemoPassword123!';

  try {
    let { data: user } = await supabase.auth.signUp({
      email: demoEmail,
      password: demoPassword
    });

    if (!user) {
      const { data } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword
      });
      user = data.user;
    }

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          admin_token: `token_${Math.random().toString(36).substr(2, 9)}`
        });
      }

      sessionStorage.setItem('authToken', data.session.access_token);
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    alert('Demo login failed: ' + error.message);
  }
});

backToLoginBtn.addEventListener('click', () => {
  loginForm.style.display = 'block';
  document.getElementById('login-2fa').style.display = 'none';
  current2FASession = null;
});

verify2faForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('2fa-code').value;

  if (!current2FASession) {
    alert('2FA session lost. Please login again.');
    return;
  }

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

    const isValid = verifyTOTP(secrets.secret, code);

    if (isValid) {
      const { data } = await supabase.auth.signInWithPassword({
        email: current2FASession.email,
        password: document.getElementById('login-password').value
      });

      sessionStorage.setItem('authToken', data.session.access_token);
      window.location.href = '/dashboard.html';
    } else {
      alert('Invalid 2FA code');
    }
  } catch (error) {
    alert('2FA verification failed: ' + error.message);
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  if (password !== passwordConfirm) {
    alert('Passwords do not match');
    return;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) throw error;

    const { error: profileError } = await supabase.from('user_profiles').insert({
      user_id: data.user.id,
      admin_token: `token_${Math.random().toString(36).substr(2, 9)}`
    });

    if (profileError) throw profileError;

    alert('Account created! Please check your email to confirm.');
    tabButtons[0].click();
  } catch (error) {
    alert('Signup failed: ' + error.message);
  }
});

function verifyTOTP(secret, code) {
  const buffer = base32Decode(secret);
  const time = Math.floor(Date.now() / 30000);

  for (let i = -1; i <= 1; i++) {
    const hmac = generateHMAC(buffer, time + i);
    const offset = hmac[hmac.length - 1] & 0xf;
    const otp = (hmac[offset] & 0x7f) << 24 |
                (hmac[offset + 1] & 0xff) << 16 |
                (hmac[offset + 2] & 0xff) << 8 |
                (hmac[offset + 3] & 0xff);
    const otpStr = (otp % 1000000).toString().padStart(6, '0');

    if (otpStr === code) return true;
  }

  return false;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const result = [];

  for (let i = 0; i < str.length; i++) {
    const idx = alphabet.indexOf(str[i].toUpperCase());
    if (idx === -1) throw new Error('Invalid character in base32 string');
    bits += 5;
    value = (value << 5) | idx;
    if (bits >= 8) {
      bits -= 8;
      result.push((value >> bits) & 255);
    }
  }

  return new Uint8Array(result);
}

function generateHMAC(key, message) {
  const counter = new ArrayBuffer(8);
  const view = new DataView(counter);
  view.setBigInt64(0, BigInt(message), false);
  return hmacSha1(key, new Uint8Array(counter));
}

function hmacSha1(key, message) {
  const blockSize = 64;
  const hashSize = 20;

  if (key.length > blockSize) {
    key = sha1(key);
  }

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);

  for (let i = 0; i < key.length; i++) {
    ipad[i] = key[i] ^ 0x36;
    opad[i] = key[i] ^ 0x5c;
  }

  for (let i = key.length; i < blockSize; i++) {
    ipad[i] = 0x36;
    opad[i] = 0x5c;
  }

  const innerMessage = new Uint8Array(blockSize + message.length);
  innerMessage.set(ipad);
  innerMessage.set(message, blockSize);

  const innerHash = sha1(innerMessage);

  const outerMessage = new Uint8Array(blockSize + hashSize);
  outerMessage.set(opad);
  outerMessage.set(innerHash, blockSize);

  return sha1(outerMessage);
}

function sha1(message) {
  const h0 = 0x67452301;
  const h1 = 0xefcdab89;
  const h2 = 0x98badcfe;
  const h3 = 0x10325476;
  const h4 = 0xc3d2e1f0;

  const ml = message.length * 8;
  const msg = new Uint8Array(message);

  msg[msg.length] = 0x80;
  while (msg.length % 64 !== 56) {
    msg[msg.length] = 0x00;
  }

  const view = new DataView(msg.buffer, msg.byteOffset);
  view.setBigInt64(msg.length - 8, BigInt(ml), false);

  let a = h0, b = h1, c = h2, d = h3, e = h4;

  for (let i = 0; i < msg.length; i += 64) {
    const w = new Uint32Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }

    for (let j = 16; j < 80; j++) {
      w[j] = leftRotate(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
    }

    let aa = a, bb = b, cc = c, dd = d, ee = e;

    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) {
        f = (bb & cc) | (~bb & dd);
        k = 0x5a827999;
      } else if (j < 40) {
        f = bb ^ cc ^ dd;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (bb & cc) | (bb & dd) | (cc & dd);
        k = 0x8f1bbcdc;
      } else {
        f = bb ^ cc ^ dd;
        k = 0xca62c1d6;
      }

      const temp = (leftRotate(aa, 5) + f + ee + k + w[j]) >>> 0;
      ee = dd;
      dd = cc;
      cc = leftRotate(bb, 30);
      bb = aa;
      aa = temp;
    }

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
    e = (e + ee) >>> 0;
  }

  const result = new Uint8Array(20);
  const view2 = new DataView(result.buffer);
  view2.setUint32(0, a, false);
  view2.setUint32(4, b, false);
  view2.setUint32(8, c, false);
  view2.setUint32(12, d, false);
  view2.setUint32(16, e, false);

  return result;
}

function leftRotate(n, b) {
  return ((n << b) | (n >>> (32 - b))) >>> 0;
}
