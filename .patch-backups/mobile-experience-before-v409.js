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
      alreadyInstalled: '✓ 이미 설치됨',
      alreadyInstalledHelp: '이미 설치되어 있습니다. 홈 화면의 Color Hunt를 실행해주세요.',
      installUnavailable: '설치 창이 열리지 않으면 이미 설치되어 있거나, 현재 브라우저가 직접 설치를 지원하지 않는 상태일 수 있어요.',
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
      alreadyInstalled: '✓ インストール済み',
      alreadyInstalledHelp: 'すでにインストールされています。ホーム画面の Color Hunt を起動してください。',
      installUnavailable: 'インストール画面が開かない場合は、すでにインストール済みか、現在のブラウザが直接インストールに対応していない可能性があります。',
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
      alreadyInstalled: '✓ Already installed',
      alreadyInstalledHelp: 'Color Hunt is already installed. Launch it from your Home Screen.',
      installUnavailable: 'If no install prompt appears, the app may already be installed or this browser may not support direct installation.',
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
      alreadyInstalled: '✓ 已安装',
      alreadyInstalledHelp: 'Color Hunt 已安装，请从主屏幕启动。',
      installUnavailable: '如果没有弹出安装窗口，可能已经安装，或当前浏览器不支持直接安装。',
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

  /*
   * v0.10.10.101:
   * visualViewport shrinks when a soft keyboard opens. That must NOT resize
   * the Phaser game or body. Keep a stable game viewport and use the shrunken
   * visualViewport only for positioning the chat composer.
   */
  let stableGameWidth =
    window.visualViewport?.width ?? window.innerWidth;

  let stableGameHeight =
    window.visualViewport?.height ?? window.innerHeight;

  let stableViewportLeft =
    window.visualViewport?.offsetLeft ?? 0;

  let stableViewportTop =
    window.visualViewport?.offsetTop ?? 0;

  const isChatInputFocused = () => {
    const active =
      document.activeElement;

    return Boolean(
      active?.classList?.contains(
        'colorhunt-chat__input',
      ) &&
      active.closest?.(
        '.colorhunt-chat--focused',
      ),
    );
  };

  const getKeyboardOffset = () => {
    const viewport =
      window.visualViewport;

    if (!viewport) {
      return 0;
    }

    return Math.max(
      0,
      window.innerHeight -
        viewport.height -
        viewport.offsetTop,
    );
  };

  const isSoftKeyboardOpen = () =>
    isChatInputFocused() &&
    getKeyboardOffset() > 80;

  const viewportProfile = () => {
    const { width, height } = getViewport();
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const portrait = height > width;
    const aspect =
      longSide /
      Math.max(1, shortSide);

    /*
     * v0.10.10.116:
     * Near-square large touch viewports are treated as an unfolded Fold/tablet.
     * Folded/normal phones prefer landscape; unfolded Fold/tablet prefers
     * portrait, while remaining playable if orientation lock is unavailable.
     */
    const unfoldedLike =
      navigator.maxTouchPoints > 0 &&
      shortSide >= 600 &&
      aspect <= 1.48;

    const largeFormFactor =
      unfoldedLike ||
      shortSide >= 700 ||
      width >= 760 ||
      (
        navigator.maxTouchPoints > 0 &&
        longSide >= 1000 &&
        shortSide >= 620
      );

    const compactPortrait =
      portrait &&
      !largeFormFactor &&
      width < 720;

    const preferredOrientation =
      unfoldedLike
        ? 'portrait-primary'
        : 'landscape';

    return {
      width,
      height,
      portrait,
      compactPortrait,
      largeFormFactor,
      unfoldedLike,
      preferredOrientation,
    };
  };

  let deferredPrompt = null;
  let installMessageTimer = null;

  const installStorageKey =
    'colorhunt:pwa-installed';

  let installedKnown =
    standalone ||
    localStorage.getItem(installStorageKey) === '1';

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

  const showInstallHelp = (message) => {
    if (!help) {
      return;
    }

    help.textContent = message;
    help.classList.add('ch-install-help--active');

    if (installMessageTimer) {
      clearTimeout(installMessageTimer);
    }

    installMessageTimer = setTimeout(() => {
      help.classList.remove('ch-install-help--active');
    }, 9000);
  };

  const renderInstallState = () => {
    if (!installButton) {
      return;
    }

    if (installedKnown) {
      installButton.hidden = false;
      installButton.disabled = false;
      installButton.classList.add('is-installed');
      installButton.textContent = copy.alreadyInstalled;
      return;
    }

    installButton.classList.remove('is-installed');
    installButton.textContent = copy.install;
  };

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
      const profile =
        viewportProfile();

      if (
        screen.orientation?.lock
      ) {
        await screen.orientation.lock(
          profile.preferredOrientation,
        );
      }
    } catch {
      // Orientation lock is best-effort only.
    }

    settleViewport();
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
      installedKnown = false;
      renderInstallState();
    },
  );

  window.addEventListener(
    'appinstalled',
    () => {
      deferredPrompt = null;
      installedKnown = true;
      localStorage.setItem(installStorageKey, '1');
      renderInstallState();
      showInstallHelp(copy.alreadyInstalledHelp);
    },
  );

  installButton?.addEventListener(
    'click',
    async () => {
      if (installedKnown) {
        showInstallHelp(copy.alreadyInstalledHelp);
        return;
      }

      if (deferredPrompt) {
        deferredPrompt.prompt();

        try {
          const choice = await deferredPrompt.userChoice;
          if (choice?.outcome === 'accepted') {
            installedKnown = true;
            localStorage.setItem(installStorageKey, '1');
            renderInstallState();
            showInstallHelp(copy.alreadyInstalledHelp);
          }
        } catch {}

        deferredPrompt = null;
        return;
      }

      showInstallHelp(
        isIOS
          ? copy.iosInstall
          : copy.installUnavailable,
      );
    },
  );

  renderInstallState();

  let lastPreferredOrientation = '';

  async function syncPreferredOrientation(profile) {
    if (
      !screen.orientation?.lock ||
      profile.preferredOrientation ===
        lastPreferredOrientation
    ) {
      return;
    }

    lastPreferredOrientation =
      profile.preferredOrientation;

    try {
      await screen.orientation.lock(
        profile.preferredOrientation,
      );
    } catch {
      // Normal browser tabs may reject orientation lock. Layout still adapts.
    }
  }

  function syncViewport() {
    const keyboardOpen =
      isSoftKeyboardOpen();

    /*
     * Only accept a new GAME viewport while the keyboard is closed.
     * orientation/fullscreen changes still update normally.
     */
    if (!keyboardOpen) {
      const viewport = window.visualViewport;

      stableGameWidth =
        viewport?.width ?? window.innerWidth;

      stableGameHeight =
        viewport?.height ?? window.innerHeight;

      stableViewportLeft =
        viewport?.offsetLeft ?? 0;

      stableViewportTop =
        viewport?.offsetTop ?? 0;
    }

    const measuredProfile =
      viewportProfile();

    const profile =
      keyboardOpen
        ? {
            ...measuredProfile,
            width:
              stableGameWidth,
            height:
              stableGameHeight,
            portrait:
              stableGameHeight >
              stableGameWidth,
          }
        : measuredProfile;

    document.documentElement.style.setProperty(
      '--ch-viewport-width',
      `${Math.round(
        stableGameWidth,
      )}px`,
    );

    document.documentElement.style.setProperty(
      '--ch-viewport-height',
      `${Math.round(
        stableGameHeight,
      )}px`,
    );

    document.documentElement.style.setProperty(
      '--ch-viewport-left',
      `${Math.round(stableViewportLeft)}px`,
    );

    document.documentElement.style.setProperty(
      '--ch-viewport-top',
      `${Math.round(stableViewportTop)}px`,
    );

    /*
     * Show the rotate overlay ONLY for narrow phone-like portrait screens.
     * Large Fold/tablet portrait layouts remain playable.
     */
    overlay.classList.toggle(
      'ch-visible',
      profile.compactPortrait,
    );

    fullscreenChip.classList.toggle(
      'ch-visible',
      !profile.compactPortrait &&
      !standalone &&
      !document.fullscreenElement,
    );

    document.body.classList.toggle(
      'colorhunt-landscape',
      !profile.portrait,
    );

    document.body.classList.toggle(
      'colorhunt-large-mobile',
      profile.largeFormFactor,
    );

    document.body.classList.toggle(
      'colorhunt-unfolded',
      profile.unfoldedLike,
    );

    if (!keyboardOpen) {
      void syncPreferredOrientation(profile);
      window.dispatchEvent(
        new CustomEvent(
          'colorhunt:viewportchange',
          {
            detail: {
              width:
                profile.width,
              height:
                profile.height,
              portrait:
                profile.portrait,
              compactPortrait:
                profile.compactPortrait,
              largeFormFactor:
                profile.largeFormFactor,
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
  }

  let viewportTimer = 0;
  let settleGeneration = 0;

  function settleViewport() {
    const generation = ++settleGeneration;
    const delays = [0, 60, 140, 280, 520, 900, 1400];

    delays.forEach((delay) => {
      setTimeout(() => {
        if (generation !== settleGeneration) {
          return;
        }
        syncViewport();
      }, delay);
    });
  }

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
      settleViewport();
    },
    { passive: true },
  );

  screen.orientation?.addEventListener?.(
    'change',
    settleViewport,
  );

  window.visualViewport?.addEventListener(
    'resize',
    () => {
      /*
       * Chat itself listens to visualViewport and moves above the keyboard.
       * Skip game viewport resizing while the chat keyboard is open.
       */
      if (
        !isSoftKeyboardOpen()
      ) {
        scheduleSync();
      }
    },
    { passive: true },
  );

  window.visualViewport?.addEventListener(
    'scroll',
    () => {
      if (
        !isSoftKeyboardOpen()
      ) {
        scheduleSync();
      }
    },
    { passive: true },
  );

  document.addEventListener(
    'fullscreenchange',
    settleViewport,
  );

  syncViewport();
  settleViewport();

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
