(() => {
  'use strict';

  /* V1010373_INAPP_LANDSCAPE_SAFE: Kakao/messenger best-effort landscape; never CSS-rotate the game root. */

  const coarse =
    window.matchMedia?.('(pointer: coarse)').matches ?? false;

  const ua =
    navigator.userAgent || '';

  const mobile =
    coarse ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  if (!mobile) {
    return;
  }

  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1
    );

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  /*
   * V1010372_INAPP_LANDSCAPE_FALLBACK:
   * KakaoTalk/LINE/Instagram/Facebook/Naver Android WebViews may expose neither
   * standards fullscreen nor Screen Orientation lock. Detect those shells so
   * the Fullscreen button can fall back to a CSS-rotated landscape stage.
   */
  const inAppBrowser =
    /KAKAOTALK|KakaoTalk|Line\/|NAVER|Instagram|FBAN|FBAV|; wv\)|\bwv\b/i
      .test(ua);


  const languageCandidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  let language = 'en';

  if (languageCandidates.some((v) => v.startsWith('ko'))) {
    language = 'ko';
  } else if (languageCandidates.some((v) => v.startsWith('ja'))) {
    language = 'ja';
  } else if (
    languageCandidates.some(
      (v) =>
        v.startsWith('zh')
    )
  ) {
    language = 'zh';
  }

  const copy = {
    ko: {
      title: '휴대폰을 가로로 돌려주세요',
      body: '가로 화면에서 캐릭터와 조작 버튼이 더 크게 보여요.',
      fullscreen: '⛶ 전체화면으로 플레이',
      install: '앱처럼 설치하기',
      iosInstall: 'Safari의 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하면 주소창 없이 플레이할 수 있어요.',
      installHelp: '홈 화면에 추가하면 주소창 없이 더 넓게 플레이할 수 있어요.',
      landscapeHint: '가로 화면 권장',
      fullscreenShort: '⛶ 전체화면',
      installed: '앱 모드',
    },
    ja: {
      title: 'スマホを横向きにしてください',
      body: '横画面にするとキャラクターと操作ボタンが大きく表示されます。',
      fullscreen: '⛶ 全画面でプレイ',
      install: 'アプリのようにインストール',
      iosInstall: 'Safariの共有ボタンから「ホーム画面に追加」を選ぶと、アドレスバーなしで遊べます。',
      installHelp: 'ホーム画面に追加すると、アドレスバーなしで広く遊べます。',
      landscapeHint: '横画面推奨',
      fullscreenShort: '⛶ 全画面',
      installed: 'アプリモード',
    },
    en: {
      title: 'Rotate your phone sideways',
      body: 'Landscape mode makes the character and controls much larger.',
      fullscreen: '⛶ Play Fullscreen',
      install: 'Install as an App',
      iosInstall: 'In Safari, tap Share and choose “Add to Home Screen” to play without the address bar.',
      installHelp: 'Add Color Hunt to your Home Screen for a wider, address-bar-free view.',
      landscapeHint: 'Landscape recommended',
      fullscreenShort: '⛶ Fullscreen',
      installed: 'App mode',
    },
    zh: {
      title: '请将手机横屏',
      body: '横屏时角色和操作按钮会显示得更大。',
      fullscreen: '⛶ 全屏游玩',
      install: '安装为应用',
      iosInstall: '在 Safari 中点击“分享”，再选择“添加到主屏幕”，即可无地址栏游玩。',
      installHelp: '添加到主屏幕后可获得更宽、更接近 App 的无地址栏体验。',
      landscapeHint: '推荐横屏',
      fullscreenShort: '⛶ 全屏',
      installed: '应用模式',
    },
  }[language];

  document.documentElement.classList.add(
    'colorhunt-mobile',
  );

  const getViewport = () => ({
    width:
      window.visualViewport?.width ??
      window.innerWidth,
    height:
      window.visualViewport?.height ??
      window.innerHeight,
  });

  const isPortrait = () => {
    const { width, height } = getViewport();
    return height > width;
  };

  let deferredPrompt = null;
  let installMessageTimer = null;

  const overlay = document.createElement('div');
  overlay.id = 'colorhunt-orientation-overlay';
  overlay.innerHTML = `
    <div class="ch-rotate-card" role="dialog" aria-modal="true">
      <div class="ch-rotate-phone" aria-hidden="true">📱↻</div>
      <h2>${copy.title}</h2>
      <p>${copy.body}</p>
      <div class="ch-rotate-actions">
        <button type="button" data-ch-fullscreen>${copy.fullscreen}</button>
        <button type="button" data-ch-install>${copy.install}</button>
      </div>
      <p class="ch-install-help" data-ch-help>${copy.installHelp}</p>
    </div>
  `;

  const fullscreenChip = document.createElement('button');
  fullscreenChip.type = 'button';
  fullscreenChip.id = 'colorhunt-fullscreen-chip';
  fullscreenChip.textContent =
    standalone
      ? `✓ ${copy.installed}`
      : copy.fullscreenShort;

  document.body.appendChild(overlay);
  document.body.appendChild(fullscreenChip);

  const help =
    overlay.querySelector('[data-ch-help]');

  const fullscreenButtons = [
    overlay.querySelector('[data-ch-fullscreen]'),
    fullscreenChip,
  ].filter(Boolean);

  const installButton =
    overlay.querySelector('[data-ch-install]');

  let rotateHintTimer = null;

  function showInAppRotateHint() {
    let hint =
      document.getElementById(
        'colorhunt-inapp-rotate-hint',
      );

    if (!hint) {
      hint = document.createElement('div');
      hint.id =
        'colorhunt-inapp-rotate-hint';

      hint.innerHTML = `
        <div class="ch-inapp-rotate-card">
          <div class="ch-inapp-rotate-icon" aria-hidden="true">📱↻</div>
          <strong>${language === 'ja'
            ? 'スマホを横向きにしてください'
            : language === 'zh'
              ? '请将手机横向旋转'
              : '휴대폰을 가로로 돌려주세요'}</strong>
          <span>${language === 'ja'
            ? '画面が回転しない場合は、スマホの自動回転（横画面）をオンにしてください。'
            : language === 'zh'
              ? '如果画面没有旋转，请开启手机的自动旋转（横屏模式）。'
              : '화면이 돌아가지 않으면 휴대폰의 자동 회전(가로 모드)을 켜주세요.'}</span>
          <button type="button" data-ch-rotate-close>
            ${language === 'ja'
              ? '確認'
              : language === 'zh'
                ? '确认'
                : '확인'}
          </button>
        </div>
      `;

      const style =
        document.createElement('style');
      style.id =
        'colorhunt-inapp-rotate-hint-style';
      style.textContent = `
        #colorhunt-inapp-rotate-hint {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          background: rgba(4, 24, 15, .72);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
        }
        #colorhunt-inapp-rotate-hint .ch-inapp-rotate-card {
          width: min(88vw, 380px);
          box-sizing: border-box;
          border: 3px solid #315f3e;
          border-radius: 18px;
          padding: 22px 20px 18px;
          background: #f8fff0;
          color: #183522;
          box-shadow: 0 16px 44px rgba(0,0,0,.28);
          text-align: center;
          font-family: inherit;
        }
        #colorhunt-inapp-rotate-hint .ch-inapp-rotate-icon {
          margin-bottom: 10px;
          font-size: 42px;
          line-height: 1;
        }
        #colorhunt-inapp-rotate-hint strong {
          display: block;
          margin-bottom: 9px;
          font-size: 20px;
          line-height: 1.35;
        }
        #colorhunt-inapp-rotate-hint span {
          display: block;
          font-size: 13px;
          line-height: 1.55;
          opacity: .78;
        }
        #colorhunt-inapp-rotate-hint button {
          width: 100%;
          margin-top: 16px;
          border: 0;
          border-radius: 11px;
          padding: 12px 16px;
          background: #48bd70;
          color: #fff;
          font: inherit;
          font-weight: 800;
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(hint);

      hint.querySelector(
        '[data-ch-rotate-close]',
      )?.addEventListener(
        'click',
        () => {
          hint?.remove();
        },
      );
    }

    if (rotateHintTimer) {
      clearTimeout(rotateHintTimer);
    }

    rotateHintTimer =
      setTimeout(
        () => {
          document.getElementById(
            'colorhunt-inapp-rotate-hint',
          )?.remove();
        },
        9000,
      );
  }

  async function requestFullscreenLandscape() {
    const root =
      document.documentElement;

    try {
      if (
        !document.fullscreenElement &&
        !document.webkitFullscreenElement
      ) {
        const requestFullscreen =
          root.requestFullscreen?.bind(root) ||
          root.webkitRequestFullscreen?.bind(root) ||
          root.msRequestFullscreen?.bind(root);

        if (requestFullscreen) {
          const result =
            requestFullscreen.length > 0
              ? requestFullscreen({
                  navigationUI: 'hide',
                })
              : requestFullscreen();

          if (
            result &&
            typeof result.then === 'function'
          ) {
            await result;
          }
        }
      }
    } catch {
      // In-app WebViews may reject fullscreen.
    }

    let lockSucceeded = false;

    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock(
          'landscape',
        );
        lockSucceeded = true;
      }
    } catch {
      lockSucceeded = false;
    }

    if (!lockSucceeded) {
      try {
        const legacyLock =
          screen.lockOrientation ||
          screen.mozLockOrientation ||
          screen.msLockOrientation;

        if (legacyLock) {
          lockSucceeded =
            legacyLock.call(
              screen,
              'landscape',
            ) !== false;
        }
      } catch {
        lockSucceeded = false;
      }
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 220),
    );

    const viewport =
      getViewport();
    const physicallyLandscape =
      viewport.width >= viewport.height;

    /*
     * Never rotate/scale #root with CSS.
     * KakaoTalk and similar WebViews can keep a portrait viewport, which made
     * the whole game tiny. If the browser refuses orientation lock, keep the
     * normal responsive layout and show a short manual-rotation hint instead.
     */
    if (
      !physicallyLandscape &&
      (!lockSucceeded || inAppBrowser)
    ) {
      showInAppRotateHint();
    }

    syncViewport();
  }

  fullscreenButtons.forEach((button) => {
    button.addEventListener(
      'click',
      requestFullscreenLandscape,
      { passive: true },
    );
  });

  window.addEventListener(
    'beforeinstallprompt',
    (event) => {
      event.preventDefault();
      deferredPrompt = event;
      if (installButton) {
        installButton.hidden = false;
      }
    },
  );

  installButton?.addEventListener(
    'click',
    async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();

        try {
          await deferredPrompt.userChoice;
        } catch {}

        deferredPrompt = null;
        return;
      }

      if (help) {
        help.textContent =
          isIOS
            ? copy.iosInstall
            : copy.installHelp;

        help.classList.add(
          'ch-install-help--active',
        );

        if (installMessageTimer) {
          clearTimeout(
            installMessageTimer,
          );
        }

        installMessageTimer =
          setTimeout(
            () => {
              help.classList.remove(
                'ch-install-help--active',
              );
            },
            9000,
          );
      }
    },
  );

  if (
    standalone &&
    installButton
  ) {
    installButton.hidden = true;
  }

  function syncViewport() {
    const viewport = getViewport();

    document.documentElement.style.setProperty(
      '--ch-viewport-width',
      `${Math.round(viewport.width)}px`,
    );

    document.documentElement.style.setProperty(
      '--ch-viewport-height',
      `${Math.round(viewport.height)}px`,
    );

    const portrait =
      isPortrait();

    overlay.classList.toggle(
      'ch-visible',
      portrait,
    );

    fullscreenChip.classList.toggle(
      'ch-visible',
      !portrait &&
      !standalone &&
      !document.fullscreenElement,
    );

    document.body.classList.toggle(
      'colorhunt-landscape',
      !portrait,
    );

    window.dispatchEvent(
      new CustomEvent(
        'colorhunt:viewportchange',
        {
          detail: {
            ...viewport,
            portrait,
            fullscreen:
              Boolean(
                document.fullscreenElement,
              ),
            standalone,
          },
        },
      ),
    );
  }

  let viewportTimer = 0;

  function scheduleSync() {
    clearTimeout(viewportTimer);
    viewportTimer =
      setTimeout(
        syncViewport,
        40,
      );
  }

  window.addEventListener(
    'orientationchange',
    () => {
      window.setTimeout(
        syncViewport,
        120,
      );
    },
    { passive: true },
  );

  window.addEventListener(
    'resize',
    scheduleSync,
    { passive: true },
  );

  window.addEventListener(
    'orientationchange',
    () => {
      scheduleSync();
      setTimeout(
        syncViewport,
        180,
      );
      setTimeout(
        syncViewport,
        520,
      );
    },
    { passive: true },
  );

  screen.orientation?.addEventListener?.(
    'change',
    scheduleSync,
  );

  window.visualViewport?.addEventListener(
    'resize',
    scheduleSync,
    { passive: true },
  );

  window.visualViewport?.addEventListener(
    'scroll',
    scheduleSync,
    { passive: true },
  );

  document.addEventListener(
    'fullscreenchange',
    scheduleSync,
  );

  syncViewport();

  if (
    'serviceWorker' in navigator &&
    window.isSecureContext
  ) {
    window.addEventListener(
      'load',
      () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch(() => {
            // PWA support is optional; the game must still run normally.
          });
      },
      { once: true },
    );
  }
})();
