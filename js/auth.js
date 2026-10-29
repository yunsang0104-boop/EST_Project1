/* 공통 인증: 세션 확인, 이메일 가입/로그인, 로그아웃 및 화면 전환.
 * DB 접근 권한은 이 화면 처리와 별도로 Supabase RLS에서 관리해야 합니다. */
(function () {
  'use strict';
  const client = window.supabaseClient;
  const page = document.body.dataset.page;
  const isAuthPage = page === 'login' || page === 'signup';
  const requiresAuth = document.body.dataset.authRequired === 'true';
  const $ = (id) => document.getElementById(id);
  let ready = false;
  let busy = false;
  let revision = 0;
  let redirecting = false;

  function redirect(path) {
    if (redirecting) return;
    redirecting = true;
    // 인증 콜백 안에서는 Supabase API를 호출하지 않습니다.
    window.setTimeout(() => window.location.replace(path), 0);
  }

  function message(text, error) {
    const target = $('auth-message');
    if (!target) return;
    target.textContent = text;
    target.classList.toggle('auth-error', Boolean(error));
    target.setAttribute('role', error ? 'alert' : 'status');
  }

  function errorMessage(error) {
    const messages = {
      invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
      email_not_confirmed: '이메일 인증이 완료되지 않았습니다. 받은 메일의 인증 링크를 확인해 주세요.',
      user_already_exists: '이미 가입된 이메일입니다. 로그인 화면에서 로그인해 주세요.',
      weak_password: '비밀번호가 보안 조건을 충족하지 않습니다. 더 길고 다양한 문자를 사용해 주세요.',
      email_address_invalid: '사용할 수 없는 이메일 주소입니다. 이메일을 확인해 주세요.',
      email_address_not_authorized: '현재 이 이메일로는 가입 메일을 보낼 수 없습니다. 서비스 관리자에게 문의해 주세요.',
      signup_disabled: '현재 회원가입이 중지되어 있습니다. 서비스 관리자에게 문의해 주세요.',
      email_provider_disabled: '이메일 로그인이 비활성화되어 있습니다. 서비스 관리자에게 문의해 주세요.',
      over_email_send_rate_limit: '인증 메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      over_request_rate_limit: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      session_not_found: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
      refresh_token_not_found: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.'
    };
    if (error && messages[error.code]) return messages[error.code];
    if (error && (error.status === 429)) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error && (error.name === 'AuthRetryableFetchError' || error instanceof TypeError)) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    return '인증 요청을 처리하지 못했습니다. 입력 내용을 확인하고 잠시 후 다시 시도해 주세요.';
  }

  // 기존 화면의 헤더에만 로그인 사용자와 로그아웃 버튼을 추가합니다.
  if (requiresAuth) {
    const controls = document.createElement('div');
    controls.className = 'auth-controls';
    controls.hidden = true;
    const email = document.createElement('span');
    email.id = 'auth-user-email';
    const logout = document.createElement('button');
    logout.id = 'auth-logout';
    logout.type = 'button';
    logout.className = 'button secondary';
    logout.textContent = '로그아웃';
    const status = document.createElement('p');
    status.id = 'auth-message';
    status.className = 'auth-message';
    status.setAttribute('role', 'status');
    controls.append(email, logout, status);
    document.querySelector('.header-inner').append(controls);

    const gate = document.createElement('section');
    gate.className = 'auth-gate card';
    gate.id = 'auth-gate';
    const text = document.createElement('p');
    text.id = 'auth-gate-message';
    text.setAttribute('role', 'status');
    text.textContent = '로그인 상태를 확인하고 있습니다.';
    const retry = document.createElement('button');
    retry.id = 'auth-retry';
    retry.type = 'button';
    retry.className = 'button secondary';
    retry.textContent = '다시 확인';
    retry.hidden = true;
    retry.addEventListener('click', () => window.location.reload());
    gate.append(text, retry);
    document.querySelector('main').before(gate);
  }

  function applySession(session) {
    const signedIn = Boolean(session && session.user);
    document.body.dataset.authState = signedIn ? 'signed-in' : 'signed-out';
    if (requiresAuth) {
      $('auth-user-email').textContent = signedIn ? session.user.email || '로그인 사용자' : '';
      document.querySelector('.auth-controls').hidden = !signedIn;
      $('auth-gate').hidden = signedIn;
      if (!signedIn) redirect('login.html');
    } else if (isAuthPage && signedIn) {
      redirect('index.html');
    }
  }

  function connectionError(error) {
    ready = false;
    document.body.dataset.authState = 'error';
    const text = error ? errorMessage(error) : '인증 서비스를 불러오지 못했습니다. 인터넷 연결을 확인한 후 새로고침해 주세요.';
    message(text, true);
    if (requiresAuth) {
      $('auth-gate').hidden = false;
      $('auth-gate-message').textContent = text;
      $('auth-retry').hidden = false;
    }
  }

  if (!client) { connectionError(); return; }

  client.auth.onAuthStateChange((event, session) => {
    revision += 1;
    ready = true;
    applySession(session);
    if (isAuthPage && !busy) {
      $('auth-submit').disabled = false;
      message('');
    }
  });

  async function checkSession() {
    const currentRevision = revision;
    try {
      const { data, error } = await client.auth.getSession();
      if (currentRevision !== revision) return;
      if (error) throw error;
      ready = true;
      applySession(data.session);
      if (isAuthPage) { $('auth-submit').disabled = false; message(''); }
    } catch (error) { if (currentRevision === revision) connectionError(error); }
  }
  checkSession();

  if (requiresAuth) {
    $('auth-logout').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      $('auth-logout').disabled = true;
      $('auth-logout').textContent = '로그아웃 중…';
      message('');
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        redirect('login.html');
      } catch (error) { message(errorMessage(error), true); }
      finally {
        busy = false;
        $('auth-logout').disabled = false;
        $('auth-logout').textContent = '로그아웃';
      }
    });
  }

  if (isAuthPage) {
    const form = $('auth-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!ready || busy) return;
      const email = $('email').value.trim();
      const password = $('password').value; // 비밀번호 앞뒤 공백도 원래 값대로 전달합니다.
      const emailError = !email || $('email').validity.typeMismatch ? '올바른 이메일 주소를 입력해 주세요.' : '';
      const passwordError = !password ? '비밀번호를 입력해 주세요.' : page === 'signup' && password.length < 6 ? '비밀번호를 6자 이상 입력해 주세요.' : '';
      for (const [id, text] of [['email', emailError], ['password', passwordError]]) {
        $(id + '-error').textContent = text;
        $(id).setAttribute('aria-invalid', text ? 'true' : 'false');
      }
      message('');
      if (emailError || passwordError) { $(emailError ? 'email' : 'password').focus(); return; }
      busy = true;
      $('auth-submit').disabled = true;
      $('auth-submit').textContent = '처리 중…';
      try {
        let response;
        if (page === 'signup') {
          const credentials = { email, password };
          // 배포한 도메인은 Supabase Auth의 Redirect URLs에도 등록해야 합니다.
          if (/^https?:$/.test(window.location.protocol)) {
            credentials.options = { emailRedirectTo: new URL('login.html', window.location.href).href };
          }
          response = await client.auth.signUp(credentials);
        } else {
          response = await client.auth.signInWithPassword({ email, password });
        }
        if (response.error) throw response.error;
        $('password').value = '';
        if (response.data.session) {
          applySession(response.data.session);
        } else if (page === 'signup') {
          message('가입 요청을 받았습니다. 이메일 인증이 필요한 경우 받은 메일의 인증 링크를 누른 뒤 로그인해 주세요. 메일이 없다면 스팸함을 확인하거나 기존 계정으로 로그인해 주세요.');
        } else {
          message('로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요.', true);
        }
      } catch (error) { message(errorMessage(error), true); }
      finally {
        busy = false;
        $('auth-submit').disabled = !ready;
        $('auth-submit').textContent = page === 'signup' ? '회원가입' : '로그인';
      }
    });
  }

  // 뒤로 가기로 복원된 화면에서도 최신 세션을 다시 확인합니다.
  window.addEventListener('pageshow', (event) => { if (event.persisted) checkSession(); });
})();
