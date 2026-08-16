(() => {
  'use strict';

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

  async function requestFullscreenLandscape() {
    try {
      const root =
        document.documentElement;

      if (
        !document.fullscreenElement &&
        root.requestFullscreen
      ) {
        await root.requestFullscreen({
          navigationUI: 'hide',
        });
      }
    } catch {
      // iOS Safari may not allow document fullscreen. Orientation UI still works.
    }

    try {
      if (
        screen.orientation?.lock
      ) {
        await screen.orientation.lock(
          'landscape',
        );
      }
    } catch {
      // Orientation lock is best-effort only.
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
