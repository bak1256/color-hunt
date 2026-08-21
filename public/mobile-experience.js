(() => {
  'use strict';

  /* V1010372_INAPP_LANDSCAPE_FALLBACK: Kakao/messenger fullscreen + virtual landscape fallback. */

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

  let virtualLandscape = false;

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
    if (virtualLandscape) {
      return false;
    }

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

  const virtualLandscapeStyle =
    document.createElement('style');

  virtualLandscapeStyle.id =
    'colorhunt-virtual-landscape-style';

  virtualLandscapeStyle.textContent = `
    html.ch-virtual-landscape,
    html.ch-virtual-landscape body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      min-width: 100vw !important;
      min-height: 100vh !important;
      overflow: hidden !important;
      background: #000 !important;
      overscroll-behavior: none !important;
      touch-action: none !important;
    }

    html.ch-virtual-landscape body > #root {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 100vh !important;
      height: 100vw !important;
      min-width: 100vh !important;
      min-height: 100vw !important;
      max-width: none !important;
      max-height: none !important;
      transform-origin: 0 0 !important;
      transform: translateX(100vw) rotate(90deg) !important;
      overflow: hidden !important;
      z-index: 1 !important;
    }

    html.ch-virtual-landscape #colorhunt-orientation-overlay {
      display: none !important;
    }

    html.ch-virtual-landscape #colorhunt-fullscreen-chip {
      display: none !important;
    }
  `;

  document.head.appendChild(
    virtualLandscapeStyle,
  );

  function enableVirtualLandscape() {
    if (
      !isPortrait() &&
      !virtualLandscape
    ) {
      return;
    }

    virtualLandscape = true;

    document.documentElement
      .classList.add(
        'ch-virtual-landscape',
      );

    /*
     * Tell Phaser/DOM overlays that the effective play stage changed.
     * The CSS transform itself does not require an OS orientation change.
     */
    window.dispatchEvent(
      new Event('resize'),
    );

    window.dispatchEvent(
      new Event(
        'colorhunt:viewportchange',
      ),
    );

    requestAnimationFrame(
      () => {
        window.dispatchEvent(
          new Event('resize'),
        );
      },
    );
  }

  function disableVirtualLandscape() {
    if (!virtualLandscape) {
      return;
    }

    virtualLandscape = false;

    document.documentElement
      .classList.remove(
        'ch-virtual-landscape',
      );

    window.dispatchEvent(
      new Event('resize'),
    );

    window.dispatchEvent(
      new Event(
        'colorhunt:viewportchange',
      ),
    );
  }

  async function requestFullscreenLandscape() {
    /*
     * V1010372_INAPP_LANDSCAPE_FALLBACK:
     * 1) standards/legacy fullscreen
     * 2) standards/legacy orientation lock
     * 3) Kakao/other WebView CSS landscape fallback
     */
    let fullscreenEntered =
      Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement,
      );

    let orientationLocked = false;

    const root =
      document.documentElement;

    try {
      if (!fullscreenEntered) {
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

          fullscreenEntered =
            Boolean(
              document.fullscreenElement ||
              document.webkitFullscreenElement,
            );
        }
      }
    } catch {
      fullscreenEntered = false;
    }

    /*
     * Some Android WebViews only accept orientation lock immediately after
     * the user gesture, while others require fullscreen first. Try both the
     * modern and legacy APIs.
     */
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock(
          'landscape',
        );
        orientationLocked = true;
      }
    } catch {
      orientationLocked = false;
    }

    if (!orientationLocked) {
      try {
        const legacyLock =
          screen.lockOrientation ||
          screen.mozLockOrientation ||
          screen.msLockOrientation;

        if (legacyLock) {
          orientationLocked =
            legacyLock.call(
              screen,
              'landscape',
            ) !== false;
        }
      } catch {
        orientationLocked = false;
      }
    }

    /*
     * Give a real orientation change a brief moment to materialize before
     * deciding that the in-app browser needs virtual landscape.
     */
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 180),
    );

    const physicallyLandscape =
      (
        window.visualViewport?.width ??
        window.innerWidth
      ) >=
      (
        window.visualViewport?.height ??
        window.innerHeight
      );

    if (
      physicallyLandscape ||
      orientationLocked
    ) {
      disableVirtualLandscape();
    } else if (
      inAppBrowser ||
      !fullscreenEntered
    ) {
      enableVirtualLandscape();
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
        () => {
          const viewport =
            getViewport();

          if (
            viewport.width >=
            viewport.height
          ) {
            disableVirtualLandscape();
          }

          syncViewport();
        },
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
