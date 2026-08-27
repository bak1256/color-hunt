            /*
             * V1010521J_HIDER_POSTER_TRUE_RING_STRUCTURAL
             *
             * The colored Hider already exists in the captured victory screenshot.
             * NEVER paint another Hider body here.
             *
             * Build an alpha silhouette only, dilate it by one output pixel,
             * subtract the original silhouette, and composite ONLY that outside ring.
             */
            const outlineSessionId =
                multiplayerClient.getSessionId();

            if (outlineSessionId) {
                const paintedAvatar =
                    this.buildVictoryPaintedHiderCanvas(
                        outlineSessionId,
                    );

                const srcContext =
                    paintedAvatar.getContext('2d');

                if (srcContext) {
                    const pixels =
                        srcContext.getImageData(
                            0,
                            0,
                            paintedAvatar.width,
                            paintedAvatar.height,
                        );

                    let minX = paintedAvatar.width;
                    let minY = paintedAvatar.height;
                    let maxX = -1;
                    let maxY = -1;

                    for (let y = 0; y < paintedAvatar.height; y += 1) {
                        for (let x = 0; x < paintedAvatar.width; x += 1) {
                            const alpha =
                                pixels.data[
                                    (y * paintedAvatar.width + x) * 4 + 3
                                ];

                            if (alpha === 0) {
                                continue;
                            }

                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }

                    if (maxX >= minX && maxY >= minY) {
                        /*
                         * captureVictoryFrameForRoleShowcase() uses 4.9x for Hider.
                         * The poster then scales the captured source rectangle into
                         * frameW/frameH. Reproduce that exact transform.
                         */
                        const captureZoom = 4.9;
                        const scaleX =
                            captureZoom *
                            frameW /
                            Math.max(1, sourceW);
                        const scaleY =
                            captureZoom *
                            frameH /
                            Math.max(1, sourceH);

                        const drawW =
                            paintedAvatar.width * scaleX;
                        const drawH =
                            paintedAvatar.height * scaleY;

                        const alphaCenterX =
                            (minX + maxX + 1) / 2;
                        const alphaCenterY =
                            (minY + maxY + 1) / 2;

                        const drawX =
                            frameX +
                            frameW / 2 -
                            alphaCenterX * scaleX;
                        const drawY =
                            frameY +
                            frameH / 2 -
                            alphaCenterY * scaleY;

                        const mask =
                            document.createElement('canvas');
                        mask.width = paintedAvatar.width;
                        mask.height = paintedAvatar.height;

                        const maskContext =
                            mask.getContext('2d');

                        if (maskContext) {
                            maskContext.drawImage(
                                paintedAvatar,
                                0,
                                0,
                            );
                            maskContext.globalCompositeOperation =
                                'source-in';
                            maskContext.fillStyle = '#ffffff';
                            maskContext.fillRect(
                                0,
                                0,
                                mask.width,
                                mask.height,
                            );

                            /*
                             * Work at FINAL poster resolution. Therefore ±1 here is
                             * exactly a 1px poster outline, not 4.9px.
                             */
                            const pad = 2;
                            const ring =
                                document.createElement('canvas');
                            ring.width =
                                Math.max(
                                    1,
                                    Math.ceil(drawW) + pad * 2,
                                );
                            ring.height =
                                Math.max(
                                    1,
                                    Math.ceil(drawH) + pad * 2,
                                );

                            const ringContext =
                                ring.getContext('2d');

                            if (ringContext) {
                                ringContext.imageSmoothingEnabled = false;

                                const offsets = [
                                    [-1, -1],
                                    [0, -1],
                                    [1, -1],
                                    [-1, 0],
                                    [1, 0],
                                    [-1, 1],
                                    [0, 1],
                                    [1, 1],
                                ] as const;

                                offsets.forEach(([ox, oy]) => {
                                    ringContext.drawImage(
                                        mask,
                                        pad + ox,
                                        pad + oy,
                                        drawW,
                                        drawH,
                                    );
                                });

                                /*
                                 * Critical fix:
                                 * remove ALL pixels belonging to the Hider itself.
                                 * Only the outside one-pixel ring survives.
                                 */
                                ringContext.globalCompositeOperation =
                                    'destination-out';
                                ringContext.globalAlpha = 1;
                                ringContext.drawImage(
                                    mask,
                                    pad,
                                    pad,
                                    drawW,
                                    drawH,
                                );

                                ringContext.globalCompositeOperation =
                                    'source-over';

                                context.save();
                                context.globalAlpha = 0.70;
                                context.imageSmoothingEnabled = false;
                                context.drawImage(
                                    ring,
                                    drawX - pad,
                                    drawY - pad,
                                );
                                context.restore();
                            }
                        }
                    }
                }
            }

            const survivorX =
                frameX +
                frameW / 2;

            /*
             * Character is centered and enlarged by the capture camera.
             * Keep the badge well above its head so the two never overlap.
             */
            const badgeY =
                frameY +
                frameH / 2 -
                238;
            const badgeW = 204;
            const badgeH = 44;
            const badgeX =
                survivorX -
                badgeW / 2;

            context.save();
            context.shadowColor =
                'rgba(49,159,97,.28)';
            context.shadowBlur = 18;
            context.fillStyle =
                'rgba(55,174,103,.92)';
            context.beginPath();
            context.roundRect(
                badgeX,
                badgeY,
                badgeW,
                badgeH,
                22,
            );
            context.fill();

            context.shadowBlur = 0;
            context.strokeStyle =
                'rgba(255,255,255,.88)';
            context.lineWidth = 3;
            context.stroke();

            context.fillStyle =
                '#ffffff';
            context.font =
                '900 19px Arial, sans-serif';
            context.textAlign =
                'center';
            context.textBaseline =
                'middle';
            context.fillText(
                'YOU SURVIVED',
                survivorX,
                badgeY +
                    badgeH / 2 +
                    1,
            );

            context.fillStyle =
                '#ffd45f';
            context.font =
                '900 62px Arial, sans-serif';
            context.fillText(
                '♛',
                survivorX,
                badgeY - 42,
            );

            context.restore();
        }

        /*
         * Hunter: ONLY this local Hunter's actual catches get FOUND markers.
         * No revealedHiders fallback, no circle/# for Hiders found by teammates.
         */
        /*
         * V1010439G_MEMORY_PANEL_Y_RELOCATE
         * Shared Y anchor for MATCH MEMORY / MY CAMOUFLAGE / FOUND summary.
         * Defined at statement scope, never inside another initializer.
         */
        /*
         * V1010440E_AUDITED_FOUND_GALLERY
         * Current source has no old foundOrder/paintedAvatar marker loop.
         * Draw the personalized FOUND set directly from displayedFound.
         */
        if (
            isHunter &&
            displayedFound.length > 0
        ) {
            /*
             * V1010451E2_TERMINAL_REJOIN_AND_FOUND_POSITIONS_ROBUST / FOUND_AT_AUTHORITATIVE_POSITION
             * marker.x / marker.y are server-captured target coordinates from
             * the exact moment the Hider was found.
             */
            const foundCount =
                displayedFound.length;

            void foundCount;

            displayedFound.forEach(
                (
                    marker,
                    index,
                ) => {
                    const markerX =
                        Math.max(
                            0,
                            Math.min(
                                this.gameWidth,
                                Number(
                                    marker.x,
                                ) || 0,
                            ),
                        );
                    const markerY =
                        Math.max(
                            0,
                            Math.min(
                                this.gameHeight,
                                Number(
                                    marker.y,
                                ) || 0,
                            ),
                        );

                    const mx =
                        frameX +
                        markerX /
                            Math.max(
                                1,
                                this.gameWidth,
                            ) *
                            frameW;
                    const my =
                        frameY +
                        markerY /
                            Math.max(
                                1,
                                this.gameHeight,
                            ) *
                            frameH;

                    const foundAvatar =
                        this.buildVictoryPaintedHiderCanvas(
                            marker.sessionId,
                            marker.paintStrokes,
                        );

                    context.save();
                    context.globalAlpha = 1;

                    /*
                     * Soft white portrait card so camouflage never disappears
                     * into the captured map/background.
                     */
                    context.shadowColor =
                        'rgba(35,39,43,.16)';
                    context.shadowBlur = 14;
                    /*
                     * V1010450ZE_HUNTER_CARD_TRANSLUCENT_HIDER_TILES
                     * Let a little of the captured map show through each Hider
                     * result tile instead of covering it with solid white.
                     */
                    /*
                     * V1010451F_ASSIST_CAPTURE_TERMINAL_CLEANUP_CARD_POLISH / CLEARER_FOUND_BACKGROUND
                     * Keep the commemorative glass tile, but expose enough of
                     * the map to immediately understand where the Hider hid.
                     */
                    context.fillStyle =
                        'rgba(255,255,255,.34)';
                    context.beginPath();
                    context.roundRect(
                        mx - 62,
                        my - 82,
                        124,
                        174,
                        24,
                    );
                    context.fill();
                    context.shadowBlur = 0;

                    context.imageSmoothingEnabled =
                        false;
                    context.drawImage(
                        foundAvatar,
                        mx - 48,
                        my - 72,
                        96,
                        144,
                    );

                    /*
                     * Strong red target ring + white inner ring.
                     */
                    context.shadowColor =
                        'rgba(217,54,48,.48)';
                    context.shadowBlur = 16;
                    context.strokeStyle =
                        '#d93630';
                    context.lineWidth = 9;
                    context.beginPath();
                    context.arc(
                        mx,
                        my,
                        57,
                        0,
                        Math.PI * 2,
                    );
                    context.stroke();

                    context.shadowBlur = 0;
                    context.strokeStyle =
                        '#ffffff';
                    context.lineWidth = 3;
                    context.beginPath();
                    context.arc(
                        mx,
                        my,
                        48,
                        0,
                        Math.PI * 2,
                    );
                    context.stroke();

                    /*
                     * Preserve authoritative server numbering.  A shotgun
                     * multi-hit therefore keeps each Hider's own foundOrder.
                     */
                    const order =
                        Number(
                            marker.foundOrder,
                        ) ||
                        index + 1;

                    context.fillStyle =
                        '#d93630';
                    context.beginPath();
                    context.arc(
                        mx + 48,
                        my - 57,
                        24,
                        0,
                        Math.PI * 2,
                    );
                    context.fill();

                    context.fillStyle =
                        '#ffffff';
                    context.font =
                        '900 20px Arial, sans-serif';
                    context.textAlign =
                        'center';
                    context.textBaseline =
                        'middle';
                    context.fillText(
                        '#' +
                            String(
                                order,
                            ),
                        mx + 48,
                        my - 56,
                    );

                    context.fillStyle =
                        '#25292d';
                    context.font =
                        '900 15px Arial, sans-serif';
                    context.textAlign =
                        'center';
                    context.textBaseline =
                        'alphabetic';
                    context.fillText(
                        String(
                            marker.name ??
                                'Hider',
                        ).slice(
                            0,
                            13,
                        ),
                        mx,
                        my + 88,
                    );

                    context.restore();
                },
            );
        }

        const memoryPanelY =
            isHunter
                ? 814
                : 1104;

        /*
         * V1010451M4_VICTORY_ACHIEVEMENT_BADGES / HIDER_PAINT_ACHIEVEMENT
         * Collectible medal + ribbon. Rookie is cute/soft; Master is richer
         * and more prestigious. Hunter cards still never show paint badges.
         */
        if (!isHunter) {
            this.drawHiderPaintAchievementBadge(
                context,
                176,
                memoryPanelY + 2,
            );
        }

        /*
         * V1010440F_HIDER_NICKNAME_SCOPE_FIX
         * Hider nickname belongs to the victory-card memory area, where
         * isHunter/accent/localPlayerName/memoryPanelY are all valid.
         */
        if (!isHunter) {
            context.save();
            context.fillStyle =
                accent;
            context.font =
                '900 20px Arial, sans-serif';
            context.textAlign =
                'left';
            context.textBaseline =
                'alphabetic';
            context.fillText(
                '@' + localPlayerName,
                88,
                memoryPanelY + 106,
            );
            context.restore();
        }

        if (isHunter) {
            const hunterPaintAvatar =
                this.buildVictoryPaintedHiderCanvas(
                    localSessionId,
                );

            /*
             * V1010440E_AUDITED_DIRECT_FOUND_GALLERY / HUNTER_CAMO_SHOWCASE
             * Larger self-camouflage with nickname.
             */
            const camoCardX = 410;
            const camoCardY =
                memoryPanelY - 22;
            const camoCardW = 405;
            const camoCardH = 230;

            context.save();

            context.fillStyle =
                'rgba(255,255,255,.98)';
            context.strokeStyle =
                'rgba(37,41,45,.16)';
            context.lineWidth = 3;
            context.beginPath();
            context.roundRect(
                camoCardX,
                camoCardY,
                camoCardW,
                camoCardH,
                30,
            );
            context.fill();
            context.stroke();

            context.fillStyle =
                '#777d82';
            context.font =
                '900 15px Arial, sans-serif';
            context.textAlign =
                'left';
            context.fillText(
                'MY CAMOUFLAGE',
                camoCardX + 20,
                camoCardY + 31,
            );

            context.fillStyle =
                '#25292d';
            context.font =
                '900 25px Arial, sans-serif';
            context.fillText(
                localPlayerName,
                camoCardX + 20,
                camoCardY + 63,
            );

            context.fillStyle =
                accent;
            context.font =
                '900 17px Arial, sans-serif';
            context.fillText(
                language === 'ko'
                    ? '내 위장 자랑!'
                    : language === 'ja'
                        ? 'マイ迷彩'
                        : 'MY LOOK',
                camoCardX + 20,
                camoCardY + 91,
            );

            context.imageSmoothingEnabled =
                false;
            context.globalAlpha = 1;
            /*
             * V1010451F_ASSIST_CAPTURE_TERMINAL_CLEANUP_CARD_POLISH / BIGGER_HUNTER_SELF_CAMO
             * Keep the approved card dimensions; enlarge only the avatar.
             */
            context.save();
            context.beginPath();
            context.roundRect(
                camoCardX + 190,
                camoCardY + 4,
                207,
                camoCardH - 8,
                22,
            );
            context.clip();

            context.drawImage(
                hunterPaintAvatar,
                camoCardX + 202,
                camoCardY - 17,
                188,
                282,
            );

            context.restore();

            context.restore();
        }

        context.textAlign =
            'right';
        context.fillStyle =
            accent;
        context.font =
            '900 30px Arial, sans-serif';
        context.fillText(
            isHunter
                ? (
                    personalAllKill
                        ? 'ALL KILL'
                        : String(
                            displayedFound.length,
                        ) + ' FOUND'
                )
                : 'SURVIVED',
            990,
            memoryPanelY + 76,
        );

        context.fillStyle =
            muted;
        context.font =
            '800 15px Arial, sans-serif';
        context.fillText(
            isHunter
                ? (
                    language === 'ko'
                        ? 'MY HUNT RECORD'
                        : 'MY HUNT RECORD'
                )
                : 'HIDE COMPLETE',
            990,
            memoryPanelY + 101,
        );

        context.textAlign =
            'left';

        const brandY =
            isHunter
                ? 1070
                : 1260;

        context.fillStyle =
            ink;
        context.font =
            '900 48px Arial, sans-serif';
        context.fillText(
            'COLOR HUNT',
            60,
            brandY,
        );

        context.fillStyle =
            muted;
        context.font =
            '700 19px Arial, sans-serif';
        context.fillText(
            'CAMOUFLAGE · HIDE · HUNT',
            62,
            brandY + 34,
        );

        context.fillStyle =
            isHunter
                ? 'rgba(239,121,95,.14)'
                : 'rgba(57,169,107,.14)';
        context.beginPath();
        context.roundRect(
            60,
            brandY + 58,
            430,
            48,
            24,
        );
        context.fill();

        context.fillStyle =
            isHunter
                ? '#b94e3d'
                : '#237c4b';
        context.font =
            '900 18px Arial, sans-serif';
        context.fillText(
            isHunter
                ? '#COLORHUNT  #HUNTERWIN'
                : '#COLORHUNT  #HIDERWIN',
            84,
            brandY + 89,
        );

        context.textAlign =
            'right';
        context.fillStyle =
            '#66727b';
        context.font =
            '700 16px Arial, sans-serif';
        context.fillText(
            this.getPracticeShareUrl()
                .replace(
                    /^https?:\/\//,
                    '',
                )
                .replace(
                    /\/$/,
                    '',
                ),
            1018,
            brandY + 88,
        );

        context.font =
            '700 14px Arial, sans-serif';
        context.fillStyle =
            'rgba(50,64,74,.50)';
        context.fillText(
            new Date()
                .toLocaleDateString(),
            1018,
            1330,
        );

        const blob =
            await new Promise<Blob | null>(
                (resolve) => {
                    canvas.toBlob(
                        resolve,
                        'image/png',
                        1,
                    );
                },
            );

        if (
            !blob ||
            captureSerial !==
                this.victoryShowcaseCaptureSerial
        ) {
            return;
        }

        this.victoryShowcaseBlob =
            blob;
        this.victoryShowcaseWinner =
            winner;

        if (
            this.phase === 'lobby' &&
            this.victoryShowcaseBlob
        ) {
            this.showMultiplayerVictoryShowcase();
        }
    }

    private downloadMultiplayerVictoryShowcase(): void {
        const blob =
            this.victoryShowcaseBlob;

        if (!blob) {
            return;
        }

        const url =
            URL.createObjectURL(blob);
        const anchor =
            document.createElement('a');

        anchor.href = url;
        anchor.download =
            'color-hunt-' +
            (
                this.victoryShowcaseWinner ===
                    'hunters'
                    ? 'hunter-victory-'
                    : 'hider-victory-'
            ) +
            Date.now() +
            '.png';

        document.body.appendChild(
            anchor,
        );
        anchor.click();
        anchor.remove();

        window.setTimeout(
            () => URL.revokeObjectURL(url),
            1_000,
        );
    }

    private showVictoryShowcaseShareFeedback(
        message: string,
    ): void {
        const modal =
            this.victoryShowcaseModal;

        if (!modal) {
            return;
        }

        const feedback =
            modal.querySelector<HTMLElement>(
                '[data-victory-feedback]',
            );

        const shareButton =
            modal.querySelector<HTMLButtonElement>(
                '[data-victory-share]',
            );

        if (feedback) {
            feedback.textContent =
                message;
            feedback.classList.add(
                'is-visible',
            );
        }

        if (shareButton) {
            const original =
                shareButton.dataset
                    .originalLabel ??
                shareButton.textContent ??
                '';

            shareButton.dataset
                .originalLabel =
                original;

            shareButton.textContent =
                '✓ ' +
                (
                    getLanguage() === 'ko'
                        ? '복사됨'
                        : 'Copied'
                );

            shareButton.disabled =
                true;

            window.setTimeout(
                () => {
                    if (
                        !shareButton
                            .isConnected
                    ) {
                        return;
                    }

                    shareButton.disabled =
                        false;
                    shareButton.textContent =
                        original;
                },
                1_800,
            );
        }

        window.setTimeout(
            () => {
                if (
                    feedback
                        ?.isConnected
                ) {
                    feedback.classList
                        .remove(
                            'is-visible',
                        );
                }
            },
            3_200,
        );
    }

    /*
     * V1010451_SHARE_AND_REJOIN_BOUNDARY / IMAGE_ONLY_SHARE
     *
     * Do not mix text/plain and image/png in one ClipboardItem. KakaoTalk and
     * some Chromium/Android clipboard bridges may choose the text flavor and
     * paste only the URL. Victory Share now means IMAGE; link sharing is a
     * separate explicit action.
     */
    private async copyVictoryImageOnlyToClipboard(
        blob: Blob,
    ): Promise<boolean> {
        try {
            const ClipboardItemCtor =
                (
                    window as unknown as {
                        ClipboardItem?: new (
                            items: Record<string, Blob>,
                        ) => unknown;
                    }
                ).ClipboardItem;

            const clipboard =
                navigator.clipboard as
                    | (
                        Clipboard & {
                            write?: (
                                items: unknown[],
                            ) => Promise<void>;
                        }
                    )
                    | undefined;

            if (
                !ClipboardItemCtor ||
                !clipboard?.write
            ) {
                return false;
            }

            await clipboard.write([
                new ClipboardItemCtor({
                    'image/png': blob,
                }),
            ]);

            return true;
        } catch {
            return false;
        }
    }

    private async copyVictoryGameLink(): Promise<void> {
        const url =
            this.getPracticeShareUrl();
        const language =
            getLanguage();

        try {
            await navigator.clipboard
                ?.writeText(url);

            this.showVictoryShowcaseShareFeedback(
                language === 'ko'
                    ? '✓ 게임 링크를 복사했어요!'
                    : language === 'ja'
                        ? '✓ ゲームリンクをコピーしました！'
                        : '✓ Game link copied!',
            );
            return;
        } catch {
            // Fall through to the synchronous clipboard fallback.
        }

        try {
            const textarea =
                document.createElement(
                    'textarea',
                );
            textarea.value = url;
            textarea.setAttribute(
                'readonly',
                '',
            );
            textarea.style.position =
                'fixed';
            textarea.style.opacity =
                '0';
            document.body.appendChild(
                textarea,
            );
            textarea.select();

            const copied =
                document.execCommand(
                    'copy',
                );
            textarea.remove();

            this.showVictoryShowcaseShareFeedback(
                copied
                    ? (
                        language === 'ko'
                            ? '✓ 게임 링크를 복사했어요!'
                            : language === 'ja'
                                ? '✓ ゲームリンクをコピーしました！'
                                : '✓ Game link copied!'
                    )
                    : (
                        language === 'ko'
                            ? '링크 복사에 실패했어요.'
                            : language === 'ja'
                                ? 'リンクのコピーに失敗しました。'
                                : 'Could not copy the game link.'
                    ),
            );
        } catch {
            this.showVictoryShowcaseShareFeedback(
                language === 'ko'
                    ? '링크 복사에 실패했어요.'
                    : language === 'ja'
                        ? 'リンクのコピーに失敗しました。'
                        : 'Could not copy the game link.',
            );
        }
    }

    private async shareMultiplayerVictoryShowcase(): Promise<void> {
        const blob =
            this.victoryShowcaseBlob;

        if (!blob) {
            return;
        }

        const isHunter =
            this.victoryShowcaseWinner ===
            'hunters';
        const language =
            getLanguage();

        const file =
            new File(
                [blob],
                isHunter
                    ? 'color-hunt-hunter-victory.png'
                    : 'color-hunt-hider-victory.png',
                {
                    type: 'image/png',
                },
            );

        const coarsePointer =
            window.matchMedia?.(
                '(pointer: coarse)',
            ).matches ??
            false;

        /*
         * Mobile: use the OS share sheet with the IMAGE FILE ONLY.
         * KakaoTalk receives an actual image attachment instead of a URL/text
         * flavor competing with image/png.
         */
        if (
            coarsePointer &&
            navigator.share &&
            (
                !navigator.canShare ||
                navigator.canShare({
                    files: [file],
                })
            )
        ) {
            try {
                await navigator.share({
                    title:
                        'COLOR HUNT',
                    files:
                        [file],
                });

                this.showVictoryShowcaseShareFeedback(
                    language === 'ko'
                        ? '✓ 승리카드 이미지를 공유했어요!'
                        : language === 'ja'
                            ? '✓ 勝利カード画像を共有しました！'
                            : '✓ Victory card image shared!',
                );
                return;
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name ===
                        'AbortError'
                ) {
                    return;
                }
            }
        }

        /*
         * Desktop (and mobile fallback): clipboard contains image/png ONLY.
         * Ctrl+V / paste therefore cannot silently prefer the game URL.
         */
        const copied =
            await this.copyVictoryImageOnlyToClipboard(
                blob,
            );

        if (copied) {
            this.showVictoryShowcaseShareFeedback(
                language === 'ko'
                    ? '✓ 승리카드 이미지 복사 완료 · 카톡에서 붙여넣기 하세요!'
                    : language === 'ja'
                        ? '✓ 勝利カード画像をコピーしました。チャットに貼り付けてください！'
                        : '✓ Victory card image copied · Paste it into chat!',
            );
            return;
        }

        /*
         * Browser clipboard image support is unavailable. Never replace the
         * requested image share with a URL; save the PNG and explain clearly.
         */
        this.downloadMultiplayerVictoryShowcase();
        this.showVictoryShowcaseShareFeedback(
            language === 'ko'
                ? '이미지 복사가 지원되지 않아 승리카드를 저장했어요.'
                : language === 'ja'
                    ? '画像コピーに対応していないため、勝利カードを保存しました。'
                    : 'Image clipboard is unavailable, so the victory card was saved.',
        );
    }

    private isVictoryShowcaseFoldedByDefault(): boolean {
        try {
            return window.localStorage.getItem(
                this.victoryShowcaseFoldStorageKey,
            ) === '1';
        } catch {
            return false;
        }
    }

    private setVictoryShowcaseFoldedByDefault(
        folded: boolean,
    ): void {
        try {
            window.localStorage.setItem(
                this.victoryShowcaseFoldStorageKey,
                folded ? '1' : '0',
            );
        } catch {
            // Storage can be unavailable in private/in-app browsers.
        }
    }

    private playVictoryShowcaseFireworks(
        anchor?: HTMLElement,
    ): void {
        const layer =
            document.createElement('div');
        layer.className =
            'colorhunt-victory-fireworks';

        const style =
            document.createElement('style');
        style.textContent =
            '.colorhunt-victory-fireworks{position:fixed;inset:0;z-index:2147483600;pointer-events:none;overflow:hidden}' +
            '.colorhunt-victory-fireworks i{position:absolute;left:var(--x);top:var(--y);font-style:normal;font-size:var(--s);opacity:0;transform:translate(-50%,-50%) scale(.2);animation:chVictoryBoom var(--d) cubic-bezier(.15,.75,.2,1) var(--delay) both}' +
            '@keyframes chVictoryBoom{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}15%{opacity:1;transform:translate(calc(-50% + var(--dx1)),calc(-50% + var(--dy1))) scale(1.25)}70%{opacity:1;transform:translate(calc(-50% + var(--dx2)),calc(-50% + var(--dy2))) rotate(var(--r)) scale(.9)}100%{opacity:0;transform:translate(calc(-50% + var(--dx3)),calc(-50% + var(--dy3))) rotate(var(--r)) scale(.45)}}';

        layer.appendChild(style);

        const rect =
            anchor?.getBoundingClientRect();
        const centerX =
            rect
                ? rect.left + rect.width / 2
                : window.innerWidth / 2;
        const centerY =
            rect
                ? rect.top + Math.min(rect.height * 0.35, 180)
                : window.innerHeight * 0.42;

        const glyphs = [
            '✨',
            '🎉',
            '★',
            '✦',
            '●',
        ];

        for (let index = 0; index < 34; index += 1) {
            const particle =
                document.createElement('i');
            particle.textContent =
                glyphs[index % glyphs.length];

            const angle =
                (
                    Math.PI * 2 * index /
                    34
                ) +
                (
                    Math.random() - 0.5
                ) * 0.45;
            const distance =
                90 + Math.random() * 230;

            particle.style.setProperty(
                '--x',
                String(centerX + (Math.random() - 0.5) * 54) + 'px',
            );
            particle.style.setProperty(
                '--y',
                String(centerY + (Math.random() - 0.5) * 30) + 'px',
            );
            particle.style.setProperty(
                '--s',
                String(14 + Math.random() * 16) + 'px',
            );
            particle.style.setProperty(
                '--d',
                String(720 + Math.random() * 520) + 'ms',
            );
            particle.style.setProperty(
                '--delay',
                String(Math.random() * 180) + 'ms',
            );
            particle.style.setProperty(
                '--dx1',
                String(Math.cos(angle) * distance * 0.35) + 'px',
            );
            particle.style.setProperty(
                '--dy1',
                String(Math.sin(angle) * distance * 0.35) + 'px',
            );
            particle.style.setProperty(
                '--dx2',
                String(Math.cos(angle) * distance) + 'px',
            );
            particle.style.setProperty(
                '--dy2',
                String(Math.sin(angle) * distance + 45) + 'px',
            );
            particle.style.setProperty(
                '--dx3',
                String(Math.cos(angle) * distance * 1.15) + 'px',
            );
            particle.style.setProperty(
                '--dy3',
                String(Math.sin(angle) * distance + 120) + 'px',
            );
            particle.style.setProperty(
                '--r',
                String(-120 + Math.random() * 240) + 'deg',
            );

            layer.appendChild(particle);
        }

        document.body.appendChild(layer);
        window.setTimeout(
            () => layer.remove(),
            1_650,
        );
    }

    private clearVictoryShowcaseForRoundLifecycle(): void {
        /*
         * V1010434_VICTORY_SOCIAL_CARD_POLISH / LIFECYCLE_CLEANUP
         * Leaving the waiting room or starting the next round must drop the
         * modal/chip/blob completely so cards never stack or leak memory.
         */
        this.victoryShowcaseCaptureSerial +=
            1;

        this.victoryShowcaseModal
            ?.remove();
        this.victoryShowcaseModal =
            undefined;

        this.removeCollapsedVictoryShowcase(
            true,
        );
    }

    private removeCollapsedVictoryShowcase(
        clearVictory = false,
    ): void {
        this.victoryShowcaseCollapsedResizeHandler &&
            window.removeEventListener(
                'resize',
                this.victoryShowcaseCollapsedResizeHandler,
            );
        this.victoryShowcaseCollapsedResizeHandler =
            undefined;

        this.victoryShowcaseCollapsedChip
            ?.remove();
        this.victoryShowcaseCollapsedChip =
            undefined;

        if (clearVictory) {
            this.victoryShowcaseBlob =
                undefined;
            this.victoryShowcaseWinner =
                undefined;

            if (
                this.victoryShowcasePreviewUrl
            ) {
                URL.revokeObjectURL(
                    this.victoryShowcasePreviewUrl,
                );
                this.victoryShowcasePreviewUrl =
                    '';
            }
        }
    }

    private showCollapsedVictoryShowcase(): void {
        if (
            !this.victoryShowcaseBlob ||
            !this.victoryShowcaseWinner ||
            this.victoryShowcaseCollapsedChip
        ) {
            return;
        }

        const isHunter =
            this.victoryShowcaseWinner ===
            'hunters';
        const language =
            getLanguage();

        const chip =
            document.createElement('button');
        chip.type = 'button';
        chip.className =
            'colorhunt-victory-collapsed';

        chip.innerHTML =
            '<span class="colorhunt-victory-collapsed__spark">🏆</span>' +
            '<span class="colorhunt-victory-collapsed__copy"><b>' +
            (
                isHunter
                    ? (
                        language === 'ko'
                            ? '헌터 승리카드'
                            : language === 'ja'
                                ? 'ハンター勝利カード'
                                : 'Hunter Victory Card'
                    )
                    : (
                        language === 'ko'
                            ? '하이더 승리카드'
                            : language === 'ja'
                                ? 'ハイダー勝利カード'
                                : 'Hider Victory Card'
                    )
            ) +
            '</b><small>' +
            (
                language === 'ko'
                    ? '눌러서 펼치기'
                    : language === 'ja'
                        ? 'タップして開く'
                        : 'Tap to open'
            ) +
            '</small></span>';

        const style =
            document.createElement('style');

        style.textContent =
            '.colorhunt-victory-collapsed{position:fixed;z-index:2147482500;display:flex;align-items:center;gap:10px;min-width:190px;max-width:min(72vw,310px);padding:10px 14px;border:1px solid rgba(255,255,255,.22);border-radius:18px;color:#fff;background:linear-gradient(135deg,rgba(20,25,34,.97),rgba(8,11,17,.98));box-shadow:0 14px 38px rgba(0,0,0,.38),0 0 26px rgba(255,255,255,.08);font:inherit;cursor:pointer;animation:chVictoryChipIn .34s cubic-bezier(.2,.9,.2,1.15) both}' +
            '.colorhunt-victory-collapsed__spark{font-size:27px;line-height:1}.colorhunt-victory-collapsed__copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.colorhunt-victory-collapsed__copy b{font-size:13px;line-height:1.15}.colorhunt-victory-collapsed__copy small{margin-top:3px;font-size:10px;opacity:.62}' +
            '@keyframes chVictoryChipIn{from{opacity:0;transform:translate(-50%,-72%) scale(.86)}to{opacity:1;transform:translate(-50%,-100%) scale(1)}}'

        chip.appendChild(
            style,
        );

        /*
         * Browser bottom is NOT the game bottom on desktop letterboxing.
         * Anchor against the real Phaser canvas rectangle.
         */
        const positionInsideCanvas =
            (): void => {
                if (!chip.isConnected) {
                    return;
                }

                const rect =
                    this.game.canvas
                        .getBoundingClientRect();

                chip.style.left =
                    Math.round(
                        rect.left +
                        rect.width / 2,
                    ) + 'px';

                chip.style.top =
                    Math.round(
                        Math.max(
                            rect.top + 64,
                            rect.bottom - 12,
                        ),
                    ) + 'px';

                chip.style.bottom =
                    'auto';

                chip.style.transform =
                    'translate(-50%,-100%)';
            };

        this.victoryShowcaseCollapsedResizeHandler =
            positionInsideCanvas;

        window.addEventListener(
            'resize',
            positionInsideCanvas,
        );

        chip.addEventListener(
            'click',
            () => {
                this.removeCollapsedVictoryShowcase(
                    false,
                );
                this.showMultiplayerVictoryShowcase(
                    true,
                );
            },
        );

        document.body.appendChild(
            chip,
        );

        positionInsideCanvas();

        this.victoryShowcaseCollapsedChip =
            chip;

        this.playVictoryShowcaseFireworks(
            chip,
        );
    }

    private closeMultiplayerVictoryShowcase(): void {
        this.victoryShowcaseModal
            ?.remove();
        this.victoryShowcaseModal =
            undefined;

        if (
            this.victoryShowcasePreviewUrl
        ) {
            URL.revokeObjectURL(
                this.victoryShowcasePreviewUrl,
            );
            this.victoryShowcasePreviewUrl =
                '';
        }

        /*
         * V1010438_PERSONAL_FOUND_VISUAL_AND_FOLD_CLOSE / CLOSE_MEANS_FOLD
         *
         * Closing never destroys this round's memory.
         * Keep it reopenable in Lobby until leave-room / next-round cleanup.
         * The checkbox still controls whether FUTURE cards open folded.
         */
        if (
            this.phase === 'lobby' &&
            this.victoryShowcaseBlob &&
            this.victoryShowcaseWinner
        ) {
            this.showCollapsedVictoryShowcase();
            return;
        }

        this.removeCollapsedVictoryShowcase(
            false,
        );
    }

    private showMultiplayerVictoryShowcase(
        forceOpen = false,
    ): void {
        if (
            !this.victoryShowcaseBlob ||
            !this.victoryShowcaseWinner ||
            this.victoryShowcaseModal
        ) {
            return;
        }

        if (
            !forceOpen &&
            this.isVictoryShowcaseFoldedByDefault()
        ) {
            this.showCollapsedVictoryShowcase();
            return;
        }

        this.removeCollapsedVictoryShowcase(
            false,
        );

        this.victoryShowcasePreviewUrl =
            URL.createObjectURL(
                this.victoryShowcaseBlob,
            );

        const isHunter =
            this.victoryShowcaseWinner ===
            'hunters';
        const language =
            getLanguage();

        const overlay =
            document.createElement('div');
        overlay.className =
            'colorhunt-victory-showcase-overlay';

        const card =
            document.createElement('div');
        card.className =
            'colorhunt-victory-showcase-card ' +
            (
                isHunter
                    ? 'is-hunter'
                    : 'is-hider'
            );

        /* V1010422C_REMOVE_UNUSED_MODAL_TITLE: v421 removed the duplicate modal header, so no separate modal title is needed. */
        const closeLabel =
            language === 'ko'
                ? '닫기'
                : 'Close';
        const saveLabel =
            language === 'ko'
                ? '저장'
                : 'Save';
        const shareLabel =
            language === 'ko'
                ? '이미지 공유'
                : language === 'ja'
                    ? '画像を共有'
                    : 'Share image';
        const linkLabel =
            language === 'ko'
                ? '게임 링크'
                : language === 'ja'
                    ? 'ゲームリンク'
                    : 'Game link';
        const foldLabel =
            language === 'ko'
                ? '앞으로 접어두기'
                : language === 'ja'
                    ? '今後は折りたたむ'
                    : 'Keep victory cards folded';

        card.innerHTML =
            '<style>' +
            '.colorhunt-victory-showcase-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:6px;background:radial-gradient(circle at 50% 18%,rgba(255,255,255,.09),transparent 36%),rgba(3,7,12,.80);backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15);animation:chVictoryBackdrop .42s ease both}' +
            '.colorhunt-victory-showcase-card{width:min(96vw,560px);height:min(98dvh,900px);max-height:98dvh;overflow:hidden;border:1px solid rgba(255,255,255,.72);border-radius:24px;padding:10px;color:#26343d;background:linear-gradient(180deg,rgba(255,249,243,.98),rgba(238,248,247,.99));box-shadow:0 30px 90px rgba(20,37,48,.30),inset 0 1px 0 rgba(255,255,255,.80);transform-origin:50% 72%;animation:chVictoryPop .62s cubic-bezier(.2,.9,.2,1.1) both;font-family:Inter,Pretendard,system-ui,sans-serif;display:flex;flex-direction:column;box-sizing:border-box}' +
            '.colorhunt-victory-showcase-card.is-hunter{background:linear-gradient(180deg,#faf8f5,#eee9e3);box-shadow:0 30px 90px rgba(38,42,46,.22),0 0 58px rgba(201,111,85,.12)}' +
            '.colorhunt-victory-showcase-card.is-hider{background:linear-gradient(180deg,#f8faf7,#e7eee9);box-shadow:0 30px 90px rgba(38,50,44,.20),0 0 58px rgba(83,123,104,.12)}' +
            '.colorhunt-victory-showcase-head{display:flex;align-items:end;justify-content:space-between;gap:14px;padding:3px 4px 14px}.colorhunt-victory-showcase-kicker{font-size:11px;font-weight:950;letter-spacing:.18em;opacity:.58}.colorhunt-victory-showcase-title{margin-top:4px;font-size:clamp(25px,5vw,34px);line-height:1;font-weight:950;letter-spacing:-.04em}.is-hunter .colorhunt-victory-showcase-title{color:#ffb087}.is-hider .colorhunt-victory-showcase-title{color:#93f5b2}.colorhunt-victory-showcase-badge{flex:0 0 auto;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:11px;font-weight:900}.colorhunt-victory-showcase-preview{display:block;width:auto;max-width:100%;height:auto;max-height:calc(100% - 64px);min-height:0;object-fit:contain;align-self:center;flex:1 1 auto;border-radius:18px;box-shadow:0 18px 42px rgba(0,0,0,.34);background:#111}.colorhunt-victory-showcase-caption{display:none;margin:0;color:rgba(255,255,255,.62);font-size:12px;font-weight:700;text-align:center}.colorhunt-victory-showcase-feedback{display:none;margin:0 5px 12px;padding:10px 12px;border:1px solid rgba(143,255,184,.34);border-radius:13px;background:rgba(49,183,101,.16);color:#bfffd2;font-size:12px;font-weight:900;text-align:center;animation:chVictoryFeedback .22s ease both}.colorhunt-victory-showcase-feedback.is-visible{display:block}.colorhunt-victory-showcase-fold{display:flex;align-items:center;justify-content:center;gap:8px;flex:0 0 auto;margin:7px 0 0;color:rgba(37,41,45,.72);font-size:11px;font-weight:800;user-select:none}.colorhunt-victory-showcase-fold input{width:17px;height:17px;accent-color:#537b68;cursor:pointer}.colorhunt-victory-showcase-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;flex:0 0 auto;margin-top:6px}.colorhunt-victory-showcase-actions button{min-height:42px;border:1px solid rgba(37,41,45,.16);border-radius:13px;color:#25292d;background:rgba(255,255,255,.88);box-shadow:0 3px 10px rgba(37,41,45,.08);font:inherit;font-size:13px;font-weight:900;cursor:pointer}.colorhunt-victory-showcase-actions [data-victory-share]{border-color:transparent;color:#fff;background:' +
            (isHunter ? '#c96f55' : '#537b68') +
            '}.colorhunt-victory-showcase-actions [data-victory-link]{background:rgba(255,255,255,.72)}@keyframes chVictoryFeedback{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@keyframes chVictoryBackdrop{from{opacity:0}to{opacity:1}}@keyframes chVictoryPop{0%{opacity:0;transform:translateY(34px) scale(.88) rotate(-1.5deg)}58%{opacity:1;transform:translateY(-3px) scale(1.015) rotate(.3deg)}100%{opacity:1;transform:translateY(0) scale(1)}}@media(max-height:650px){.colorhunt-victory-showcase-overlay{padding:2px}.colorhunt-victory-showcase-card{width:min(94vw,430px);height:99dvh;max-height:99dvh;padding:5px;border-radius:17px}.colorhunt-victory-showcase-preview{max-height:calc(100% - 50px);border-radius:13px}.colorhunt-victory-showcase-fold{margin-top:4px;font-size:10px}.colorhunt-victory-showcase-feedback{margin:0 3px 5px;padding:6px 8px}.colorhunt-victory-showcase-actions{margin-top:4px;gap:4px}.colorhunt-victory-showcase-actions button{min-height:35px;font-size:10px;padding:3px}}' +
            '</style>' +
            /* V1010421_VICTORY_MODAL_ONE_SCREEN: poster already contains the victory title. */
            '<img class="colorhunt-victory-showcase-preview" src="' +
            this.victoryShowcasePreviewUrl +
            '" alt="COLOR HUNT victory snapshot" />' +
            '<div class="colorhunt-victory-showcase-caption">' +
            (
                language === 'ko'
                    ? '승리한 플레이어에게만 남는 이번 판의 기념 스냅샷'
                    : 'A victory-only memory from this match'
            ) +
            '</div>' +
            '<div class="colorhunt-victory-showcase-feedback" data-victory-feedback></div>' +
            '<label class="colorhunt-victory-showcase-fold"><input type="checkbox" data-victory-fold />' +
            '<span>' +
            foldLabel +
            '</span></label>' +
            '<div class="colorhunt-victory-showcase-actions">' +
            '<button type="button" data-victory-close>' +
            closeLabel +
            '</button>' +
            '<button type="button" data-victory-save>' +
            saveLabel +
            '</button>' +
            '<button type="button" data-victory-share>' +
            shareLabel +
            '</button>' +
            '<button type="button" data-victory-link>' +
            linkLabel +
            '</button></div>';

        overlay.appendChild(card);
        document.body.appendChild(
            overlay,
        );

        this.victoryShowcaseModal =
            overlay;

        const foldToggle =
            card.querySelector<HTMLInputElement>(
                '[data-victory-fold]',
            );

        if (foldToggle) {
            foldToggle.checked =
                this.isVictoryShowcaseFoldedByDefault();

            foldToggle.addEventListener(
                'change',
                () => {
                    this.setVictoryShowcaseFoldedByDefault(
                        foldToggle.checked,
                    );
                },
            );
        }

        this.playVictoryShowcaseFireworks(
            card,
        );

        card.querySelector(
            '[data-victory-close]',
        )?.addEventListener(
            'click',
            () => this.closeMultiplayerVictoryShowcase(),
        );

        card.querySelector(
            '[data-victory-save]',
        )?.addEventListener(
            'click',
            () => this.downloadMultiplayerVictoryShowcase(),
        );

        card.querySelector(
            '[data-victory-share]',
        )?.addEventListener(
            'click',
            () => {
                void this.shareMultiplayerVictoryShowcase();
            },
        );

        card.querySelector(
            '[data-victory-link]',
        )?.addEventListener(
            'click',
            () => {
                void this.copyVictoryGameLink();
            },
        );
    }

    private applyNetworkPhase(
        phase: string,
        phaseEndsAt: number,
    ): void {
        this.phaseExpiredSince = 0;

        /*
         * V1010501D_SNIPER_SPECTATOR_PHASE_CLEANUP
         *
         * Remote sniper spectator visuals/state belong to Hunt ONLY.
         * v501 moved the visible "저격 모드 중..." badge to document.body,
         * so Phaser's normal clearAllAimingVisuals() cannot remove that DOM node.
         *
         * Hard-clean at every non-Hunt authoritative phase boundary:
         * finished -> lobby, direct lobby recovery, countdown/paint reconnect.
         */
        /*
         * V1010501E_NEXT_ROUND_SNIPER_SPECTATOR_HARD_RESET / ROUND_BOUNDARY_HARD_RESET
         *
         * 1) Every non-Hunt phase clears remote sniper state.
         * 2) Entering Hunt from Paint/Countdown/Lobby clears it AGAIN.
         *
         * The second reset is intentional: a late previous-round packet may
         * arrive after the non-Hunt cleanup but before next Hunt starts.
         */
        if (
            phase !== 'hunt' ||
            (
                phase === 'hunt' &&
                this.phase !== 'hunt'
            )
        ) {
            this.resetRemoteSniperSpectatorState();
        }

        const remainingMs =
            Math.max(
                0,
                phaseEndsAt - Date.now(),
            );

        /*
         * Capture this before enterLobbyPhase() mutates this.phase.
         * Used to reset the next-round waiting-room READY state only after a
         * completed round, not on a normal lobby reconnect.
         */
        const returnedToLobbyAfterRound =
            phase === 'lobby' &&
            this.phase === 'finished';

        this.phaseEndTime =
            this.time.now +
            remainingMs;

        if (
            phase !== this.phase ||
            this.hudPhaseDurationMs <= 1
        ) {
            this.hudPhaseDurationMs =
                Math.max(
                    1,
                    remainingMs,
                );
        }

        if (phase !== 'paint') {
            /*
             * V1010451M8A_READY_BUTTON_LOBBY_CLEANUP_ROBUST / NETWORK_NON_PAINT_HARD_HIDE
             */
            this.pendingPaintReadyIntent =
                undefined;
            this.pendingPaintReadyIntentUntil =
                0;

            if (this.paintReadyDomButton) {
                this.paintReadyDomButton.hidden =
                    true;
                this.paintReadyDomButton.style
                    .setProperty(
                        'visibility',
                        'hidden',
                        'important',
                    );
                this.paintReadyDomButton.style
                    .setProperty(
                        'pointer-events',
                        'none',
                        'important',
                    );
                this.paintReadyDomButton
                    .setAttribute(
                        'aria-hidden',
                        'true',
                    );
            }

            this.hideAllHidersReadyBubble();


            this.localPaintReady = false;
            this.allHidersPaintReady = false;
            this.paintReadyCount = 0;
            this.paintReadyHiderCount = 0;
            this.paintReadyButton
                ?.setVisible(false);
        }

        if (phase === 'lobby') {
            /*
             * V1010448_LOBBY_ROUND_PAINT_HARD_ISOLATION
             *
             * Lobby avatars and in-game camouflage are separate visual domains.
             * Never let the just-finished round texture become a waiting-room
             * avatar simply because phase_changed reaches us before reset_round.
             */
            const restoreLobbyAvatarPresets =
                (): void => {
                    if (
                        this.phase !== 'lobby' &&
                        multiplayerClient.getPhase() !==
                            'lobby'
                    ) {
                        return;
                    }

                    this.networkPlayerManager
                        .clearAllPaint();

                    this.lobbyAvatarPresetsBySession
                        .forEach(
                            (
                                strokes,
                                sessionId,
                            ) => {
                                this.networkPlayerManager
                                    .applyLobbyAvatarPreset(
                                        sessionId,
                                        this.getMobileSafeAvatarPreset(
                                            strokes,
                                        ),
                                    );
                            },
                        );
                };

            /*
             * First scrub is synchronous so Lobby never intentionally inherits
             * Hunt paint.
             */
            this.networkPlayerManager
                .clearAllPaint();

            this.lobbyAvatarPresetsBySession
                .forEach(
                    (
                        strokes,
                        sessionId,
                    ) => {
                        this.networkPlayerManager
                            .applyLobbyAvatarPreset(
                                sessionId,
                                this.getMobileSafeAvatarPreset(
                                    strokes,
                                ),
                            );
                    },
                );

            multiplayerClient
                .requestAvatarPresets();

            /*
             * One bounded second scrub absorbs any paint message already queued
             * around finished -> lobby.  It does NOT loop and does not affect
             * gameplay/reconnect cadence.
             */
            this.time.delayedCall(
                120,
                () => {
                    restoreLobbyAvatarPresets();

                    multiplayerClient
                        .requestAvatarPresets();
                },
            );

            /*
             * V1010300_CLIENT_MOBILE_UI_GHOST_GAS_FIX: GAS belongs to one Hunt only.
             * Never carry the previous Hunter's pressure into Lobby/next round.
             */
            this.fartGauge = 0;
            this.multiplayerPoopGasTarget = 0;
            this.lastFartUseAt = 0;
            this.localPoopUntil = 0;
            this.poopedHuntersUntil.clear();

            this.networkPlayerManager
                ?.setLocalHunterSpeedMultiplier(
                    1,
                );

            this.updateFartHud();

            this.fartHudContainer
                ?.setVisible(false);

            this.spectatorSessionId = '';
            this.spectatorCycleIndex = -1;

            this.roundResultWinner = null;
            this.guideText
                .setPosition(
                    18,
                    192,
                )
                .setOrigin(0, 0)
                .setDepth(300)
                .setFontSize(15)
                .setBackgroundColor(
                    'rgba(255, 244, 214, 0.86)',
                )
                .setPadding(
                    12,
                    7,
                    12,
                    7,
                );

            this.resetGameplayCamera();

            /*
             * V1010450Z_POST_ROUND_LOBBY_READY_RESET
             *
             * A completed round must always return guests to NOT READY.
             * The server normally clears lobbyReadySessionIds in resetToLobby(),
             * but the client can still render its cached previous READY state
             * until the new lobby_ready_state arrives. That creates the
             * "button is still pressed; click twice" bug.
             *
             * Clear ownership authoritatively for this guest and request the
             * fresh state a few times across the phase handoff.
             */
            if (
                returnedToLobbyAfterRound &&
                multiplayerClient
                    .isConnected()
            ) {
                if (
                    !multiplayerClient
                        .isHost()
                ) {
                    multiplayerClient
                        .sendLobbyReady(
                            false,
                        );
                }

                [0, 120, 360, 800].forEach(
                    (delay) => {
                        this.time.delayedCall(
                            delay,
                            () => {
                                if (
                                    this.phase !==
                                        'lobby' ||
                                    !multiplayerClient
                                        .isConnected()
                                ) {
                                    return;
                                }

                                multiplayerClient
                                    .requestLobbyReadyState();

                                this.updateWaitingRoomDom();
                                this.updateLobbyUi();
                            },
                        );
                    },
                );
            }

            this.enterLobbyPhase();
            return;
        }

        if (phase === 'countdown') {
            this.paintAssistUsedThisRound =
                false;
            this.paintAssistModal?.remove();
            this.paintAssistModal =
                undefined;
            this.clearVictoryShowcaseForRoundLifecycle();
            this.clearStatus();

            /*
             * Lobby avatar art is cosmetic only. Clear it before the actual
             * round so every player begins Paint with the normal white base.
             */
            this.networkPlayerManager
                .clearAllPaint();

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.phaseText
                .setText('')
                .setVisible(false);
            this.setHunterPaintBlind(false);
            this.phase = 'countdown';
            this.lastCountdownSoundValue = -1;
            this.syncPhaseMusic();
            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.updateLobbyUi();

            /*
             * v0.10.10.236.2:
             * Pre-Paint 3·2·1 countdown is NOT Hunt. Do not show the survival
             * timer here, otherwise its non-paint fallback reads "찾는 중!".
             * The dedicated central 3·2·1 countdown remains the only timer.
             */
            this.survivalHudText
                ?.setText('')
                .setVisible(false);
            this.survivalHudGraphics
                ?.setVisible(false);
            this.survivalHiderLabelText
                ?.setVisible(false);
            this.survivalHunterLabelText
                ?.setVisible(false);

            return;
        }

        if (phase === 'paint') {
            this.spectatorSessionId = '';
            this.spectatorCycleIndex = -1;

            this.clearStatus();

            this.phaseText
                .setText('')
                .setVisible(false);

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.localPaintReady = false;
            this.enterPaintPhase();

            /*
             * Post-round/lobby cleanup is allowed to remove the fixed DOM READY
             * control. Every new Paint phase must recreate it before rendering.
             */
            if (
                !this.paintReadyDomButton ||
                !this.paintReadyDomButton.isConnected
            ) {
                this.createPaintReadyDomButton();
            }

            this.updatePaintReadyButton();

            /*
             * READY state is gameplay coordination, not a one-shot cosmetic
             * event. Request it explicitly because mobile/background tabs can
             * miss the initial server broadcast around the phase transition.
             */
            [0, 180, 600, 1200, 2400].forEach(
                (delay) => {
                    this.time.delayedCall(
                        delay,
                        () => {
                            if (
                                this.phase ===
                                'paint' &&
                                multiplayerClient
                                    .isConnected()
                            ) {
                                multiplayerClient
                                    .requestPaintReadyState();
                            }
                        },
                    );
                },
            );

            this.networkPlayerManager
                .setNamesVisible(false);

            const localIsHunter =
                this.networkPlayerManager
                    .isLocalHunter();

            this.setHunterPaintBlind(
                localIsHunter,
            );

            /*
             * v0.10.10.229:
             * Remove the legacy paint countdown box completely. Paint time is
             * already shown by the fixed survival/hourglass HUD; keeping a
             * second Phaser text object made it move/scale with paint zoom.
             */
            this.hunterBlindText
                ?.setVisible(false);

            /*
             * Both roles refresh map colors, but only HIDER receives them in
             * the normal left palette. HUNTER keeps the standard palette.
             * The old separate CAMO SWATCH panel is no longer shown.
             */
            this.refreshHunterCamoPalette();

            this.applyRolePaintPalette(
                localIsHunter,
            );

            this.setHunterCamoPaletteVisible(
                false,
            );

            this.updatePaintControlHelp();

            /*
             * Hunter customization은 캐릭터를 enterPaintPhase() 이후에
             * 월드 중앙으로 이동시킵니다.
             * 따라서 이동된 위치를 기준으로 카메라를 즉시 다시 맞춥니다.
             * 이전에는 휠을 돌릴 때만 이 보정이 일어나 캐릭터가 안 보였습니다.
             */
            if (localIsHunter) {
                /*
                 * Hunter 캐릭터 자체는 customization mode에서 3배 확대되므로
                 * camera까지 gameplay zoom을 쓰면 지나치게 확대됩니다.
                 * Hunter Paint 기본 camera는 1.05로 낮춰
                 * 캐릭터 전체 + 상단 안내 문구 + 팔레트가 동시에 보이게 합니다.
                 */
                this.paintWorldZoom =
                    1.05;

                this.refreshPaintHudBaseTransforms();

                this.cameras.main
                    .stopFollow()
                    .removeBounds()
                    .setZoom(
                        this.paintWorldZoom,
                    );

                this.applyFixedHudForZoom(
                    this.paintWorldZoom,
                );

                this.centerPaintCameraOnLocalPlayer();

                this.time.delayedCall(
                    0,
                    () => {
                        if (
                            this.phase ===
                            'paint' &&
                            this.networkPlayerManager
                                .isLocalCustomizationMode()
                        ) {
                            this.cameras.main
                                .setZoom(
                                    this.paintWorldZoom,
                                );

                            this.applyFixedHudForZoom(
                                this.paintWorldZoom,
                            );

                            this.centerPaintCameraOnLocalPlayer();
                        }
                    },
                );
            }

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.updateSurvivalHud();
            return;
        }

        if (phase === 'hunt') {
            /*
             * V1010343_URGENT_HUNTER_INPUT_JITTER_EYEDROPPER / HUNT_INPUT_HARD_RESET
             *
             * Hunt must start from a clean browser/Phaser input state.
             * A stale DOM focus, held-key cache or lost pointer-up can leave
             * aim visuals alive while FIRE / SPACE / movement are effectively
             * dead until the browser loses and regains focus.
             */
            const huntActiveElement =
                document.activeElement;

            if (
                huntActiveElement instanceof
                    HTMLElement &&
                huntActiveElement !==
                    document.body
            ) {
                huntActiveElement.blur();
            }

            this.input.enabled = true;

            if (this.input.keyboard) {
                this.input.keyboard.enabled =
                    true;

                /*
                 * Clear keys that remained "down" across Paint -> Hunt.
                 * The next physical keydown is then authoritative.
                 */
                this.input.keyboard.resetKeys();
            }

            /*
             * Clear stale mobile/browser pointer ownership as well.
             * Safe on desktop because these ids are simply reset to idle.
             */
            this.resetMobileMoveControl();
            this.mobileAimPointerId = -1;
            this.mobileFirePointerId = -1;
            this.mobileFartPointerId = -1;
            this.mobileTouchPoints.clear();

            /*
             * A new Hunt must never inherit a previous local shot/input lock.
             * Server still owns ammo/heat/fart legality.
             */
            if (
                this.networkPlayerManager
                    .isLocalHunter() ||
                multiplayerClient
                    .getLocalPlayer()
                    ?.role === 'hunter'
            ) {
                this.isReloading = false;
                this.canShoot = true;
                this.lastFartUseAt = 0;
            }

            /*
             * V1010339C_CRITICAL_ROUND_STABILITY_CLIENT / HUNTER_INPUT_RELEASE
             *
             * A DOM chat/menu/paint control can retain focus or leave Phaser
             * keyboard disabled. Aim still moves, but WASD then appears dead.
             */
            if (
                this.chatInput &&
                document.activeElement ===
                    this.chatInput
            ) {
                this.chatInput.blur();
            }

            this.input.enabled = true;

            if (this.input.keyboard) {
                this.input.keyboard.enabled =
                    true;
            }

            /*
             * HOTFIX: Hunt can begin before the painter's final pointer-up.
             * Finish the last stroke first, then rebroadcast the Hider's
             * complete authoritative paint history. Hunter clients therefore
             * enter Hunt with the exact final camouflage the Hider sees.
             */
            this.finishActivePaintStroke();
            this.isPainting = false;

            /*
             * V1010430_V369_HUNT_NO_RECONNECT_SNAPSHOT
             *
             * Restore the proven v369 Hunt-start rule:
             * a normal Paint -> Hunt transition is NOT reconnect recovery.
             *
             * Do not send the whole local paint history through
             * sendReconnectPaintSnapshot() here.
             *
             * The visible raster already exists locally and normal paint_stroke
             * traffic already synchronized connected peers during Paint.
             * Full snapshot traffic stays reserved for ACTUAL reconnect recovery.
             */
            /*
             * V1010497_DESKTOP_ASSIST_POSITION_LOCAL_HIDER_HUNT_PAINT_FIX / DEFER_LOCAL_HIDER_REBUILD
             *
             * Do NOT rebuild before normalizeLocalPlayerForGameplay().
             * The final owner-only raster restore is performed after startHunt().
             */
            const shouldRestoreLocalHiderPaintAfterHuntStart =
                (
                    this.networkPlayerManager
                        .isLocalHider() ||
                    multiplayerClient
                        .getLocalPlayer()
                        ?.role === 'hider'
                ) &&
                this.localPaintHistory.length > 0;

            this.clearStatus();


            this.phaseText
                .setText('')
                .setVisible(false);

            /*
             * V1010432B_RESTORE_V369_PRE_HUNT_VISUAL_ORDER
             *
             * Restore the known-good v369 Paint -> Hunt visual order.
             * Settle authoritative actor state/pose BEFORE revealing remotes.
             *
             * No reconnect/full-paint network calls are added here.
             */
            this.networkPlayerManager
                .syncPlayersFromCurrentRoom();

            this.networkPlayerManager
                .syncLobbyPositionsFromState();

            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();

            this.networkPlayerManager
                .stabilizeHidersForHunt();

            this.resetPaintWorldZoom();

            this.networkPlayerManager
                .restoreAllPlayerVisibility();

            this.setHunterPaintBlind(false);
            this.setPaintPaletteVisible(false);
            this.setHunterCamoPaletteVisible(false);
            this.paintPreview.setVisible(false);

            this.networkPlayerManager
                .setNamesVisible(false);

            this.networkPlayerManager
                .setHunterGunsVisible();

            this.startHunt();

            /*
             * V1010497_DESKTOP_ASSIST_POSITION_LOCAL_HIDER_HUNT_PAINT_FIX / LOCAL_HIDER_FINAL_RASTER_AFTER_ALL_NORMALIZE
             *
             * startHunt() performs another normalizeLocalPlayerForGameplay().
             * Therefore this is the first safe point where the owner's final
             * camouflage can be restored without a later transition normalize
             * immediately replacing it.
             *
             * broadcast=false:
             * - does NOT send paint_stroke
             * - does NOT alter server paint state
             * - does NOT affect what Hunters already see
             * - only repairs the Hider owner's local RenderTexture
             *
             * This runs synchronously in the same Paint->Hunt task, before the
             * browser renders the next frame, so there is no delayed replay pulse.
             */
            if (
                shouldRestoreLocalHiderPaintAfterHuntStart
            ) {
                this.rebuildLocalPaintFromHistory(
                    false,
                );
            }

            this.startGameplayCamera();

            /*
             * V1010423_ATOMIC_HUNT_VISUAL_HANDOFF_RESTORE / NO_POST_HUNT_REPLAY_PULSE
             * Hunt inherits the final Paint RenderTextures unchanged.
             * No 0/120/360ms rebuild + visibility pulse.
             */

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            /*
             * Camera zoom compensation has already been applied above.
             * Survival HUD is part of fixed UI now, so refresh visibility
             * after the Hunt camera starts.
             */
            this.updateSurvivalHud();

            return;
        }

        if (phase === 'finished') {
            /*
             * V1010300_CLIENT_MOBILE_UI_GHOST_GAS_FIX: Finished is outside Hunt. Reset and hide GAS immediately,
             * including mobile where the fixed HUD could otherwise linger.
             */
            this.fartGauge = 0;
            this.multiplayerPoopGasTarget = 0;
            this.lastFartUseAt = 0;
            this.localPoopUntil = 0;
            this.poopedHuntersUntil.clear();

            this.networkPlayerManager
                ?.setLocalHunterSpeedMultiplier(
                    1,
                );

            this.updateFartHud();

            this.fartHudContainer
                ?.setVisible(false);

            const authoritativeWinner =
                multiplayerClient.getRoom()
                    ?.state.winner;

            /*
             * Same safety for phase transition. If winner says Hunters but
             * authoritative players still contain a living Hider, this
             * finished transition is internally inconsistent and must not
             * terminate the client's round.
             */
            /*
             * V1010388G_AUTHORITATIVE_ROUND_RESULT_FIX / FINISHED_AUTHORITY
             *
             * If handleNetworkRoundResult() already accepted the server's
             * authoritative Hunter result, stale alive=true Schema must not
             * rewind Finished back into Hunt.
             */
            if (
                authoritativeWinner === 'hunters' &&
                this.roundResultWinner !== 'hunters' &&
                this.getAuthoritativeAliveHiderCount() > 0
            ) {
                console.warn(
                    '[Color Hunt] Ignored inconsistent finished phase: alive Hiders remain',
                    {
                        aliveHiders:
                            this.getAuthoritativeAliveHiderCount(),
                    },
                );

                this.phase = 'hunt';
                this.updateSurvivalHud();
                return;
            }

            if (
                authoritativeWinner === 'hunters' ||
                authoritativeWinner === 'hiders'
            ) {
                this.roundResultWinner =
                    authoritativeWinner;
            }

            this.resetGameplayCamera();
            this.clearStatus();
            this.clearAllAimingVisuals();
            this.setHunterPaintBlind(false);
            this.setHunterCamoPaletteVisible(false);
            this.hideLegacySinglePlayerActors();

            /*
             * V1010455K_GLOBAL_TACTICAL_BGM_SCOPE_VICTORY_AUDIO
             * Round result owns audio immediately: no helicopter rotor or
             * tactical loop may leak under the victory countdown/fanfare.
             */
            this.stopSniperTacticalBgm(
                false,
            );

            if (
                this.phase !== 'finished' &&
                this.audioUnlocked
            ) {
                this.victorySound?.play();
            }

            this.phase = 'finished';
            this.syncPhaseMusic();

            this.phaseText
                .setText('')
                .setVisible(false);

            this.phaseEndTime =
                this.time.now +
                remainingMs;

            this.timerText
                .setText(
                    `LOBBY ${Math.max(
                        1,
                        Math.ceil(
                            remainingMs /
                            1000,
                        ),
                    )}`,
                )
                .setColor('#8cff9b');

            /*
             * v0.10.10.96:
             * Remove the legacy small winner banner completely.
             * The large central Finished countdown is the single source of
             * truth for HUNTER/HIDER victory display.
             */
            this.guideText
                .setText('')
                .setBackgroundColor(
                    'rgba(0,0,0,0)',
                )
                .setVisible(false);

            this.statusText
                .setText('')
                .setVisible(false);

            this.aimLine.clear();
            this.crosshair.clear();
        }

        this.updateLobbyUi();
    }

    private updateMultiplayerHud(): void {
        if (!this.multiplayerText) {
            return;
        }

        const localPlayer =
            multiplayerClient.getLocalPlayer();

        const roomId =
            multiplayerClient.getRoomId();

        const role =
            localPlayer?.role?.toUpperCase() ??
            '';

        this.multiplayerText
            .setText(
                [
                    `ROOM ${roomId ?? '-'}`,
                    tr(`PLAYERS ${this.networkPlayerCount} / 10`),
                    tr(`ROLE ${role}`),
                ].join('\n'),
            )
            .setColor('#35634a');

        this.updateLobbyUi();
    }

    /*
     * Background
     */

    private createImageBackground(): void {
        this.backgroundImage = this.add.image(
            this.gameWidth / 2,
            this.gameHeight / 2,
            'forest-background',
        );

        this.backgroundImage.setDisplaySize(
            this.gameWidth,
            this.gameHeight,
        );

        this.backgroundImage.setDepth(-20);
        this.currentBackgroundTextureKey =
            'forest-background';
        /*
         * setDisplaySize()가 적용한 실제 이미지 기본 scale을 저장합니다.
         * 첫 휠 입력에서 scale을 1.25로 덮어쓰면 원본 이미지 크기에 따라
         * 화면이 튀므로 반드시 기본 scale × Paint zoom을 사용합니다.
         */
    }

    /*
     * Obstacles
     */

    private createObstacles(): void {
        /*
         * Random obstacle system removed in v0.10.10.4.
         * No gameplay obstacles are created.
         */
        this.obstacles = [];
    }

    /*
     * Hunter
     */

    private createHunter(): void {
        const x = 100;
        const y = this.gameHeight / 2;

        // 이동 및 충돌 판정용 투명 본체
        this.player = this.add.rectangle(x, y, 24, 42, 0x000000, 0);
        this.player.setDepth(10);

        const head = this.add.circle(x, y - 17, 13, 0xfff7e8);
        const body = this.add.rectangle(x, y + 5, 20, 24, 0x4f86c6);
        const leftArm = this.add.rectangle(x - 13, y + 4, 7, 18, 0x4f86c6);
        const rightArm = this.add.rectangle(x + 13, y + 4, 7, 18, 0x4f86c6);
        const leftLeg = this.add.rectangle(x - 6, y + 22, 8, 14, 0x355f91);
        const rightLeg = this.add.rectangle(x + 6, y + 22, 8, 14, 0x355f91);

        // 이미지에서 보였던 파란 모자 느낌
        const hatBrim = this.add.rectangle(x, y - 27, 28, 6, 0x2f5f98);
        const hatTop = this.add.rectangle(x, y - 33, 20, 9, 0x477fb8);
        const scarf = this.add.rectangle(x, y - 3, 18, 5, 0xf2c14e);

        this.hunterVisuals = [
            { object: head, offsetX: 0, offsetY: -17 },
            { object: body, offsetX: 0, offsetY: 5 },
            { object: leftArm, offsetX: -13, offsetY: 4 },
            { object: rightArm, offsetX: 13, offsetY: 4 },
            { object: leftLeg, offsetX: -6, offsetY: 22 },
            { object: rightLeg, offsetX: 6, offsetY: 22 },
            { object: hatBrim, offsetX: 0, offsetY: -27 },
            { object: hatTop, offsetX: 0, offsetY: -33 },
            { object: scarf, offsetX: 0, offsetY: -3 },
        ];

        this.hunterVisuals.forEach(({ object }) => {
            object.setStrokeStyle(1, 0x5b4636, 0.75);
            object.setDepth(10);
        });

        this.gun = this.add.rectangle(
            x + 20,
            y + 3,
            32,
            7,
            0x6b4b2a,
        );

        this.gun.setOrigin(0.15, 0.5);
        this.gun.setDepth(11);

        this.hunterLabel = this.add
            .text(x, y - 49, tr('HUNTER'), {
                fontFamily: 'Arial',
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#315f94',
                backgroundColor: 'rgba(255, 244, 214, 0.86)',
                padding: { x: 6, y: 3 },
            })
            .setOrigin(0.5)
            .setDepth(12);
    }

    private updateHunterMovement(delta: number): void {
        let movementX = 0;
        let movementY = 0;

        if (
            this.moveLeftKey.isDown ||
            this.cursors.left.isDown
        ) {
            movementX -= 1;
        }

        if (
            this.moveRightKey.isDown ||
            this.cursors.right.isDown
        ) {
            movementX += 1;
        }

        if (
            this.moveUpKey.isDown ||
            this.cursors.up.isDown
        ) {
            movementY -= 1;
        }

        if (
            this.moveDownKey.isDown ||
            this.cursors.down.isDown
        ) {
            movementY += 1;
        }

        if (movementX === 0 && movementY === 0) {
            return;
        }

        const direction = new Phaser.Math.Vector2(
            movementX,
            movementY,
        ).normalize();

        const distance =
            (
                this.practiceMode ===
                    'hunter'
                    ? this.practiceHunterMoveSpeed *
                        (
                            this.practicePoopRemainingMs >
                                0
                                ? 0.4
                                : 1
                        )
                    : this.playerSpeed
            ) *
            (
                delta /
                1000
            );

        const previousX = this.player.x;
        const previousY = this.player.y;

        this.player.x += direction.x * distance;
        this.player.y += direction.y * distance;

        this.player.x = Phaser.Math.Clamp(
            this.player.x,
            this.player.width / 2,
            this.gameWidth - this.player.width / 2,
        );

        this.player.y = Phaser.Math.Clamp(
            this.player.y,
            this.player.height / 2,
            this.gameHeight - this.player.height / 2,
        );

        if (this.isHunterTouchingObstacle()) {
            this.player.setPosition(previousX, previousY);
        }

        this.updateHunterObjects();
    }

    private updatePracticeHunterMobileMovement(
        delta: number,
    ): void {
        if (
            this.mobileMovePointerId >=
                0 &&
            !this.isMobilePointerActuallyDown(
                this.mobileMovePointerId,
            )
        ) {
            this.resetMobileMoveControl();
        }

        const vector =
            new Phaser.Math.Vector2(
                this.mobileMoveX,
                this.mobileMoveY,
            );

        if (
            vector.lengthSq() <=
            0.0001
        ) {
            return;
        }

        if (
            vector.lengthSq() >
            1
        ) {
            vector.normalize();
        }

        const distance =
            this.practiceHunterMoveSpeed *
            (
                this.practicePoopRemainingMs >
                    0
                    ? 0.4
                    : 1
            ) *
            (
                delta /
                1000
            );

        this.player.x =
            Phaser.Math.Clamp(
                this.player.x +
                    vector.x *
                        distance,
                18,
                this.gameWidth -
                    18,
            );

        this.player.y =
            Phaser.Math.Clamp(
                this.player.y +
                    vector.y *
                        distance,
                32,
                this.gameHeight -
                    32,
            );

        this.updateHunterObjects();
    }

    private updateHunterObjects(): void {
        this.hunterVisuals.forEach(({ object, offsetX, offsetY }) => {
            object.setPosition(
                this.player.x + offsetX,
                this.player.y + offsetY,
            );
        });

        this.gun.setPosition(
            this.player.x,
            this.player.y + 3,
        );

        this.hunterLabel.setPosition(
            this.player.x,
            this.player.y - 49,
        );
    }

    private isHunterTouchingObstacle(): boolean {
        const hunterBounds = this.player.getBounds();

        return this.obstacles.some((obstacle) =>
            Phaser.Geom.Intersects.RectangleToRectangle(
                hunterBounds,
                obstacle.bounds,
            ),
        );
    }

    /*
     * Hiders
     */

    private createHiders(): void {
        const positions = [
            { x: 170, y: 145 },
            { x: 760, y: 155 },
            { x: 720, y: 415 },
        ];

        this.hiders = positions.map(
            (position, index) =>
                this.createHider(
                    position.x,
                    position.y,
                    index,
                ),
        );
    }

    private createHider(
        x: number,
        y: number,
        index: number,
    ): Hider {
        // 얼굴 요소 없이 실루엣만 귀여운 SD 비율
        const head = this.add.circle(x, y - 22, 13, 0xfffbf2);

        const body = this.add.rectangle(
            x,
            y + 1,
            21,
            23,
            0xfffbf2,
        );

        const leftArm = this.add.rectangle(
            x - 14,
            y + 1,
            7,
            18,
            0xfffbf2,
        );

        const rightArm = this.add.rectangle(
            x + 14,
            y + 1,
            7,
            18,
            0xfffbf2,
        );

        const leftLeg = this.add.rectangle(
            x - 6,
            y + 20,
            8,
            15,
            0xfffbf2,
        );

        const rightLeg = this.add.rectangle(
            x + 6,
            y + 20,
            8,
            15,
            0xfffbf2,
        );

        const objects: HiderPartObject[] = [
            head,
            body,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
        ];

        objects.forEach((object) => {
            object.setStrokeStyle(1, 0x8d6e63, 0.75);
            object.setDepth(5);
        });

        const paintLayer = this.createPaintLayer(x, y);

        const label = this.add
            .text(x, y - 43, tr(`HIDER ${index + 1}`), {
                fontFamily: 'Arial',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#5b4636',
                backgroundColor: 'rgba(255, 244, 214, 0.86)',
                padding: {
                    x: 7,
                    y: 4,
                },
            })
            .setOrigin(0.5)
            .setDepth(9);

        return {
            centerX: x,
            centerY: y,
            alive: true,

            head,
            body,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            label,

            paintTexture: paintLayer.paintTexture,
            paintMaskShape:
                paintLayer.paintMaskShape,
            paintMask: paintLayer.paintMask,
        };
    }

    private createPaintLayer(
        centerX: number,
        centerY: number,
    ): {
        paintTexture: Phaser.GameObjects.RenderTexture;
        paintMaskShape: Phaser.GameObjects.Graphics;
        paintMask: Phaser.Display.Masks.GeometryMask;
    } {
        const textureWidth = 60;
        const textureHeight = 76;

        const textureX = centerX - textureWidth / 2;
        const textureY = centerY - 38;

        const paintTexture = this.add.renderTexture(
            textureX,
            textureY,
            textureWidth,
            textureHeight,
        );

        paintTexture.setOrigin(0, 0);
        paintTexture.setDepth(20);

        // 처음 흰색으로 채우지 않음
        // 기존 하이더 몸체가 흰색이므로 그대로 보임
        paintTexture.clear();

        const paintMaskShape = this.add.graphics();

        // 마스크는 로컬 좌표로 그림
        this.drawLocalHiderMask(paintMaskShape);

        // RenderTexture와 같은 위치에 배치
        paintMaskShape.setPosition(
            textureX,
            textureY,
        );

        paintMaskShape.setVisible(false);

        const paintMask =
            paintMaskShape.createGeometryMask();

        paintTexture.setMask(paintMask);

        return {
            paintTexture,
            paintMaskShape,
            paintMask,
        };
    }

    private drawLocalHiderMask(
        graphics: Phaser.GameObjects.Graphics,
    ): void {
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);

        // RenderTexture: 60 x 76, 중심은 (30, 38)
        const centerX = 30;
        const centerY = 38;

        graphics.fillCircle(centerX, centerY - 22, 13);
        graphics.fillRect(centerX - 10.5, centerY - 10.5, 21, 23);
        graphics.fillRect(centerX - 17.5, centerY - 8, 7, 18);
        graphics.fillRect(centerX + 10.5, centerY - 8, 7, 18);
        graphics.fillRect(centerX - 10, centerY + 12, 8, 15);
        graphics.fillRect(centerX + 2, centerY + 12, 8, 15);
    }

    private getAllPartObjects(
        hider: Hider,
    ): HiderPartObject[] {
        return [
            hider.head,
            hider.body,
            hider.leftArm,
            hider.rightArm,
            hider.leftLeg,
            hider.rightLeg,
        ];
    }

    private createSelectionRing(): void {
        this.selectionRing = this.add.circle(
            0,
            0,
            38,
            0xffe082,
            0,
        );

        this.selectionRing.setStrokeStyle(
            3,
            0xffe082,
            1,
        );

        this.selectionRing.setDepth(8);

        this.tweens.add({
            targets: this.selectionRing,
            scale: 1.08,
            alpha: 0.35,
            duration: 650,
            yoyo: true,
            repeat: -1,
        });
    }

    private selectHider(index: number): void {
        const hider = this.hiders[index];

        if (!hider || !hider.alive) {
            return;
        }

        this.selectedHiderIndex = index;

        this.selectionRing.setPosition(
            hider.centerX,
            hider.centerY + 4,
        );

        this.showStatus(
            tr(`HIDER ${index + 1} 선택`),
        );
    }

    private updateSelectedHiderMovement(
        delta: number,
    ): void {
        if (
            this.practiceMode ===
                'hider'
        ) {
            let movementX = 0;
            let movementY = 0;

            if (this.moveLeftKey.isDown) {
                movementX -= 1;
            }

            if (this.moveRightKey.isDown) {
                movementX += 1;
            }

            if (this.moveUpKey.isDown) {
                movementY -= 1;
            }

            if (this.moveDownKey.isDown) {
                movementY += 1;
            }

            if (this.mobileControlsEnabled) {
                movementX +=
                    this.mobileMoveX;
                movementY +=
                    this.mobileMoveY;
            }

            movementX =
                Phaser.Math.Clamp(
                    movementX,
                    -1,
                    1,
                );
            movementY =
                Phaser.Math.Clamp(
                    movementY,
                    -1,
                    1,
                );

            this.networkPlayerManager
                .moveLocalPlayer(
                    movementX,
                    movementY,
                    delta,
                );

            this.networkPlayerManager
                .update(
                    delta,
                );

            this.centerPaintCameraOnLocalPlayer();
            return;
        }

        const hider =
            this.hiders[this.selectedHiderIndex];

        if (!hider || !hider.alive) {
            return;
        }

        let movementX = 0;
        let movementY = 0;

        if (this.moveLeftKey.isDown) {
            movementX -= 1;
        }

        if (this.moveRightKey.isDown) {
            movementX += 1;
        }

        if (this.moveUpKey.isDown) {
            movementY -= 1;
        }

        if (this.moveDownKey.isDown) {
            movementY += 1;
        }

        if (movementX === 0 && movementY === 0) {
            return;
        }

        const direction = new Phaser.Math.Vector2(
            movementX,
            movementY,
        ).normalize();

        const distance =
            this.hiderSpeed * (delta / 1000);

        this.moveHider(
            hider,
            direction.x * distance,
            direction.y * distance,
        );
    }

    private moveHider(
        hider: Hider,
        movementX: number,
        movementY: number,
    ): void {
        const previousCenterX = hider.centerX;
        const previousCenterY = hider.centerY;

        this.applyHiderMovement(
            hider,
            movementX,
            movementY,
        );

        const outsideBounds =
            hider.centerX < 45 ||
            hider.centerX > this.gameWidth - 45 ||
            hider.centerY < 90 ||
            hider.centerY > this.gameHeight - 72;

        if (
            outsideBounds ||
            this.isHiderTouchingObstacle(hider)
        ) {
            this.applyHiderMovement(
                hider,
                previousCenterX - hider.centerX,
                previousCenterY - hider.centerY,
            );
        }

        this.selectionRing.setPosition(
            hider.centerX,
            hider.centerY + 4,
        );
    }

    private applyHiderMovement(
        hider: Hider,
        movementX: number,
        movementY: number,
    ): void {
        hider.centerX += movementX;
        hider.centerY += movementY;

        this.getAllPartObjects(hider).forEach(
            (object) => {
                object.x += movementX;
                object.y += movementY;
            },
        );

        hider.label.x += movementX;
        hider.label.y += movementY;

        hider.paintTexture.x += movementX;
        hider.paintTexture.y += movementY;

        hider.paintMaskShape.x += movementX;
        hider.paintMaskShape.y += movementY;
    }

    private isHiderTouchingObstacle(
        hider: Hider,
    ): boolean {
        return this.getAllPartObjects(hider).some(
            (part) => {
                const partBounds = part.getBounds();

                return this.obstacles.some((obstacle) =>
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        partBounds,
                        obstacle.bounds,
                    ),
                );
            },
        );
    }

    private findHiderAtPoint(
        worldX: number,
        worldY: number,
    ): {
        hider: Hider;
        index: number;
    } | null {
        for (
            let index = this.hiders.length - 1;
            index >= 0;
            index -= 1
        ) {
            const hider = this.hiders[index];

            if (
                hider.alive &&
                this.isPointerInsideHider(
                    hider,
                    worldX,
                    worldY,
                )
            ) {
                return {
                    hider,
                    index,
                };
            }
        }

        return null;
    }

    private isPointerInsideHider(
        hider: Hider,
        worldX: number,
        worldY: number,
    ): boolean {
        return this.getAllPartObjects(hider).some(
            (part) =>
                part
                    .getBounds()
                    .contains(worldX, worldY),
        );
    }

    /*
     * Painting
     */

    private applyPaintOnlyScreenLayout(): void {
        if (this.phase !== 'paint') {
            return;
        }

        /*
         * v0.10.10.83:
         * Keep Paint-only HUD in one clean stack directly below the
         * Hider/Hunter icon bar, with enough breathing room to avoid
         * overlapping the enlarged character.
         */
        this.setFixedHudScreenPosition(
            this.timerText,
            this.gameWidth / 2,
            94,
        );

        this.setFixedHudScreenPosition(
            this.guideText,
            this.gameWidth / 2,
            128,
        );
    }

    private restoreGameplayTimerPosition(): void {
        this.setFixedHudScreenPosition(
            this.timerText,
            this.gameWidth / 2,
            108,
        );

        this.setFixedHudScreenPosition(
            this.guideText,
            this.gameWidth / 2,
            132,
        );
    }    private clampPaintCameraPan(): void {
        const maxX =
            this.gameWidth *
            0.42;
        const maxY =
            this.gameHeight *
            0.42;

        this.paintCameraOffsetScreenX =
            Phaser.Math.Clamp(
                this.paintCameraOffsetScreenX,
                -maxX,
                maxX,
            );

        this.paintCameraOffsetScreenY =
            Phaser.Math.Clamp(
                this.paintCameraOffsetScreenY,
                -maxY,
                maxY,
            );
    }

    private applyPaintCameraPosition(): void {
        if (this.phase !== 'paint') {
            return;
        }

        const target =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!target) {
            return;
        }

        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        const screenLiftPx =
            this.mobileControlsEnabled
                ? 22
                : 16;

        const worldYOffset =
            screenLiftPx /
            zoom;

        this.cameras.main
            .stopFollow()
            .removeBounds()
            .centerOn(
                target.x +
                    this.paintCameraOffsetScreenX /
                        zoom,
                target.y +
                    worldYOffset +
                    this.paintCameraOffsetScreenY /
                        zoom,
            );
    }

    private resetPaintCameraPan(): void {
        this.paintCameraOffsetScreenX = 0;
        this.paintCameraOffsetScreenY = 0;
        this.mobilePaintCameraPanX = 0;
        this.mobilePaintCameraPanY = 0;
        this.applyPaintCameraPosition();

        if (this.mobileAimKnob) {
            this.setFixedHudScreenPosition(
                this.mobileAimKnob,
                this.gameWidth - 170,
                this.gameHeight - 190,
            );
        }
    }

    private updatePaintCameraPan(
        delta: number,
    ): void {
        if (
            this.phase !== 'paint' ||
            this.networkPlayerManager
                .isLocalCustomizationMode()
        ) {
            return;
        }

        let x = 0;
        let y = 0;

        if (this.mobileControlsEnabled) {
            x =
                this.mobilePaintCameraPanX;
            y =
                this.mobilePaintCameraPanY;
        } else {
            if (this.cursors.left.isDown) x -= 1;
            if (this.cursors.right.isDown) x += 1;
            if (this.cursors.up.isDown) y -= 1;
            if (this.cursors.down.isDown) y += 1;

            if (x !== 0 || y !== 0) {
                const direction =
                    new Phaser.Math.Vector2(
                        x,
                        y,
                    ).normalize();

                x = direction.x;
                y = direction.y;
            }
        }

        if (
            Math.abs(x) < 0.001 &&
            Math.abs(y) < 0.001
        ) {
            return;
        }

        const speed =
            this.mobileControlsEnabled
                ? 230
                : 260;

        this.paintCameraOffsetScreenX +=
            x *
            speed *
            delta /
            1000;

        this.paintCameraOffsetScreenY +=
            y *
            speed *
            delta /
            1000;

        this.clampPaintCameraPan();
        this.applyPaintCameraPosition();
    }



    private centerPaintCameraOnLocalPlayer(): void {
        if (
            this.phase !== 'paint' ||
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !==
                    'hider'
            )
        ) {
            return;
        }

        if (
            this.paintCameraOffsetScreenX !== 0 ||
            this.paintCameraOffsetScreenY !== 0
        ) {
            this.applyPaintCameraPosition();
            return;
        }

        const target =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!target) {
            return;
        }

        /*
         * Paint 중에도 캐릭터를 화면 정중앙에 둡니다.
         * 맵 경계 clamp를 쓰지 않아 가장자리에서도 중심이 흔들리지 않습니다.
         */
        /*
         * v0.10.10.85:
         * Negative lift centers the camera ABOVE the actor, making the actor
         * appear lower on screen. This leaves a clean HUD gap above the head.
         */
        /*
         * v0.10.10.86:
         * Balanced Paint framing. Keep the enlarged actor between the compact
         * counter above and READY controls below without touching either.
         */
        const screenLiftPx =
            this.mobileControlsEnabled
                ? 22
                : 16;

        const worldYOffset =
            screenLiftPx /
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        this.cameras.main
            .stopFollow()
            .removeBounds()
            /*
             * Center the camera slightly BELOW the character so the character
             * itself appears higher on screen. This applies only in Paint.
             */
            .centerOn(
                target.x,
                target.y +
                    worldYOffset,
            );
    }

    private adjustPaintWorldZoom(
        wheelDeltaY: number,
    ): number {
        this.brushSizeSliderDragging =
            false;

        if (this.phase !== 'paint') {
            return this.paintWorldZoom;
        }

        const localPosition =
            this.networkPlayerManager
                .getLocalPlayerPosition();

        if (!localPosition) {
            return 1;
        }

        const direction =
            wheelDeltaY < 0
                ? 1
                : -1;

        const nextZoom =
            Phaser.Math.Clamp(
                this.paintWorldZoom +
                    direction * 0.25,
                this.mobileControlsEnabled
                    ? 1.5
                    : 1,
                this.mobileControlsEnabled
                    ? 9
                    : 6.5,
            );

        this.paintWorldZoom =
            nextZoom;
        const camera =
            this.cameras.main;

        /*
         * 월드 좌표는 그대로 두고 카메라만 확대합니다.
         * HUD는 최초 저장 좌표를 기준으로 역스케일하여 화면에 고정합니다.
         */
        this.applyFixedHudForZoom(
            nextZoom,
        );

        camera
            .stopFollow()
            .removeBounds()
            .setZoom(
                nextZoom,
            );

        this.applyPaintCameraPosition();

        return nextZoom;
    }

    private resetPaintWorldZoom(): void {
        this.paintWorldZoom = 1;
        this.paintCameraOffsetScreenX = 0;
        this.paintCameraOffsetScreenY = 0;
        this.mobilePaintCameraPanX = 0;
        this.mobilePaintCameraPanY = 0;
        this.mobilePaintCameraResetButton
            ?.setVisible(false);
        this.mobilePinchDistance = 0;
        this.mobilePinchActive = false;
        this.mobileTouchPoints.clear();
        const camera =
            this.cameras.main;

        camera
            .stopFollow()
            .setZoom(1)
            .setScroll(0, 0)
            .removeBounds();

        this.restoreFixedHud();

        this.networkPlayerManager
            ?.resetLocalPaintZoom();
    }

    private createPaintPalette(): void {
        const colors = [
            ...this.standardPaintColors,
        ];

        const panel = this.add
            .rectangle(
                345,
                this.gameHeight - 64,
                670,
                this.mobileControlsEnabled
                    ? 126
                    : 110,
                0xf5f0df,
                this.mobileControlsEnabled
                    ? 0.90
                    : 0.93,
            )
            .setStrokeStyle(
                2,
                0x6f8f65,
                1,
            )
            .setDepth(870)
            .setVisible(false);

        const title = this.add
            .text(
                20,
                this.gameHeight - 83,
                this.mobileControlsEnabled
                    ? ''
                    : tr('COLOR PALETTE'),
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
            .setDepth(871)
            .setVisible(false);

        this.paletteObjects.push(
            panel,
            title,
        );

        colors.forEach(
            (
                color,
                index,
            ) => {
                const column =
                    index % 8;

                const row =
                    Math.floor(
                        index / 8,
                    );

                const swatch =
                    this.add.rectangle(
                        (
                            this.mobileControlsEnabled
                                ? 38
                                : 35
                        ) +
                            column *
                            (
                                this.mobileControlsEnabled
                                    ? 34
                                    : 32
                            ),
                        this.gameHeight -
                            (
                                this.mobileControlsEnabled
                                    ? 63
                                    : 58
                            ) +
                            row *
                            (
                                this.mobileControlsEnabled
                                    ? 31
                                    : 29
                            ),
                        this.mobileControlsEnabled
                            ? 28
                            : 24,
                        this.mobileControlsEnabled
                            ? 28
                            : 24,
                        color,
                        1,
                    )
                        .setStrokeStyle(
                            this.mobileControlsEnabled
                                ? 3
                                : 2,
                            0xffffff,
                            0.98,
                        )
                        .setDepth(872)
                        .setVisible(false)
                        .setInteractive({
                            useHandCursor: true,
                        });

                swatch.on(
                    'pointerdown',
                    (
                        pointer:
                            Phaser.Input.Pointer,
                    ) => {
                        pointer.event
                            ?.stopPropagation?.();

                        /*
                         * Role palettes can recolor this same swatch after it
                         * was created. Always read the CURRENT data value.
                         * The old closure captured the original color and made
                         * Hider swatch visuals disagree with actual paint.
                         */
                        const currentColor =
                            swatch.getData(
                                'paletteColor',
                            );

                        if (
                            typeof currentColor !==
                            'number'
                        ) {
                            return;
                        }

                        this.paintColor =
                            currentColor;

                        this.createBrushTexture(
                            true,
                        );
                        this.updatePaintHud();
                        this.updatePaintPreviewImmediately();
                        this.highlightPaletteColor(
                            currentColor,
                        );
                    },
                );

                swatch.setData(
                    'paletteColor',
                    color,
                );

                this.paletteObjects.push(
                    swatch,
                );
            },
        );

        const brushShapeTitle =
            this.add.text(
                395,
                this.gameHeight - 104,
                this.mobileControlsEnabled
                    ? `✦ ${tr('도구')}`
                    : tr('브러시 모양'),
                {
                    fontFamily:
                        'monospace',
                    fontSize:
                        this.mobileControlsEnabled
                            ? '12px'
                            : '11px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0.5)
                .setDepth(872)
                .setVisible(false);

        this.paletteObjects.push(
            brushShapeTitle,
        );

        const brushShapeOptions: Array<{
            shape: BrushShape;
            label: string;
        }> = [
            {
                shape: 'circle',
                label:
                    this.mobileControlsEnabled
                        ? `🖌 ●\n${tr('원형')}`
                        : `● ${tr('원형')}`,
            },
            {
                shape: 'square',
                label:
                    this.mobileControlsEnabled
                        ? `▣\n${tr('사각형')}`
                        : `■ ${tr('사각형')}`,
            },
        ];

        brushShapeOptions.forEach(
            (
                option,
                index,
            ) => {
                const button =
                    this.add
                        .text(
                            315 +
                                index * 80,
                            this.gameHeight -
                                78,
                            option.label,
                            {
                                fontFamily:
                                    'monospace',
                                fontSize:
                                    this.mobileControlsEnabled
                                        ? '14px'
                                        : '11px',
                                fontStyle: 'bold',
                                color: '#26352b',
                                backgroundColor:
                                    '#eef6df',
                                padding: {
                                    x:
                                        this.mobileControlsEnabled
                                            ? 6
                                            : 7,
                                    y:
                                        this.mobileControlsEnabled
                                            ? 3
                                            : 4,
                                },
                            },
                        )
                        .setOrigin(0.5)
                        .setFixedSize(
                            this.mobileControlsEnabled
                                ? 78
                                : 72,
                            this.mobileControlsEnabled
                                ? 48
                                : 28,
                        )
                        .setAlign('center')
                        .setDepth(873)
                        .setVisible(false)
                        .setInteractive({
                            useHandCursor: true,
                        });

                button.setData(
                    'brushShape',
                    option.shape,
                );

                button.on(
                    'pointerdown',
                    () => {
                        this.eyedropperArmed =
                            false;
                        this.hideEyedropperMagnifier();
                        this.brushShape =
                            option.shape;

                        this.createBrushTexture();
                        this.updatePaintHud();
                        this.updatePaintPreviewImmediately();
                        this.updatePaintControlHelp();
                        this.highlightBrushShape(
                            option.shape,
                        );
                        this.updateEyedropperButtonUi();
                    },
                );

                this.paletteObjects.push(
                    button,
                );
            },
        );

        /*
         * Pixel brush is no longer exposed in the palette.  Its old third
         * slot is now a touch-friendly eyedropper button.
         */
        this.eyedropperButton =
            this.add.text(
                475,
                this.gameHeight - 78,
                this.mobileControlsEnabled
                    ? `💧\n${tr('스포이드')}`
                    : `◉ ${tr('스포이드')}`,
                {
                    fontFamily: 'monospace',
                    fontSize:
                        this.mobileControlsEnabled
                            ? '13px'
                            : '10px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor: '#eef6df',
                    padding: {
                        x: 5,
                        y:
                            this.mobileControlsEnabled
                                ? 3
                                : 4,
                    },
                },
            )
                .setOrigin(0.5)
                .setFixedSize(
                    this.mobileControlsEnabled
                        ? 78
                        : 72,
                    this.mobileControlsEnabled
                        ? 48
                        : 28,
                )
                .setAlign('center')
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.eyedropperButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.finishActivePaintStroke();
                this.isPainting = false;
                this.eyedropperPointerId = -1;

                const localIsHunter =
                    this.isMultiplayerSession() &&
                    this.networkPlayerManager
                        .canLocalControlHunter();

                if (localIsHunter) {
                    this.eyedropperArmed =
                        false;
                    this.hideEyedropperMagnifier();
                    this.showHunterEyedropperDisabledNotice();
                    this.updateEyedropperButtonUi();
                    return;
                }

                /*
                 * Mobile selects the eyedropper deterministically. Desktop
                 * keeps its normal one-click eyedropper help.
                 */
                if (this.mobileControlsEnabled) {
                    this.activateMobileEyedropperTool();
                    return;
                }

                this.eyedropperArmed = true;
                this.updateEyedropperButtonUi();
                this.hideEyedropperMagnifier();

                const showedRightClickTip =
                    this.showDesktopEyedropperRightClickTip();

                if (!showedRightClickTip) {
                    this.showStatus(
                        tr('스포이드: 배경에서 원하는 색을 클릭하세요'),
                    );
                }
            },
        );

        this.paletteObjects.push(
            this.eyedropperButton,
        );

        this.undoPaintButton =
            this.add.text(
                555,
                this.gameHeight - 78,
                `↶ ${tr('되돌리기')}`,
                {
                    fontFamily:
                        'monospace',
                    fontSize:
                        this.mobileControlsEnabled
                            ? '11px'
                            : '9px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor:
                        '#f2e6c8',
                    fixedWidth:
                        this.mobileControlsEnabled
                            ? 80
                            : 76,
                    fixedHeight:
                        this.mobileControlsEnabled
                            ? 38
                            : 28,
                    align: 'center',
                    padding: {
                        top: 7,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.undoPaintButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
                this.finishActivePaintStroke();
                this.clearStraightLinePreview();

                this.undoLastPaintStroke();
            },
        );

        this.undoPaintButton.on(
            'pointerup',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
            },
        );

        this.paletteObjects.push(
            this.undoPaintButton,
        );

        this.redoPaintButton =
            this.add.text(
                635,
                this.gameHeight - 78,
                `↷ ${tr('다시 실행')}`,
                {
                    fontFamily:
                        'monospace',
                    fontSize:
                        this.mobileControlsEnabled
                            ? '11px'
                            : '9px',
                    fontStyle: 'bold',
                    color: '#26352b',
                    backgroundColor:
                        '#dfeeda',
                    fixedWidth:
                        this.mobileControlsEnabled
                            ? 80
                            : 76,
                    fixedHeight:
                        this.mobileControlsEnabled
                            ? 38
                            : 28,
                    align: 'center',
                    padding: {
                        top: 7,
                    },
                },
            )
                .setOrigin(0.5)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.redoPaintButton.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
                this.finishActivePaintStroke();
                this.clearStraightLinePreview();

                this.redoLastPaintStroke();
            },
        );

        this.redoPaintButton.on(
            'pointerup',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.isPainting = false;
            },
        );

        this.paletteObjects.push(
            this.redoPaintButton,
        );

        const sliderMinX = 320;
        const sliderMaxX = 515;
        const sliderY =
            this.gameHeight - 38;

        const setBrushSizeFromSlider =
            (
                screenX: number,
            ): void => {
                const ratio =
                    Phaser.Math.Clamp(
                        (
                            screenX -
                            sliderMinX
                        ) /
                        (
                            sliderMaxX -
                            sliderMinX
                        ),
                        0,
                        1,
                    );

                this.setBrushSize(
                    1 +
                    ratio * 19,
                );
            };

        this.brushSizeSliderTrack =
            this.add.rectangle(
                (sliderMinX +
                    sliderMaxX) / 2,
                sliderY,
                sliderMaxX -
                    sliderMinX,
                this.mobileControlsEnabled
                    ? 10
                    : 6,
                0x6b7280,
                0.55,
            )
                .setScrollFactor(0)
                .setDepth(873)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.brushSizeSliderFill =
            this.add.rectangle(
                sliderMinX,
                sliderY,
                0,
                this.mobileControlsEnabled
                    ? 10
                    : 6,
                0x4f8f67,
                1,
            )
                .setOrigin(0, 0.5)
                .setScrollFactor(0)
                .setDepth(874)
                .setVisible(false);

        this.brushSizeSliderKnob =
            this.add.circle(
                sliderMinX,
                sliderY,
                this.mobileControlsEnabled
                    ? 10
                    : 7,
                0xf8fafc,
                1,
            )
                .setStrokeStyle(
                    2,
                    0x334155,
                    1,
                )
                .setScrollFactor(0)
                .setDepth(875)
                .setVisible(false)
                .setInteractive({
                    useHandCursor: true,
                });

        this.brushSizeSliderLabel =
            this.add.text(
                (sliderMinX +
                    sliderMaxX) / 2,
                sliderY - 18,
                `${this.brushSize}px`,
                {
                    fontFamily:
                        'monospace',
                    fontSize: '11px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(875)
                .setVisible(false);

        const beginSliderDrag =
            (
                pointer:
                    Phaser.Input.Pointer,
            ): void => {
                pointer.event
                    ?.stopPropagation?.();

                this.brushSizeSliderDragging =
                    true;

                setBrushSizeFromSlider(
                    pointer.x,
                );
            };

        this.brushSizeSliderTrack.on(
            'pointerdown',
            beginSliderDrag,
        );

        this.brushSizeSliderKnob.on(
            'pointerdown',
            beginSliderDrag,
        );

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.brushSizeSliderDragging
                ) {
                    return;
                }

                setBrushSizeFromSlider(
                    pointer.x,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            () => {
                this.brushSizeSliderDragging =
                    false;
            },
        );

        const sliderMinLabel =
            this.add.text(
                sliderMinX - 18,
                sliderY,
                '1px',
                {
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#5b4636',
                },
            )
                .setOrigin(1, 0.5)
                .setDepth(875)
                .setVisible(false);

        const sliderMaxLabel =
            this.add.text(
                sliderMaxX + 18,
                sliderY,
                '20px',
                {
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#5b4636',
                },
            )
                .setOrigin(0, 0.5)
                .setDepth(875)
                .setVisible(false);

        this.paletteObjects.push(
            this.brushSizeSliderTrack,
            this.brushSizeSliderFill,
            this.brushSizeSliderKnob,
            this.brushSizeSliderLabel,
            sliderMinLabel,
            sliderMaxLabel,
        );

        this.updateBrushSizeSliderUi();

        this.highlightBrushShape(
            this.brushShape,
        );

        this.paintZoomText = this.add
            .text(
                18,
                118,
                `ZOOM 1.0x\n${tr('마우스 휠')}`,
                {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 8,
                        y: 5,
                    },
                    align: 'center',
                },
            )
            .setOrigin(0, 0)
            .setDepth(872)
            .setVisible(false);

        this.paintControlHelpText =
            this.add
                .text(
                    this.gameWidth - 18,
                    this.gameHeight - 108,
                    '',
                    {
                        fontFamily:
                            'monospace',
                        fontSize: '13px',
                        fontStyle: 'bold',
                        color: '#26352b',
                        backgroundColor:
                            '#fff4d6',
                        padding: {
                            x: 12,
                            y: 8,
                        },
                        align: 'right',
                        lineSpacing: 4,
                    },
                )
                .setOrigin(1, 1)
                .setDepth(875)
                .setVisible(false);

        this.updatePaintControlHelp();
    }

    /*
     * v0.10.10.236.4 MOBILE PAINT TOOL OWNERSHIP
     *
     * Brush and eyedropper are mutually exclusive tools. Switching tools must
     * clear the previous tool's pending pointer/capture/visual state first.
     * Otherwise a stale brush preview can keep following the finger while the
     * eyedropper graphic remains frozen at its old position.
     */
    private activateMobileEyedropperTool(): void {
        /*
         * V1010434_VICTORY_SOCIAL_CARD_POLISH / REMEMBER_PREVIOUS_BRUSH
         * LINE still keeps its own persistent selection semantics; pipette
         * returns to the last normal Circle/Square brush.
         */
        if (!this.eyedropperArmed) {
            this.mobileBrushShapeBeforeEyedropper =
                this.brushShape === 'square'
                    ? 'square'
                    : 'circle';
        }

        this.stopMobileNativeEyedropperDrag();

        this.finishActivePaintStroke();
        this.isPainting = false;

        this.releaseMobilePaintPointer();
        this.cancelMobilePaintHoldTimers();

        this.mobilePendingPaintPointerId = -1;
        this.mobilePendingPaintStartScreen =
            undefined;
        this.mobilePendingPaintStartWorld =
            undefined;
        this.mobilePaintDotCommitted = false;

        this.straightLineStart = undefined;
        this.straightLineStartWorld =
            undefined;
        this.straightLineModeActive = false;
        this.clearStraightLinePreview();

        /*
         * V1010343_URGENT_HUNTER_INPUT_JITTER_EYEDROPPER / EYEDROPPER_STATE_RESET
         * Enter the pipette from a completely neutral paint-pointer state.
         */
        this.mobilePinchActive = false;
        this.mobilePinchDistance = 0;
        this.mobileTouchPoints.clear();

        this.eyedropperArmed = true;
        this.eyedropperPointerId = -1;

        this.mobileEyedropperPreviewColor =
            this.paintColor;
        this.mobileEyedropperLastSampleAt =
            -Infinity;

        /*
         * Kill every brush-only visual before showing the pipette.
         */
        this.paintPreview
            ?.setAlpha(1)
            .setVisible(false);
        this.hideMobilePaintPrecisionGuide();

        /*
         * Reset and redraw the eyedropper at the last brush/tool position.
         */
        this.hideEyedropperMagnifier();
        this.updateEyedropperButtonUi();
        this.showMobileIdleEyedropperGuide();
    }

    private activateMobileBrushTool(
        shape: BrushShape,
    ): void {
        this.stopMobileNativeEyedropperDrag();

        this.finishActivePaintStroke();
        this.isPainting = false;

        this.releaseMobilePaintPointer();
        this.cancelMobilePaintHoldTimers();

        this.mobilePendingPaintPointerId = -1;
        this.mobilePendingPaintStartScreen =
            undefined;
        this.mobilePendingPaintStartWorld =
            undefined;
        this.mobilePaintDotCommitted = false;

        this.eyedropperPointerId = -1;
        this.eyedropperArmed = false;

        /*
         * Kill every eyedropper-only visual before restoring the brush.
         */
        this.hideEyedropperMagnifier();
        this.hideMobilePaintPrecisionGuide();

        this.brushShape = shape;
        this.createBrushTexture();
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.highlightBrushShape(shape);
        this.updateEyedropperButtonUi();

        this.showMobileIdleBrushGuide();
    }

    private updateEyedropperButtonUi(): void {
        this.mobilePaintToolButtons
            .get('eyedropper')
            ?.classList.toggle(
                'is-active',
                this.eyedropperArmed,
            );

        if (!this.eyedropperButton) {
            return;
        }

        this.eyedropperButton
            .setBackgroundColor(
                this.eyedropperArmed
                    ? '#5c8f66'
                    : '#e8efd8',
            )
            .setColor(
                this.eyedropperArmed
                    ? '#fffdf3'
                    : '#26352b',
            );
    }

    private createHunterCamoPalette(): void {
        /*
         * 기본 Hunter Paint 배율(1.05)에서도 오른쪽이 잘리지 않도록
         * 화면 가장자리에서 충분히 안쪽으로 배치합니다.
         */
        const panelX = 755;
        const panelY =
            this.gameHeight - 52;

        const panel =
            this.add.rectangle(
                panelX,
                panelY,
                390,
                86,
                0xfff4d6,
                0.95,
            )
                .setStrokeStyle(
                    2,
                    0x6f8f65,
                    1,
                )
                .setScrollFactor(0)
                .setDepth(880)
                .setVisible(false);

        const title =
            this.add.text(
                575,
                panelY - 31,
                tr('CAMO SWATCH'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
                .setOrigin(0, 0.5)
                .setScrollFactor(0)
                .setDepth(881)
                .setVisible(false);

        const hint =
            this.add.text(
                925,
                panelY - 31,
                tr('배경 대표색'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '10px',
                    color: '#765c49',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(881)
                .setVisible(false);

        this.hunterCamoPaletteObjects.push(
            panel,
            title,
            hint,
        );

        /*
         * 4 x 3 = 12개 정사각형.
         * 실제 색은 각 Paint phase 진입 시 배경에서 다시 샘플링합니다.
         */
        for (
            let index = 0;
            index < 11;
            index += 1
        ) {
            const column =
                index % 6;

            const row =
                Math.floor(
                    index / 6,
                );

            const swatch =
                this.add.rectangle(
                    590 +
                        column * 36,
                    panelY - 4 +
                        row * 29,
                    26,
                    24,
                    0x6f8f65,
                    1,
                )
                    .setStrokeStyle(
                        2,
                        0xffffff,
                        1,
                    )
                    .setScrollFactor(0)
                    .setDepth(882)
                    .setVisible(false)
                    .setInteractive({
                        useHandCursor: true,
                    });

            swatch.setData(
                'hunterCamoIndex',
                index,
            );

            swatch.on(
                'pointerdown',
                (
                    pointer:
                        Phaser.Input.Pointer,
                ) => {
                    /*
                     * 좌/우클릭 모두 색 선택으로 처리.
                     * 월드 pointer handler로 전달되지 않도록 stopPropagation.
                     */
                    pointer.event
                        ?.stopPropagation?.();

                    const color =
                        this.hunterCamoColors[
                            index
                        ];

                    if (
                        typeof color !==
                        'number'
                    ) {
                        return;
                    }

                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    this.paintColor =
                        color;

                    this.createBrushTexture(
                        true,
                    );

                    this.updatePaintHud();
                    this.updatePaintPreviewImmediately();
                    this.highlightPaletteColor(
                        color,
                    );

                    this.highlightHunterCamoColor(
                        index,
                    );
                },
            );

            this.hunterCamoPaletteObjects.push(
                swatch,
            );
        }
    }

    private applyRolePaintPalette(
        localIsHunter: boolean,
    ): void {
        const colors =
            localIsHunter
                ? [
                    ...this.standardPaintColors,
                ]
                : [
                    0x000000,
                    0xf5eee2,
                    ...this.hunterCamoColors,
                ].slice(
                    0,
                    this.standardPaintColors
                        .length,
                );

        const swatches =
            this.paletteObjects
                .filter(
                    (
                        object,
                    ): object is
                        Phaser.GameObjects.Rectangle =>
                        object instanceof
                        Phaser.GameObjects.Rectangle &&
                        typeof object.getData(
                            'paletteColor',
                        ) ===
                            'number',
                );

        swatches.forEach(
            (
                swatch,
                index,
            ) => {
                const color =
                    colors[
                        index %
                            colors.length
                    ] ??
                    this.defaultPaintColor;

                swatch
                    .setFillStyle(
                        color,
                        1,
                    )
                    .setData(
                        'paletteColor',
                        color,
                    );
            },
        );

        /*
         * If the currently selected color vanished when the role palette
         * changed, reset selection to the first available color.
         */
        if (
            !colors.includes(
                this.paintColor,
            )
        ) {
            this.paintColor =
                colors[0] ??
                this.defaultPaintColor;
            this.createBrushTexture();
        }

        this.highlightPaletteColor(
            this.paintColor,
        );
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
    }

    private refreshHunterCamoPalette(): void {
        const sourceImage =
            this.textures
                .get(
                    this.currentBackgroundTextureKey,
                )
                .getSourceImage() as
                    | HTMLImageElement
                    | HTMLCanvasElement;

        if (
            !sourceImage ||
            !sourceImage.width ||
            !sourceImage.height
        ) {
            return;
        }

        /*
         * 원본 전체를 작은 canvas로 축소한 뒤 색을 추출합니다.
         * 따라서 맵의 특정 위치를 알려주는 정보는 노출하지 않고
         * "이 맵에 실제 존재하는 색"만 제공합니다.
         */
        const canvas =
            document.createElement(
                'canvas',
            );

        canvas.width = 96;
        canvas.height = 54;

        const context =
            canvas.getContext(
                '2d',
                {
                    willReadFrequently:
                        true,
                },
            );

        if (!context) {
            return;
        }

        context.imageSmoothingEnabled =
            false;

        context.drawImage(
            sourceImage,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        const pixels =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

        const candidates:
            Array<{
                color: number;
                r: number;
                g: number;
                b: number;
            }> = [];

        /*
         * 매 라운드 후보 위치를 랜덤하게 뽑습니다.
         * 지나치게 검거나 하얀 UI성 색은 제외하고,
         * RGB를 약간 양자화해서 거의 같은 색의 중복을 줄입니다.
         */
        for (
            let sample = 0;
            sample < 260;
            sample += 1
        ) {
            const x =
                Phaser.Math.Between(
                    0,
                    canvas.width - 1,
                );

            const y =
                Phaser.Math.Between(
                    0,
                    canvas.height - 1,
                );

            const offset =
                (
                    y *
                        canvas.width +
                    x
                ) * 4;

            const rawR =
                pixels[offset];

            const rawG =
                pixels[
                    offset + 1
                ];

            const rawB =
                pixels[
                    offset + 2
                ];

            const brightness =
                (
                    rawR +
                    rawG +
                    rawB
                ) / 3;

            if (
                brightness < 32 ||
                brightness > 238
            ) {
                continue;
            }

            const quantize =
                (
                    value: number,
                ): number =>
                    Phaser.Math.Clamp(
                        Math.round(
                            value / 16,
                        ) * 16,
                        0,
                        255,
                    );

            const r =
                quantize(rawR);

            const g =
                quantize(rawG);

            const b =
                quantize(rawB);

            const color =
                Phaser.Display.Color
                    .GetColor(
                        r,
                        g,
                        b,
                    );

            if (
                candidates.some(
                    (candidate) =>
                        candidate.color ===
                        color,
                )
            ) {
                continue;
            }

            candidates.push({
                color,
                r,
                g,
                b,
            });
        }

        /*
         * 너무 비슷한 색만 몰리지 않게 greedy diversity 선택.
         */
        Phaser.Utils.Array.Shuffle(
            candidates,
        );

        const selected:
            typeof candidates = [];

        for (
            const candidate of
                candidates
        ) {
            const sufficientlyDifferent =
                selected.every(
                    (picked) => {
                        const distance =
                            Math.sqrt(
                                (
                                    candidate.r -
                                    picked.r
                                ) ** 2 +
                                (
                                    candidate.g -
                                    picked.g
                                ) ** 2 +
                                (
                                    candidate.b -
                                    picked.b
                                ) ** 2,
                            );

                        return (
                            distance >=
                            38
                        );
                    },
                );

            if (
                !sufficientlyDifferent &&
                selected.length >= 4
            ) {
                continue;
            }

            selected.push(
                candidate,
            );

            if (
                selected.length >= 12
            ) {
                break;
            }
        }

        /*
         * 샘플 다양성이 부족한 경우 forest 계열 기본색으로 보충.
         */
        const fallbackColors = [
            0x77a83b,
            0x4f7e36,
            0xa8c95a,
            0x6b8f47,
            0xc5b96b,
            0x8a6a42,
            0x557f68,
            0x88b66c,
            0x659cc2,
            0x557d9a,
            0x9c8f65,
            0x6e7756,
        ];

        this.hunterCamoColors =
            selected
                .map(
                    (item) =>
                        item.color,
                )
                .slice(
                    0,
                    13,
                );

        for (
            const fallback of
                fallbackColors
        ) {
            if (
                this.hunterCamoColors
                    .length >= 13
            ) {
                break;
            }

            if (
                !this.hunterCamoColors
                    .includes(
                        fallback,
                    )
            ) {
                this.hunterCamoColors
                    .push(
                        fallback,
                    );
            }
        }

        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    if (
                        !(
                            object instanceof
                            Phaser.GameObjects
                                .Rectangle
                        )
                    ) {
                        return;
                    }

                    const index =
                        object.getData(
                            'hunterCamoIndex',
                        );

                    if (
                        typeof index !==
                        'number'
                    ) {
                        return;
                    }

                    const color =
                        this.hunterCamoColors[
                            index
                        ];

                    if (
                        typeof color ===
                        'number'
                    ) {
                        object.setFillStyle(
                            color,
                            1,
                        );
                    }
                },
            );
    }

    private setHunterCamoPaletteVisible(
        visible: boolean,
    ): void {
        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    const visibleObject =
                        object as
                            Phaser.GameObjects
                                .GameObject & {
                                setVisible?: (
                                    value:
                                        boolean,
                                ) => unknown;
                            };

                    visibleObject
                        .setVisible?.(
                            visible,
                        );
                },
            );
    }

    private highlightHunterCamoColor(
        selectedIndex: number,
    ): void {
        this.hunterCamoPaletteObjects
            .forEach(
                (object) => {
                    if (
                        !(
                            object instanceof
                            Phaser.GameObjects
                                .Rectangle
                        )
                    ) {
                        return;
                    }

                    const index =
                        object.getData(
                            'hunterCamoIndex',
                        );

                    if (
                        typeof index !==
                        'number'
                    ) {
                        return;
                    }

                    object.setStrokeStyle(
                        index ===
                            selectedIndex
                            ? 4
                            : 2,
                        index ===
                            selectedIndex
                            ? 0x111827
                            : 0xffffff,
                        1,
                    );
                },
            );
    }

    private updatePaintControlHelp(): void {
        /*
         * v0.10.10.100:
         * Legacy paint-control instructions intentionally removed.
         */
        this.paintControlHelpText
            ?.setText('')
            .setVisible(false);
    }

    private setPaintPaletteVisible(
        visible: boolean,
    ): void {
        /*
         * v0.10.10.105:
         * Desktop keeps the proven Phaser palette.
         * Mobile uses the responsive DOM dock so controls never overlap.
         */
        /*
         * v0.10.10.107:
         * Use the redesigned Paint dock on BOTH desktop and mobile.
         * The legacy Phaser palette is now hidden everywhere.
         */
        this.paletteObjects.forEach(
            (object) => {
                const visibleObject =
                    object as Phaser.GameObjects.GameObject & {
                        setVisible?: (
                            value: boolean,
                        ) => unknown;
                    };

                visibleObject.setVisible?.(
                    false,
                );
            },
        );

        this.setMobilePaintDockVisible(
            visible,
        );

        /*
         * v0.10.10.100:
         * Old ZOOM / mouse-wheel / paint-control help is removed on all
         * devices. The freed top-left area belongs to chat.
         */
        this.paintZoomText
            ?.setText('')
            .setVisible(false);

        this.paintControlHelpText
            ?.setText('')
            .setVisible(false);
    }

    private highlightPaletteColor(
        selectedColor: number,
    ): void {
        this.mobilePaintColorButtons
            .forEach(
                (button) => {
                    button.classList.toggle(
                        'is-active',
                        Number(
                            button.dataset.color,
                        ) ===
                            selectedColor,
                    );
                },
            );

        this.paletteObjects.forEach(
            (object) => {
                if (
                    !(object instanceof
                        Phaser.GameObjects.Rectangle)
                ) {
                    return;
                }

                const color =
                    object.getData(
                        'paletteColor',
                    );

                if (
                    typeof color !==
                    'number'
                ) {
                    return;
                }

                object.setStrokeStyle(
                    color ===
                        selectedColor
                        ? 4
                        : 2,
                    color ===
                        selectedColor
                        ? 0x111827
                        : 0xffffff,
                    1,
                );
            },
        );
    }

    private setBrushSize(
        requestedSize: number,
    ): void {
        const nextSize =
            Phaser.Math.Clamp(
                Math.round(requestedSize),
                1,
                20,
            );

        this.brushSize =
            nextSize;

        /*
         * One authoritative update path for slider / Ctrl+wheel / keys.
         * The slider knob can therefore never drift away from brushSize.
         */
        this.createBrushTexture(true);
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();
        this.updateBrushSizeSliderUi();
        this.syncMobilePaintDockUi();
    }

    private updateBrushSizeSliderUi(): void {
        if (
            !this.brushSizeSliderTrack ||
            !this.brushSizeSliderFill ||
            !this.brushSizeSliderKnob ||
            !this.brushSizeSliderLabel
        ) {
            return;
        }

        const minX = 320;
        const maxX = 515;

        const ratio =
            Phaser.Math.Clamp(
                (this.brushSize - 1) /
                    19,
                0,
                1,
            );

        const baseKnobX =
            Phaser.Math.Linear(
                minX,
                maxX,
                ratio,
            );

        const fillWidth =
            Math.max(
                0,
                baseKnobX -
                    minX,
            );

        /*
         * fixedHudBaseTransforms is the single source of truth for screen HUD.
         * Update the UNZOOMED base positions, then apply camera compensation
         * exactly once.  This avoids the old double compensation that made
         * the knob drift while zoomed.
         */
        const knobBase =
            this.fixedHudBaseTransforms
                .get(
                    this.brushSizeSliderKnob,
                );

        if (knobBase) {
            knobBase.x =
                baseKnobX;
        } else {
            this.brushSizeSliderKnob
                .setX(
                    baseKnobX,
                );
        }

        const fillBase =
            this.fixedHudBaseTransforms
                .get(
                    this.brushSizeSliderFill,
                );

        if (fillBase) {
            fillBase.x =
                minX;
        }

        this.brushSizeSliderFill
            .setSize(
                fillWidth,
                6,
            );

        this.brushSizeSliderLabel
            .setText(
                `${this.brushSize}px`,
            );

        if (
            this.fixedHudBaseTransforms
                .has(
                    this.brushSizeSliderKnob,
                )
        ) {
            this.applyFixedHudForZoom(
                this.cameras.main.zoom,
            );
        }
    }

    private highlightBrushShape(
        selectedShape: BrushShape,
    ): void {
        this.mobilePaintToolButtons
            .get('circle')
            ?.classList.toggle(
                'is-active',
                !this.eyedropperArmed &&
                    selectedShape ===
                        'circle',
            );

        this.mobilePaintToolButtons
            .get('square')
            ?.classList.toggle(
                'is-active',
                !this.eyedropperArmed &&
                    selectedShape ===
                        'square',
            );

        this.paletteObjects.forEach(
            (object) => {
                if (
                    !(object instanceof
                        Phaser.GameObjects.Text)
                ) {
                    return;
                }

                const shape =
                    object.getData(
                        'brushShape',
                    ) as
                        | BrushShape
                        | undefined;

                if (!shape) {
                    return;
                }

                object
                    .setBackgroundColor(
                        shape === selectedShape
                            ? '#9fbd86'
                            : '#e8efd8',
                    )
                    .setColor(
                        '#26352b',
                    );
            },
        );
    }

    private showDesktopEyedropperRightClickTip(): boolean {
        if (this.mobileControlsEnabled) {
            return false;
        }

        /*
         * v0.10.10.238.9:
         * v238.7 could increment the original counter even when its Phaser
         * status message was instantly cleared. Use a fresh versioned key so
         * every desktop Hider gets three ACTUALLY VISIBLE tutorial toasts.
         */
        const storageKey =
            'colorhunt-eyedropper-rightclick-tip-count-v2';

        const shownCount =
            Math.max(
                0,
                Number.parseInt(
                    localStorage.getItem(
                        storageKey,
                    ) ?? '0',
                    10,
                ) || 0,
            );

        if (shownCount >= 3) {
            return false;
        }

        /*
         * v0.10.10.238.8
         * Do NOT use showStatus() for this tutorial.
         * Paint-phase status is frequently refreshed/cleared by other HUD
         * updates, so the previous v238.7 message could disappear within the
         * same frame and look as if it never appeared.
         *
         * Use a dedicated fixed DOM toast that is independent from Phaser HUD.
         */
        document
            .querySelector(
                '.colorhunt-desktop-eyedropper-tip',
            )
            ?.remove();

        const toast =
            document.createElement(
                'div',
            );

        toast.className =
            'colorhunt-desktop-eyedropper-tip';

        toast.textContent =
            (
                {
                    ko: '💡 스포이드는 우클릭으로도 바로 사용할 수 있어요!',
                    ja: '💡 スポイトは右クリックでもすぐ使えます！',
                    en: '💡 You can also use the eyedropper instantly with right-click!',
                    zh: '💡 吸管工具也可以直接用鼠标右键使用！',
                } as const
            )[getLanguage()];

        Object.assign(
            toast.style,
            {
                position: 'fixed',
                left: '50%',
                top: '18%',
                transform:
                    'translateX(-50%)',
                zIndex: '10040',
                maxWidth:
                    'min(620px, calc(100vw - 40px))',
                boxSizing: 'border-box',
                padding: '11px 18px',
                border:
                    '2px solid rgba(111,143,101,.96)',
                borderRadius: '13px',
                background:
                    'rgba(255,249,230,.97)',
                color: '#284333',
                boxShadow:
                    '0 8px 24px rgba(25,48,32,.25)',
                fontFamily:
                    'Arial, sans-serif',
                fontSize:
                    'clamp(14px, 1.6vw, 18px)',
                lineHeight: '1.35',
                fontWeight: '900',
                textAlign: 'center',
                pointerEvents: 'none',
                whiteSpace: 'normal',
            },
        );

        document.body.appendChild(
            toast,
        );

        localStorage.setItem(
            storageKey,
            String(
                shownCount + 1,
            ),
        );

        window.setTimeout(
            () => {
                toast.remove();
            },
            2600,
        );

        return true;
    }

    private createPaintTools(): void {
        this.paintPreview = this.add.graphics();
        this.paintPreview.setDepth(200);
        this.paintPreview.setVisible(false);

        this.straightLinePreview =
            this.add.graphics()
                /*
                 * Hunter customization uses player depth ~920 and paint
                 * texture depth ~921. Keep the line preview above both so
                 * Shift straight-line guidance is visible for Hunter too.
                 */
                .setDepth(975)
                .setVisible(false);

        this.createBrushTexture();
        this.redrawPaintPreview();
    }

    private getPaintPreviewBrushSize(): number {
        /*
         * Hider Paint:
         * 카메라 zoom이 preview와 실제 캐릭터를 함께 확대하므로
         * world brushSize 그대로 사용합니다.
         *
         * Hunter Paint:
         * 캐릭터 container 자체가 customization mode에서 3배 확대됩니다.
         * 실제 stamp는 80x120 paint texture의 local 좌표계에 찍히므로,
         * 화면에서 보이는 실제 칠 영역도 container scale만큼 커집니다.
         * preview는 container 밖의 world Graphics이므로 동일 scale을
         * 직접 반영해야 화면상 크기가 정확히 일치합니다.
         */
        if (
            multiplayerClient.isConnected() &&
            this.phase === 'paint' &&
            this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return (
                this.brushSize *
                this.networkPlayerManager
                    .getLocalPlayerVisualScale()
            );
        }

        return this.brushSize;
    }

    private redrawPaintPreview(): void {
        if (!this.paintPreview) {
            return;
        }

        const previewSize =
            this.getPaintPreviewBrushSize();

        this.paintPreview.clear();
        this.paintPreview.fillStyle(
            this.paintColor,
            0.45,
        );
        this.paintPreview.lineStyle(
            1,
            0x111827,
            0.95,
        );

        /*
         * v218: brushSize is the real pixel diameter, not a radius.
         * The old code made 2px preview/stamp look roughly 5px wide.
         */
        const diameter = Math.max(
            1,
            previewSize,
        );

        if (this.brushSize === 1) {
            this.paintPreview.fillRect(
                -diameter / 2,
                -diameter / 2,
                diameter,
                diameter,
            );
            return;
        }

        if (
            this.brushShape === 'dotCircle' ||
            this.brushShape === 'circle'
        ) {
            const visibleRadius = diameter / 2;

            this.paintPreview.fillCircle(
                0,
                0,
                visibleRadius,
            );
            this.paintPreview.strokeCircle(
                0,
                0,
                visibleRadius,
            );
            return;
        }

        this.paintPreview.fillRect(
            -diameter / 2,
            -diameter / 2,
            diameter,
            diameter,
        );

        this.paintPreview.strokeRect(
            -diameter / 2,
            -diameter / 2,
            diameter,
            diameter,
        );
    }

    private getPointerWorldPoint(
        pointer: Phaser.Input.Pointer,
        screenOffsetY = 0,
    ): Phaser.Math.Vector2 {
        /*
         * v0.10.10.104:
         * Never trust cached pointer.worldX/worldY for precision painting.
         * After orientation/fullscreen/Fold/visualViewport changes those
         * cached values can briefly reflect an older camera transform.
         *
         * Convert the CURRENT Phaser screen coordinates through the CURRENT
         * camera every time instead.
         */
        const result =
            new Phaser.Math.Vector2();

        this.cameras.main.getWorldPoint(
            pointer.x,
            pointer.y + screenOffsetY,
            result,
        );

        return result;
    }

    private getPaintInputWorldPoint(
        pointer: Phaser.Input.Pointer,
    ): Phaser.Math.Vector2 {
        /*
         * V1010408_FINGER_DIRECT_TOUCH_COORDINATE
         *
         * Restore the known-good input contract:
         *
         * Finger Paint    -> paint EXACTLY under the fingertip.
         * Precision Brush -> keep the visible diagonal-brush offset.
         *
         * Do not hide an offset bug visually; choose the correct world point
         * at the single authoritative coordinate function.
         */
        if (
            !this.mobileControlsEnabled ||
            this.mobilePaintInputMode ===
                'finger'
        ) {
            return this.getPointerWorldPoint(
                pointer,
            );
        }

        /*
         * Mobile precision brush:
         * the fingertip holds the lower-right end of a diagonal brush.
         * The actual paint footprint sits 72 screen px left and 82 px above
         * the finger, keeping both the grip and the paint tip visible.
         */
        const result =
            new Phaser.Math.Vector2();

        this.cameras.main.getWorldPoint(
            pointer.x - 46,
            pointer.y - 54,
            result,
        );

        return result;
    }

    private getPaintPreviewWorldPoint(
        pointer: Phaser.Input.Pointer,
    ): Phaser.Math.Vector2 {
        const target =
            this.getPaintInputWorldPoint(
                pointer,
            );

        if (
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !==
                    'hider'
            ) ||
            !this.networkPlayerManager
        ) {
            return target;
        }

        const container =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!container) {
            return target;
        }

        const scaleX =
            container.scaleX || 1;

        const scaleY =
            container.scaleY || 1;

        /*
         * paintLocalPlayer() converts world -> character-local -> texture
         * and rounds to an integer texture pixel before stamping.
         *
         * Do that exact same conversion here, then convert the snapped pixel
         * back to world space. The visible brush therefore sits on the exact
         * center of the pixels that will actually be painted.
         */
        const localX =
            (
                target.x -
                container.x
            ) /
            scaleX;

        const localY =
            (
                target.y -
                container.y
            ) /
            scaleY;

        const textureX =
            Math.round(
                localX + 40,
            );

        const textureY =
            Math.round(
                localY + 60,
            );

        return new Phaser.Math.Vector2(
            container.x +
                (
                    textureX - 40
                ) *
                    scaleX,
            container.y +
                (
                    textureY - 60
                ) *
                    scaleY,
        );
    }

    private ensureMobilePaintPrecisionGuide(): void {
        if (
            this.mobilePaintPrecisionRing &&
            this.mobilePaintPrecisionCrosshair &&
            this.mobilePaintPrecisionHandle
        ) {
            return;
        }

        this.mobilePaintPrecisionRing =
            this.add.circle(
                0,
                0,
                25,
                0xffffff,
                0.08,
            )
                .setStrokeStyle(
                    3,
                    0x172027,
                    0.78,
                )
                .setDepth(6500)
                .setVisible(false);

        this.mobilePaintPrecisionCrosshair =
            this.add.graphics()
                .setDepth(6501)
                .setVisible(false);

        this.mobilePaintPrecisionHandle =
            this.add.graphics()
                .setDepth(6502)
                .setVisible(false);
    }

    private updateMobilePaintPrecisionGuide(
        pointer: Phaser.Input.Pointer,
    ): void {
        /* V1010407_FINGER_PRECISION_VISUAL_AUTHORITY: Finger Paint never owns the precision-brush visual. */
        if (
            !this.mobileControlsEnabled ||
            this.phase !== 'paint' ||
            this.mobilePaintInputMode !== 'brush'
        ) {
            this.mobilePaintPrecisionRing?.setVisible(false);
            this.mobilePaintPrecisionCrosshair?.setVisible(false);
            this.mobilePaintPrecisionHandle
                ?.clear()
                .setVisible(false);
            return;
        }

        this.ensureMobilePaintPrecisionGuide();

        const target =
            this.getPaintPreviewWorldPoint(
                pointer,
            );

        this.mobileLastBrushTargetWorld =
            target.clone();

        const fingerWorld =
            this.getPointerWorldPoint(
                pointer,
            );

        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        const accent =
            this.straightLineModeActive
                ? 0xf59e0b
                : 0x172027;

        /*
         * The translucent paintPreview is the exact stamp footprint.
         * This ring + stem is the 'brush handle': users can always see why
         * the paint lands above their fingertip instead of guessing.
         */
        const guideSize = Math.max(
            12 / zoom,
            this.getPaintPreviewBrushSize(),
        );

        this.mobilePaintPrecisionRing
            ?.setPosition(
                target.x,
                target.y,
            )
            .setRadius(guideSize)
            .setStrokeStyle(
                this.straightLineModeActive
                    ? 4 / zoom
                    : 2.5 / zoom,
                accent,
                0.92,
            )
            .setVisible(false);

        this.mobilePaintPrecisionCrosshair
            ?.clear()
            .lineStyle(
                2 / zoom,
                accent,
                0.9,
            );

        if (this.brushShape !== 'square') {
            this.mobilePaintPrecisionCrosshair
                ?.lineBetween(
                    target.x - 10 / zoom,
                    target.y,
                    target.x + 10 / zoom,
                    target.y,
                )
                .lineBetween(
                    target.x,
                    target.y - 10 / zoom,
                    target.x,
                    target.y + 10 / zoom,
                );
        }

        /* Square paintPreview already draws the exact stamp outline. */
        this.mobilePaintPrecisionCrosshair
            ?.setVisible(false);

        const dx = fingerWorld.x - target.x;
        const dy = fingerWorld.y - target.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const ferruleX = target.x + ux * (22 / zoom);
        const ferruleY = target.y + uy * (22 / zoom);

        /*
         * V1010349_PAINT_BANNER_TOOL_ART_JOYSTICK_CENTER / DETAILED_LIVE_BRUSH
         *
         * A recognizable real brush:
         * dark wooden shaft -> warm wood body -> wood highlight ->
         * dark ferrule edge -> silver ferrule -> colored bristle head.
         * No circular grip marker.
         */
        const handleEndX =
            fingerWorld.x;
        const handleEndY =
            fingerWorld.y;

        const buttInsetX =
            handleEndX - ux * (4 / zoom);
        const buttInsetY =
            handleEndY - uy * (4 / zoom);

        this.mobilePaintPrecisionHandle
            ?.clear()
            /* dark shaft silhouette */
            .lineStyle(
                this.straightLineModeActive
                    ? 12 / zoom
                    : 10 / zoom,
                0x3b2b20,
                0.98,
            )
            .lineBetween(
                ferruleX,
                ferruleY,
                handleEndX,
                handleEndY,
            )
            /* wooden shaft */
            .lineStyle(
                this.straightLineModeActive
                    ? 8 / zoom
                    : 7 / zoom,
                this.straightLineModeActive
                    ? 0xe49a3a
                    : 0xb86f36,
                1,
            )
            .lineBetween(
                ferruleX,
                ferruleY,
                handleEndX,
                handleEndY,
            )
            /* wood highlight */
            .lineStyle(
                2 / zoom,
                0xf2c184,
                0.9,
            )
            .lineBetween(
                ferruleX + px * (2 / zoom),
                ferruleY + py * (2 / zoom),
                buttInsetX + px * (2 / zoom),
                buttInsetY + py * (2 / zoom),
            )
            /* flat dark butt cap, clearly the handle end */
            .lineStyle(
                9 / zoom,
                0x33251c,
                1,
            )
            .lineBetween(
                handleEndX - px * (4 / zoom),
                handleEndY - py * (4 / zoom),
                handleEndX + px * (4 / zoom),
                handleEndY + py * (4 / zoom),
            )
            /* ferrule dark edge */
            .lineStyle(
                12 / zoom,
                0x43505a,
                1,
            )
            .lineBetween(
                target.x + ux * (9 / zoom),
                target.y + uy * (9 / zoom),
                ferruleX,
                ferruleY,
            )
            /* silver ferrule */
            .lineStyle(
                8 / zoom,
                0xdde6eb,
                1,
            )
            .lineBetween(
                target.x + ux * (9 / zoom),
                target.y + uy * (9 / zoom),
                ferruleX,
                ferruleY,
            )
            /* ferrule highlight */
            .lineStyle(
                2 / zoom,
                0xffffff,
                0.9,
            )
            .lineBetween(
                target.x + ux * (11 / zoom) + px * (2 / zoom),
                target.y + uy * (11 / zoom) + py * (2 / zoom),
                ferruleX + px * (2 / zoom),
                ferruleY + py * (2 / zoom),
            )
            /* bristle dark silhouette */
            .fillStyle(
                0x3a3028,
                1,
            )
            .fillTriangle(
                target.x - ux * (2 / zoom),
                target.y - uy * (2 / zoom),
                target.x + ux * (18 / zoom) - px * (9 / zoom),
                target.y + uy * (18 / zoom) - py * (9 / zoom),
                target.x + ux * (18 / zoom) + px * (9 / zoom),
                target.y + uy * (18 / zoom) + py * (9 / zoom),
            )
            /* selected-color bristles */
            .fillStyle(
                this.paintColor,
                0.98,
            )
            .fillTriangle(
                target.x,
                target.y,
                target.x + ux * (16 / zoom) - px * (7 / zoom),
                target.y + uy * (16 / zoom) - py * (7 / zoom),
                target.x + ux * (16 / zoom) + px * (7 / zoom),
                target.y + uy * (16 / zoom) + py * (7 / zoom),
            )
            .setVisible(true);
    }

    private showMobileIdleBrushGuide(): void {
        if (
            this.mobilePaintInputMode !== 'brush'
        ) {
            this.mobilePaintPrecisionRing?.setVisible(false);
            this.mobilePaintPrecisionCrosshair?.setVisible(false);
            this.mobilePaintPrecisionHandle
                ?.clear()
                .setVisible(false);
            return;
        }

        if (
            !this.mobileControlsEnabled ||
            this.phase !== 'paint' ||
            this.eyedropperArmed ||
            this.isPainting ||
            this.mobilePendingPaintPointerId >= 0 ||
            !this.paintPreview
        ) {
            return;
        }

        this.ensureMobilePaintPrecisionGuide();

        const container =
            this.networkPlayerManager
                ?.getLocalPlayerContainer?.();

        if (!container) {
            return;
        }

        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        const visualScale =
            Math.max(
                Math.abs(container.scaleX || 1),
                Math.abs(container.scaleY || 1),
            );

        /*
         * Keep the brush where the player last painted. Only the very first
         * time falls back to the character. The lower-right grip mirrors the
         * exact (-72, -82) screen-pixel input offset used while painting.
         */
        const target =
            this.mobileLastBrushTargetWorld?.clone() ??
            new Phaser.Math.Vector2(
                container.x,
                container.y - 18 * visualScale,
            );

        const grip =
            new Phaser.Math.Vector2(
                target.x + 72 / zoom,
                target.y + 82 / zoom,
            );

        this.paintPreview
            .setPosition(
                target.x,
                target.y,
            );
        this.redrawPaintPreview();
        this.paintPreview
            .setAlpha(0.68)
            .setVisible(true);

        const idleGuideSize = Math.max(
            13 / zoom,
            this.getPaintPreviewBrushSize(),
        );

        this.mobilePaintPrecisionRing
            ?.setPosition(
                target.x,
                target.y,
            )
            .setRadius(idleGuideSize)
            .setStrokeStyle(
                3 / zoom,
                0x172027,
                0.9,
            )
            .setVisible(false);

        this.mobilePaintPrecisionCrosshair
            ?.clear()
            .lineStyle(
                2 / zoom,
                0xffffff,
                0.96,
            );

        if (this.brushShape !== 'square') {
            this.mobilePaintPrecisionCrosshair
                ?.lineBetween(
                    target.x - 10 / zoom,
                    target.y,
                    target.x + 10 / zoom,
                    target.y,
                )
                .lineBetween(
                    target.x,
                    target.y - 10 / zoom,
                    target.x,
                    target.y + 10 / zoom,
                );
        }

        /* Square paintPreview already draws the exact stamp outline. */
        this.mobilePaintPrecisionCrosshair
            ?.setVisible(false);

        /*
         * A real brush silhouette: diagonal wooden shaft, silver ferrule,
         * colored bristles, and a large grab knob that stays clear of the
         * fingertip.
         */
        const dx = grip.x - target.x;
        const dy = grip.y - target.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const ferruleX = target.x + ux * (24 / zoom);
        const ferruleY = target.y + uy * (24 / zoom);

        /*
         * V1010349_PAINT_BANNER_TOOL_ART_JOYSTICK_CENTER / DETAILED_IDLE_BRUSH
         * Same art language as the live brush so Practice and Game are
         * visually identical.
         */
        const handleEndX =
            grip.x;
        const handleEndY =
            grip.y;

        this.mobilePaintPrecisionHandle
            ?.clear()
            .lineStyle(
                12 / zoom,
                0x3b2b20,
                0.98,
            )
            .lineBetween(
                ferruleX,
                ferruleY,
                handleEndX,
                handleEndY,
            )
            .lineStyle(
                7 / zoom,
                0xb86f36,
                1,
            )
            .lineBetween(
                ferruleX,
                ferruleY,
                handleEndX,
                handleEndY,
            )
            .lineStyle(
                2 / zoom,
                0xf2c184,
                0.92,
            )
            .lineBetween(
                ferruleX + px * (2 / zoom),
                ferruleY + py * (2 / zoom),
                handleEndX - ux * (5 / zoom) +
                    px * (2 / zoom),
                handleEndY - uy * (5 / zoom) +
                    py * (2 / zoom),
            )
            .lineStyle(
                10 / zoom,
                0x33251c,
                1,
            )
            .lineBetween(
                handleEndX - px * (4 / zoom),
                handleEndY - py * (4 / zoom),
                handleEndX + px * (4 / zoom),
                handleEndY + py * (4 / zoom),
            )
            .lineStyle(
                13 / zoom,
                0x43505a,
                1,
            )
            .lineBetween(
                target.x + ux * (9 / zoom),
                target.y + uy * (9 / zoom),
                ferruleX,
                ferruleY,
            )
            .lineStyle(
                9 / zoom,
                0xdde6eb,
                1,
            )
            .lineBetween(
                target.x + ux * (9 / zoom),
                target.y + uy * (9 / zoom),
                ferruleX,
                ferruleY,
            )
            .lineStyle(
                2 / zoom,
                0xffffff,
                0.9,
            )
            .lineBetween(
                target.x + ux * (11 / zoom) +
                    px * (2 / zoom),
                target.y + uy * (11 / zoom) +
                    py * (2 / zoom),
                ferruleX + px * (2 / zoom),
                ferruleY + py * (2 / zoom),
            )
            .fillStyle(
                0x3a3028,
                1,
            )
            .fillTriangle(
                target.x - ux * (2 / zoom),
                target.y - uy * (2 / zoom),
                target.x + ux * (20 / zoom) -
                    px * (9 / zoom),
                target.y + uy * (20 / zoom) -
                    py * (9 / zoom),
                target.x + ux * (20 / zoom) +
                    px * (9 / zoom),
                target.y + uy * (20 / zoom) +
                    py * (9 / zoom),
            )
            .fillStyle(
                this.paintColor,
                0.98,
            )
            .fillTriangle(
                target.x,
                target.y,
                target.x + ux * (18 / zoom) -
                    px * (7 / zoom),
                target.y + uy * (18 / zoom) -
                    py * (7 / zoom),
                target.x + ux * (18 / zoom) +
                    px * (7 / zoom),
                target.y + uy * (18 / zoom) +
                    py * (7 / zoom),
            )
            .setVisible(true);
    }

    /*
     * V1010411C_REMOVE_OBSOLETE_LINE_READY_FX
     * The old long-hold straight-line activation was removed in v411b.
     * Its orange "LINE READY" feedback helper is therefore intentionally gone.
     * Explicit LINE selection now uses the toolbar button's active state.
     */


    private hideMobilePaintPrecisionGuide(): void {
        this.mobilePaintPrecisionRing
            ?.setVisible(false);

        this.mobilePaintPrecisionCrosshair
            ?.clear()
            .setVisible(false);

        this.mobilePaintPrecisionHandle
            ?.clear()
            .setVisible(false);
    }

    private showMobilePendingPaintPreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        const target =
            this.getPaintPreviewWorldPoint(
                pointer,
            );

        this.updateMobilePaintPrecisionGuide(
            pointer,
        );

        this.paintPreview
            .setPosition(
                target.x,
                target.y,
            );

        this.redrawPaintPreview();

        /*
         * Tap shows the exact color + footprint that WOULD be painted,
         * but does not modify the character yet.
         */
        this.paintPreview
            .setAlpha(0.72)
            .setVisible(true);
    }

    private clearMobilePendingPaint(
        hidePreview = true,
    ): void {
        this.cancelMobilePaintHoldTimers();

        this.mobilePendingPaintPointerId =
            -1;

        this.mobilePendingPaintStartScreen =
            undefined;

        this.mobilePendingPaintStartWorld =
            undefined;

        this.mobilePaintDotCommitted =
            false;
        this.mobilePaintHoldArmed =
            false;

        if (hidePreview) {
            if (
                this.mobileControlsEnabled &&
                this.phase === 'paint' &&
                !this.eyedropperArmed
            ) {
                this.showMobileIdleBrushGuide();
            } else {
                this.paintPreview
                    ?.setAlpha(1)
                    .setVisible(false);

                this.hideMobilePaintPrecisionGuide();
            }
        }
    }

    private captureMobilePaintPointer(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (
            !this.mobileControlsEnabled
        ) {
            return;
        }

        /*
         * v0.10.10.194:
         * Do this BEFORE checking PointerEvent. iOS/embedded WebViews can
         * expose the Phaser touch as TouchEvent instead; previously that
         * early return meant the palette stayed touchable and stole the
         * stroke the instant the finger crossed over it.
         */
        this.mobilePaintDock?.classList.add(
            'colorhunt-paint-dock--paint-pass-through',
        );

        /*
         * READY is a DOM button floating above the canvas. While a brush or
         * eyedropper finger is already active it must become completely
         * transparent to hit-testing, otherwise crossing it can stall pointer
         * delivery and leave the gesture in pinch/zoom state.
         */
        this.paintReadyDomButton?.style.setProperty(
            'pointer-events',
            'none',
            'important',
        );

        this.pruneMobileTouchPoints();

        const realPaintTouches =
            [...this.mobileTouchPoints.keys()]
                .filter(
                    (id) =>
                        this.isMobilePointerActuallyDown(
                            id,
                        ),
                )
                .length;

        if (realPaintTouches < 2) {
            this.mobilePinchActive = false;
            this.mobilePinchDistance = 0;
        }

        const nativeEvent =
            pointer.event;

        if (
            !(nativeEvent instanceof PointerEvent)
        ) {
            return;
        }

        const nativePointerId =
            nativeEvent.pointerId;

        try {
            if (
                !this.game.canvas.hasPointerCapture(
                    nativePointerId,
                )
            ) {
                this.game.canvas.setPointerCapture(
                    nativePointerId,
                );
            }

            this.mobilePaintCapturedNativePointerId =
                nativePointerId;

            /*
             * While one finger owns a paint stroke, the DOM paint dock must
             * become transparent to pointer hit-testing. This is a fallback
             * for WebViews/Safari builds where setPointerCapture is flaky:
             * crossing over the palette can no longer cut the stroke.
             */
        } catch {
            /*
             * Pointer capture can be unavailable in a few embedded WebViews.
             * Painting still falls back to the previous behavior there.
             */
        }
    }

    private releaseMobilePaintPointer(
        pointer?:
            Phaser.Input.Pointer,
    ): void {
        let nativePointerId =
            this.mobilePaintCapturedNativePointerId;

        const nativeEvent =
            pointer?.event;

        if (
            nativeEvent instanceof
                PointerEvent
        ) {
            nativePointerId =
                nativeEvent.pointerId;
        }

        if (
            nativePointerId <
                0
        ) {
            /* TouchEvent/WebView path has no native PointerEvent id. */
            this.mobilePaintDock?.classList.remove(
                'colorhunt-paint-dock--paint-pass-through',
            );
            this.paintReadyDomButton?.style.removeProperty(
                'pointer-events',
            );
            return;
        }

        try {
            if (
                this.game.canvas.hasPointerCapture(
                    nativePointerId,
                )
            ) {
                this.game.canvas.releasePointerCapture(
                    nativePointerId,
                );
            }
        } catch {
            // Safe no-op on browsers that already released the pointer.
        }

        if (
            nativePointerId ===
                this.mobilePaintCapturedNativePointerId
        ) {
            this.mobilePaintCapturedNativePointerId =
                -1;
        }

        this.mobilePaintDock?.classList.remove(
            'colorhunt-paint-dock--paint-pass-through',
        );
        this.paintReadyDomButton?.style.removeProperty(
            'pointer-events',
        );

        if (
            this.mobileTouchPoints.size < 2
        ) {
            this.mobilePinchActive = false;
            this.mobilePinchDistance = 0;
        }
    }

    private cancelMobilePaintHoldTimers(): void {
        this.mobilePaintHoldDotEvent?.remove(false);
        this.mobilePaintLineModeEvent?.remove(false);
        this.mobilePaintHoldDotEvent = undefined;
        this.mobilePaintLineModeEvent = undefined;
    }

    private commitMobilePendingDot(): boolean {
        if (
            this.mobilePendingPaintPointerId < 0 ||
            !this.mobilePendingPaintStartWorld ||
            this.phase !== 'paint' ||
            this.mobilePaintDotCommitted
        ) {
            return this.mobilePaintDotCommitted;
        }

        const startTarget =
            this.mobilePendingPaintStartWorld.clone();

        const startPoint =
            this.networkPlayerManager
                .paintLocalPlayer(
                    startTarget.x,
                    startTarget.y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

        if (!startPoint) {
            return false;
        }

        this.playPaintSound();
        this.isPainting = true;
        this.activeStrokeTargetSessionId =
            this.networkPlayerManager
                .getLocalSessionId() ?? '';
        this.activeStrokePoints = [startPoint];
        this.currentStrokeHistoryPoints = [startPoint];
        this.straightLineStart = {
            x: startPoint.x,
            y: startPoint.y,
        };
        this.straightLineStartWorld =
            startTarget.clone();
        this.mobilePaintDotCommitted = true;

        try {
            navigator.vibrate?.(16);
        } catch {
            // Tiny dot haptic is best-effort only.
        }

        if (this.practiceMode === 'hider') {
            this.markPracticeHiderPaintStarted();
        }

        return true;
    }

    /*
     * V1010403C_MOBILE_PAINT_SURGICAL_RECOVERY / PRECISION_MODE
     * Keep the existing helper name to minimize churn, but its authority is
     * now the explicit Precision Brush mode for Hider/Hunter/Practice alike.
     */
    private isMobileHunterCustomizationPaint():
        boolean {
        return (
            this.mobileControlsEnabled &&
            this.phase === 'paint' &&
            this.mobilePaintInputMode ===
                'brush'
        );
    }

    private scheduleMobileHunterPrecisionHold(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.cancelMobilePaintHoldTimers();
        this.mobilePaintDotCommitted =
            false;

        this.mobilePaintHoldDotEvent =
            this.time.delayedCall(
                /*
                 * V1010474B_STANDALONE_MOBILE_PAINT_UX: Precision Brush begins immediately.
                 * No hold-to-arm delay.
                 */
                0,
                () => {
                    if (
                        !this.isMobileHunterCustomizationPaint() ||
                        pointer.id !==
                            this.mobilePendingPaintPointerId ||
                        !pointer.isDown
                    ) {
                        return;
                    }

                    /*
                     * V1010418_PRECISION_OUTSIDE_BODY_HOLD_FINAL
                     * 520ms is the authority, not whether the initial pixel is
                     * paintable.  If touch-down is outside the body,
                     * commitMobilePendingDot() may return false; keep the held
                     * gesture armed so drag-in can paint the first legal pixel.
                     */
                    this.mobilePaintHoldArmed = true;

                    if (
                        this.commitMobilePendingDot()
                    ) {
                        this.showMobilePendingPaintPreview(
                            pointer,
                        );

                        try {
                            navigator.vibrate?.(
                                12,
                            );
                        } catch {
                            // Best-effort feedback only.
                        }
                    }
                },
            );
    }

    private scheduleMobilePaintHoldModes(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.cancelMobilePaintHoldTimers();
        this.mobilePaintDotCommitted = false;
        this.mobilePaintHoldArmed = false;

        const holdToPaintDelay =
            this.mobilePaintInputMode === 'brush'
                ? 0
                : 120;

        this.mobilePaintHoldDotEvent =
            this.time.delayedCall(
                holdToPaintDelay,
                () => {
                    if (
                        pointer.id !== this.mobilePendingPaintPointerId ||
                        !pointer.isDown
                    ) {
                        return;
                    }

                    if (
                        this.mobilePaintInputMode ===
                            'brush'
                    ) {
                        /*
                         * Arm even when the brush tip is outside the body.
                         * commitMobilePendingDot() may fail there; that is OK.
                         * The held gesture remains armed and paints the first
                         * legal pixel when it enters the character.
                         */
                        this.mobilePaintHoldArmed =
                            true;
                    }

                    this.commitMobilePendingDot();
                    this.showMobilePendingPaintPreview(
                        pointer,
                    );
                },
            );

        /*
         * Explicit LINE stays toolbar-only. No hold -> LINE conversion.
         */
        this.mobilePaintLineModeEvent?.remove(false);
        this.mobilePaintLineModeEvent =
            undefined;
    }

    /*
     * V1010418_MOBILE_LINE_HOLD_520
     * LINE selection is persistent, but every individual mobile line stroke
     * has to earn a fresh 520ms hold before a line origin is created.
     */
    private scheduleMobileStraightLineHold(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.cancelMobilePaintHoldTimers();
        this.mobilePaintDotCommitted = false;
        this.mobilePaintHoldArmed = false;

        this.mobilePaintHoldDotEvent =
            this.time.delayedCall(
                520,
                () => {
                    if (
                        !this.straightLineToolSelected ||
                        pointer.id !==
                            this.mobilePendingPaintPointerId ||
                        !pointer.isDown ||
                        this.phase !== 'paint'
                    ) {
                        return;
                    }

                    this.mobilePaintHoldArmed = true;
                    this.tryBeginArmedMobileStraightLine(
                        pointer,
                    );
                },
            );
    }

    private tryBeginArmedMobileStraightLine(
        pointer: Phaser.Input.Pointer,
    ): boolean {
        if (
            !this.mobileControlsEnabled ||
            !this.straightLineToolSelected ||
            !this.mobilePaintHoldArmed ||
            pointer.id !==
                this.mobilePendingPaintPointerId ||
            !pointer.isDown ||
            this.phase !== 'paint'
        ) {
            return false;
        }

        const target =
            this.getPaintInputWorldPoint(
                pointer,
            );

        const startPoint =
            this.networkPlayerManager
                .paintLocalPlayer(
                    target.x,
                    target.y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

        /*
         * The hold may have armed outside the character. Keep the same held
         * gesture alive; POINTER_MOVE will retry when it enters a legal pixel.
         */
        if (!startPoint) {
            this.showMobilePendingPaintPreview(
                pointer,
            );
            return true;
        }

        this.playPaintSound();
        this.isPainting = true;
        this.activeStrokeTargetSessionId =
            this.networkPlayerManager
                .getLocalSessionId() ?? '';
        this.activeStrokePoints = [
            startPoint,
        ];
        this.currentStrokeHistoryPoints = [
            startPoint,
        ];
        this.straightLineStart = {
            x: startPoint.x,
            y: startPoint.y,
        };
        this.straightLineStartWorld =
            target.clone();
        this.straightLineModeActive = true;

        this.mobilePaintDotCommitted = true;
        this.mobilePendingPaintPointerId = -1;
        this.mobilePendingPaintStartScreen = undefined;
        this.mobilePendingPaintStartWorld = undefined;
        this.mobilePaintHoldDotEvent?.remove(false);
        this.mobilePaintHoldDotEvent = undefined;

        if (this.practiceMode === 'hider') {
            this.markPracticeHiderPaintStarted();
        }

        this.updateStraightLinePreview(
            pointer,
        );
        return true;
    }

    private beginMobilePaintAfterDrag(
        pointer: Phaser.Input.Pointer,
    ): boolean {
        if (
            this.mobilePendingPaintPointerId < 0 ||
            pointer.id !== this.mobilePendingPaintPointerId ||
            !this.mobilePendingPaintStartScreen ||
            !this.mobilePendingPaintStartWorld ||
            !pointer.isDown ||
            this.phase !== 'paint' ||
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !== 'hider'
            )
        ) {
            return false;
        }

        const movedScreenPixels =
            Phaser.Math.Distance.Between(
                this.mobilePendingPaintStartScreen.x,
                this.mobilePendingPaintStartScreen.y,
                pointer.x,
                pointer.y,
            );

        /*
         * V1010418_MOBILE_LINE_HOLD_520
         * Before 520ms, movement only repositions the prospective line start.
         * Once armed, the first legal pixel entered becomes the line origin.
         */
        if (
            this.mobileControlsEnabled &&
            this.straightLineToolSelected
        ) {
            if (!this.mobilePaintHoldArmed) {
                if (movedScreenPixels >= 3) {
                    this.mobilePendingPaintStartScreen
                        .set(
                            pointer.x,
                            pointer.y,
                        );
                    this.mobilePendingPaintStartWorld
                        .copy(
                            this.getPaintInputWorldPoint(
                                pointer,
                            ),
                        );
                }

                this.showMobilePendingPaintPreview(
                    pointer,
                );
                return true;
            }

            return this.tryBeginArmedMobileStraightLine(
                pointer,
            );
        }

        /*
         * V1010365_MOBILE_PRECISION_CUSTOMIZATION_PAINT / HUNTER_DRAG_IS_AIM
         * Before the 180ms stationary hold has committed the first dot,
         * Hunter finger movement only relocates the brush.
         *
         * Hider intentionally skips this branch and keeps the proven fast
         * camouflage behavior below.
         */
        if (
            this.mobilePaintInputMode ===
                'brush' &&
            !this.mobilePaintDotCommitted &&
            !this.mobilePaintHoldArmed
        ) {
            if (movedScreenPixels >= 3) {
                this.mobilePendingPaintStartScreen
                    .set(
                        pointer.x,
                        pointer.y,
                    );

                const latestTarget =
                    this.getPaintInputWorldPoint(
                        pointer,
                    );

                this.mobilePendingPaintStartWorld
                    .copy(
                        latestTarget,
                    );

                this.scheduleMobileHunterPrecisionHold(
                    pointer,
                );
            }

            this.showMobilePendingPaintPreview(
                pointer,
            );

            return true;
        }

        /* Ignore normal finger tremor. A still/near-still hold becomes a dot. */
        if (movedScreenPixels < 6) {
            this.showMobilePendingPaintPreview(pointer);
            return true;
        }

        /* Deliberate movement before the long-hold threshold = freehand. */
        this.mobilePaintLineModeEvent?.remove(false);
        this.mobilePaintLineModeEvent = undefined;
        this.mobilePaintHoldDotEvent?.remove(false);
        this.mobilePaintHoldDotEvent = undefined;

        const currentTarget =
            this.getPaintInputWorldPoint(pointer);

        /*
         * V101023828_PAINT_DRAG_UNDO_EYEDROPPER
         * A mobile freehand gesture may begin outside the Hider. Do not require
         * the original touch-down pixel to be paintable. Instead, wait until the
         * held brush actually enters the body and make THAT first legal pixel
         * the stroke origin.
         */
        if (
            !this.mobilePaintDotCommitted &&
            !(
                this.mobilePaintInputMode ===
                    'brush' &&
                this.mobilePaintHoldArmed
            )
        ) {
            const startPoint =
                this.networkPlayerManager
                    .paintLocalPlayer(
                        this.mobilePendingPaintStartWorld.x,
                        this.mobilePendingPaintStartWorld.y,
                        this.brushTextureKey,
                        this.paintColor,
                        this.brushSize,
                        this.brushShape,
                    );

            if (startPoint) {
                this.playPaintSound();
                this.isPainting = true;
                this.activeStrokeTargetSessionId =
                    this.networkPlayerManager
                        .getLocalSessionId() ?? '';
                this.activeStrokePoints = [startPoint];
                this.currentStrokeHistoryPoints = [startPoint];
                this.straightLineStart = {
                    x: startPoint.x,
                    y: startPoint.y,
                };
                this.straightLineStartWorld =
                    this.mobilePendingPaintStartWorld.clone();
                this.mobilePaintDotCommitted = true;

                if (this.practiceMode === 'hider') {
                    this.markPracticeHiderPaintStarted();
                }
            }
        }

        const currentPoint =
            this.networkPlayerManager
                .paintLocalPlayer(
                    currentTarget.x,
                    currentTarget.y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

        /*
         * Original touch-down was outside: remain pending until the CURRENT
         * brush target reaches a legal Hider pixel.
         */
        if (!this.mobilePaintDotCommitted) {
            if (!currentPoint) {
                this.showMobilePendingPaintPreview(pointer);
                return true;
            }

            this.playPaintSound();
            this.isPainting = true;
            this.activeStrokeTargetSessionId =
                this.networkPlayerManager
                    .getLocalSessionId() ?? '';
            this.activeStrokePoints = [currentPoint];
            this.currentStrokeHistoryPoints = [currentPoint];
            this.straightLineStart = {
                x: currentPoint.x,
                y: currentPoint.y,
            };
            this.straightLineStartWorld =
                currentTarget.clone();
            this.mobilePaintDotCommitted = true;

            if (this.practiceMode === 'hider') {
                this.markPracticeHiderPaintStarted();
            }
        } else if (currentPoint) {
            this.interpolateActivePaintStroke(currentPoint);
        }

        this.mobilePendingPaintPointerId = -1;
        this.mobilePendingPaintStartScreen = undefined;
        this.mobilePendingPaintStartWorld = undefined;
        this.mobilePaintDotCommitted = false;
        this.mobilePaintHoldArmed = false;

        this.paintPreview
            .setAlpha(1)
            .setPosition(
                this.getPaintPreviewWorldPoint(pointer).x,
                this.getPaintPreviewWorldPoint(pointer).y,
            );

        this.updateMobilePaintPrecisionGuide(pointer);
        return true;
    }

    private updateStraightLinePreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (
            !this.straightLinePreview ||
            !this.straightLineStartWorld ||
            !this.straightLineModeActive ||
            !this.isPainting ||
            this.phase !== 'paint'
        ) {
            this.clearStraightLinePreview();
            return;
        }

        const target =
            this.getPaintInputWorldPoint(
                pointer,
            );

        const zoom =
            Math.max(
                0.01,
                this.cameras.main.zoom,
            );

        this.straightLinePreview
            .clear()
            .setVisible(true);

        if (this.brushSize <= 1) {
            /*
             * V1010347_PAINT_TOOL_UX_UNIFICATION / TRUE_ONE_PIXEL_LINE_GUIDE
             * Exactly one translucent selected-color pixel-width guide.
             * No second dark outline can obscure the 1px target.
             */
            this.straightLinePreview
                .lineStyle(
                    1 / zoom,
                    this.paintColor,
                    0.56,
                )
                .lineBetween(
                    this.straightLineStartWorld.x,
                    this.straightLineStartWorld.y,
                    target.x,
                    target.y,
                );

            return;
        }

        const previewWidth =
            Math.max(
                1 / zoom,
                this.getPaintPreviewBrushSize() *
                    1.15,
            );

        this.straightLinePreview
            .lineStyle(
                previewWidth,
                this.paintColor,
                this.networkPlayerManager
                    ?.canLocalControlHunter?.()
                    ? 0.68
                    : 0.52,
            )
            .lineBetween(
                this.straightLineStartWorld.x,
                this.straightLineStartWorld.y,
                target.x,
                target.y,
            );
    }

    private clearStraightLinePreview(): void {
        this.straightLinePreview
            ?.clear()
            .setVisible(false);
    }

    private isPaintUiHit(
        currentlyOver:
            Phaser.GameObjects.GameObject[],
    ): boolean {
        return currentlyOver.some(
            (object) =>
                this.paletteObjects.includes(
                    object,
                ) ||
                this.hunterCamoPaletteObjects.includes(
                    object,
                ) ||
                object ===
                    this.eyedropperButton ||
                object ===
                    this.undoPaintButton ||
                object ===
                    this.redoPaintButton ||
                object ===
                    this.spectatorButton ||
                object ===
                    this.bgmToggleButton ||
                object ===
                    this.brushSizeSliderTrack ||
                object ===
                    this.brushSizeSliderKnob,
        );
    }

    private isMobileDomUiScreenPoint(
        screenX: number,
        screenY: number,
    ): boolean {
        if (!this.mobileControlsEnabled) {
            return false;
        }

        const rect =
            this.game.canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return false;
        }

        const clientX =
            rect.left +
            screenX / this.gameWidth * rect.width;
        const clientY =
            rect.top +
            screenY / this.gameHeight * rect.height;

        const element =
            document.elementFromPoint(
                clientX,
                clientY,
            );

        if (!(element instanceof HTMLElement)) {
            return false;
        }

        /*
         * Canvas-backed controls are handled by isPaintUiHit / joystick
         * ownership. This branch protects DOM controls layered over the game:
         * practice exit/help, paint palette buttons/sliders and any modal UI.
         * A fresh touch on one of these must NEVER move the persistent brush
         * or eyedropper to the button's screen position.
         */
        return Boolean(
            element.closest(
                'button, input, select, textarea, [role="dialog"], .colorhunt-controls-help, .colorhunt-practice-exit-button, .colorhunt-paint-dock',
            ),
        );
    }

    private createPointerControls(): void {
        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (
                pointer: Phaser.Input.Pointer,
                currentlyOver:
                    Phaser.GameObjects.GameObject[],
            ) => {
                if (
                    this.mobileControlsEnabled &&
                    this.mobileNativePinchActive
                ) {
                    return;
                }

                /*
                 * UI presses are not gameplay/background presses.
                 * This is especially important for the eyedropper button:
                 * pressing the button must arm the tool, not sample the
                 * background underneath the button.
                 */
                if (
                    this.isPaintUiHit(
                        currentlyOver,
                    )
                ) {
                    /*
                     * Palette/Undo/slider presses are UI-only. Never allow
                     * the same touch to paint the world underneath.
                     */
                    this.isPainting = false;
                    this.clearStraightLinePreview();
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    (
                        pointer.id ===
                            this.mobileFirePointerId ||
                        this.isMobileControlScreenPoint(
                            pointer.x,
                            pointer.y,
                        )
                    )
                ) {
                    return;
                }

                if (this.phase === 'hunt') {
                    /*
                     * MOBILE HUNTER CONTROL CONTRACT:
                     *
                     * - left joystick  = movement only
                     * - right joystick = aiming only
                     * - FIRE button    = shooting only
                     *
                     * A generic world/screen tap must never fire on mobile.
                     * This prevents accidental shots while moving or simply
                     * touching the screen.
                     */
                    if (this.mobileControlsEnabled) {
                        return;
                    }

                    /*
                     * v0.10.10.179 PC FIRE STABILITY
                     *
                     * POINTER_DOWN already tells us a press happened.
                     * Some browsers/mice can report leftButtonDown() false
                     * during very fast clicks, so trust the native event's
                     * `button === 0` first and keep Phaser as fallback.
                     */
                    const nativeEvent =
                        pointer.event;

                    const nativeLeftClick =
                        (
                            nativeEvent instanceof
                                MouseEvent ||
                            nativeEvent instanceof
                                PointerEvent
                        ) &&
                        nativeEvent.button ===
                            0;

                    const isLeftClick =
                        nativeLeftClick ||
                        pointer.leftButtonDown();

                    if (isLeftClick) {
                        const localRole =
                            multiplayerClient
                                .getLocalPlayer()
                                ?.role;

                        if (
                            this.isMultiplayerSession() &&
                            (
                                localRole === 'hider' ||
                                this.networkPlayerManager
                                    .isLocalHider()
                            )
                        ) {
                            this.beginHiderSkillCharge(this.hunterFocusAngle);
                        } else if (
                            !this.isMultiplayerSession() ||
                            this.networkPlayerManager
                                .canLocalControlHunter()
                        ) {
                            this.fireShotgun();
                        }
                    }

                    return;
                }

                if (this.phase !== 'paint') {
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    this.isMobileDomUiScreenPoint(
                        pointer.x,
                        pointer.y,
                    )
                ) {
                    return;
                }

                /*
                 * v0.10.10.127:
                 * One REAL touch always belongs to paint.
                 * Only an actual second touch pointer may be reserved for
                 * pinch. Synthetic mouse pointers are ignored.
                 */
                if (
                    this.mobileControlsEnabled
                ) {
                    /*
                     * Defensive second reset at the actual paint-input gate.
                     * This prevents a stale pinch flag/map from blocking the
                     * brush even if listener ordering differs by browser.
                     */
                    this.resetMobilePinchForFreshPrimaryTouch(
                        pointer,
                    );

                    this.pruneMobileTouchPoints();

                    /*
                     * V101023829_MOBILE_PINCH_PRIORITY
                     *
                     * The global mobile POINTER_DOWN listener records a real
                     * touch in mobileTouchPoints BEFORE this paint-input
                     * listener runs. Therefore checking
                     * !mobileTouchPoints.has(pointer.id) is too late for the
                     * second finger: it has already been inserted and can be
                     * mistaken for another paint gesture.
                     *
                     * Give two-finger camera pinch absolute priority. Keep the
                     * first finger's pending paint state untouched here; when
                     * the fingers actually move far enough,
                     * updateMobilePinchGesture() will cancel/finish paint and
                     * own both fingers as camera input.
                     */
                    const activeWorldTouches =
                        [...this.mobileTouchPoints.entries()]
                            .filter(
                                ([id, point]) =>
                                    id !==
                                        this.mobileMovePointerId &&
                                    id !==
                                        this.mobileAimPointerId &&
                                    id !==
                                        this.mobileFirePointerId &&
                                    !this.isMobileControlScreenPoint(
                                        point.x,
                                        point.y,
                                    ),
                            )
                            .length;

                    const trueSecondFinger =
                        this.isNativeTouchPointer(
                            pointer,
                        ) &&
                        activeWorldTouches >= 2;

                    if (
                        this.mobilePinchActive ||
                        trueSecondFinger
                    ) {
                        /*
                         * Arm pinch immediately from the already tracked two
                         * touches. Do NOT capture finger #2 as a brush pointer.
                         */
                        this.updateMobilePinchGesture();
                        return;
                    }
                }

                if (this.eyedropperArmed) {
                    /*
                     * Ignore every paint/palette UI object while the tool is
                     * armed.  The user must tap/click the actual game world.
                     */
                    const pressedPaintUi =
                        currentlyOver.some(
                            (object) =>
                                this.paletteObjects
                                    .includes(object) ||
                                this.hunterCamoPaletteObjects
                                    .includes(object),
                        );

                    if (pressedPaintUi) {
                        return;
                    }

                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    const localIsHunter =
                        this.isMultiplayerSession() &&
                        this.networkPlayerManager
                            .canLocalControlHunter();

                    if (localIsHunter) {
                        this.eyedropperArmed = false;
                        this.updateEyedropperButtonUi();
                        this.showHunterEyedropperDisabledNotice();
                        return;
                    }

                    if (
                        this.mobileControlsEnabled
                    ) {
                        /*
                         * Mobile: this touch only STARTS precision sampling.
                         * Drag updates the loupe; pointer-up confirms.
                         */
                        this.eyedropperPointerId =
                            pointer.id;

                        this.mobileEyedropperLastSampleAt =
                            -Infinity;

                        this.captureMobilePaintPointer(
                            pointer,
                        );
                        this.hideMobilePaintPrecisionGuide();
                        this.paintPreview
                            ?.setVisible(false);

                        /*
                         * Native window-level drag owns mobile pipette movement.
                         * Phaser still remains the fallback for non-PointerEvent
                         * WebViews.
                         */
                        this.startMobileNativeEyedropperDrag(
                            pointer,
                        );

                        if (
                            !(pointer.event instanceof PointerEvent)
                        ) {
                            this.updateEyedropperMagnifier(
                                pointer,
                            );
                        }

                        return;
                    }

                    /*
                     * PC keeps the fast one-click workflow.
                     */
                    const samplePoint =
                        this.getPointerWorldPoint(
                            pointer,
                        );

                    this.pickColorFromBackground(
                        samplePoint.x,
                        samplePoint.y,
                    );

                    this.eyedropperArmed = false;
                    this.updateEyedropperButtonUi();
                    this.hideEyedropperMagnifier();
                    return;
                }

                if (pointer.rightButtonDown()) {
                    /*
                     * 직전 좌클릭 stroke가 남아 있는 상태에서 색을 바꾸면
                     * stroke metadata와 실제 brush texture 색이 어긋날 수 있습니다.
                     * 색 추출 전에 기존 stroke를 먼저 정상 종료합니다.
                     */
                    this.finishActivePaintStroke();
                    this.isPainting = false;
                    this.activeStrokePoints = [];
                    this.activeStrokeTargetSessionId = '';

                    const localIsHunter =
                        this.isMultiplayerSession() &&
                        this.networkPlayerManager
                            .canLocalControlHunter();

                    if (localIsHunter) {
                        /*
                         * Hunter Paint는 실제 배경을 검은 장막으로 가리고 있으므로
                         * 보이지 않는 현재 gameplay background pixel을 우클릭으로
                         * 추출하는 것을 금지합니다.
                         */
                        this.showHunterEyedropperDisabledNotice();

                        return;
                    }

                    const samplePoint =
                        this.getPointerWorldPoint(
                            pointer,
                        );

                    this.pickColorFromBackground(
                        samplePoint.x,
                        samplePoint.y,
                    );

                    return;
                }

                if (!pointer.leftButtonDown()) {
                    return;
                }

                if (
                    this.isMultiplayerSession() ||
                    this.practiceMode ===
                        'hider'
                ) {
                    const paintTarget =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );


                    /*
                     * V1010411_RESTORE_EXPLICIT_LINE_TOOL / POINTER_DOWN
                     * LINE is an explicit one-shot tool.
                     */
                    if (
                        this.straightLineToolSelected
                    ) {
                        this.finishActivePaintStroke();
                        this.isPainting = false;
                        this.clearStraightLinePreview();

                        if (
                            this.mobileControlsEnabled
                        ) {
                            this.captureMobilePaintPointer(
                                pointer,
                            );

                            this.mobilePendingPaintPointerId =
                                pointer.id;
                            this.mobilePendingPaintStartScreen =
                                new Phaser.Math.Vector2(
                                    pointer.x,
                                    pointer.y,
                                );
                            this.mobilePendingPaintStartWorld =
                                paintTarget.clone();
                            this.mobilePaintDotCommitted =
                                false;
                            this.mobilePaintHoldArmed =
                                false;

                            this.showMobilePendingPaintPreview(
                                pointer,
                            );
                            this.scheduleMobileStraightLineHold(
                                pointer,
                            );
                            return;
                        }

                        /*
                         * Desktop explicit LINE keeps the existing immediate
                         * pointer-down origin. The 520ms contract is mobile-only.
                         */
                        const startPoint =
                            this.networkPlayerManager
                                .paintLocalPlayer(
                                    paintTarget.x,
                                    paintTarget.y,
                                    this.brushTextureKey,
                                    this.paintColor,
                                    this.brushSize,
                                    this.brushShape,
                                );

                        if (!startPoint) {
                            return;
                        }

                        this.playPaintSound();
                        this.isPainting = true;
                        this.activeStrokeTargetSessionId =
                            this.networkPlayerManager
                                .getLocalSessionId() ?? '';
                        this.activeStrokePoints = [
                            startPoint,
                        ];
                        this.currentStrokeHistoryPoints = [
                            startPoint,
                        ];
                        this.straightLineStart = {
                            x: startPoint.x,
                            y: startPoint.y,
                        };
                        this.straightLineStartWorld =
                            paintTarget.clone();
                        this.straightLineModeActive =
                            true;
                        this.updateStraightLinePreview(
                            pointer,
                        );
                        return;
                    }

                    /*
                     * V1010403C_MOBILE_PAINT_SURGICAL_RECOVERY / EYEDROPPER_NEXT_TOUCH_IMMEDIATE
                     */
                    if (
                        this.mobileControlsEnabled &&
                        this.mobilePaintInputMode ===
                            'finger' &&
                        this.mobileFingerImmediatePaintNextTouch
                    ) {
                        this.mobileFingerImmediatePaintNextTouch =
                            false;

                        this.finishActivePaintStroke();
                        this.isPainting = false;
                        this.captureMobilePaintPointer(
                            pointer,
                        );

                        const immediatePoint =
                            this.networkPlayerManager
                                .paintLocalPlayer(
                                    paintTarget.x,
                                    paintTarget.y,
                                    this.brushTextureKey,
                                    this.paintColor,
                                    this.brushSize,
                                    this.brushShape,
                                );

                        if (immediatePoint) {
                            this.playPaintSound();
                            this.isPainting = true;
                            this.activeStrokeTargetSessionId =
                                this.networkPlayerManager
                                    .getLocalSessionId() ?? '';
                            this.activeStrokePoints = [
                                immediatePoint,
                            ];
                            this.currentStrokeHistoryPoints = [
                                immediatePoint,
                            ];
                            this.straightLineStart = {
                                x: immediatePoint.x,
                                y: immediatePoint.y,
                            };
                            this.straightLineStartWorld =
                                paintTarget.clone();
                            this.mobilePendingPaintPointerId =
                                pointer.id;
                            this.mobilePendingPaintStartScreen =
                                new Phaser.Math.Vector2(
                                    pointer.x,
                                    pointer.y,
                                );
                            this.mobilePendingPaintStartWorld =
                                paintTarget.clone();
                            this.mobilePaintDotCommitted =
                                true;
                            this.updateMobilePaintPrecisionGuide(
                                pointer,
                            );
                        } else {
                            this.mobileFingerImmediatePaintNextTouch =
                                true;
                            this.releaseMobilePaintPointer();
                        }

                        return;
                    }

                    if (
                        this.mobileControlsEnabled
                    ) {
                        /*
                         * Mobile safety mode:
                         * first touch only previews. Painting begins after
                         * the finger moves at least one screen pixel.
                         */
                        this.finishActivePaintStroke();
                        this.isPainting = false;

                        /*
                         * Capture NOW, while pointerdown still belongs to the
                         * canvas. From this point until finger-up, crossing
                         * over the DOM palette must not steal the drag.
                         */
                        this.captureMobilePaintPointer(
                            pointer,
                        );

                        this.mobilePendingPaintPointerId =
                            pointer.id;

                        this.mobilePendingPaintStartScreen =
                            new Phaser.Math.Vector2(
                                pointer.x,
                                pointer.y,
                            );

                        this.mobilePendingPaintStartWorld =
                            paintTarget.clone();

                
                        this.showMobilePendingPaintPreview(
                            pointer,
                        );

                        if (
                            this.isMobileHunterCustomizationPaint()
                        ) {
                            this.scheduleMobileHunterPrecisionHold(
                                pointer,
                            );
                        } else {
                            /*
                             * Hider/Practice Hider stay fast:
                             * existing drag + dot + long-hold line behavior.
                             */
                            this.scheduleMobilePaintHoldModes(
                                pointer,
                            );
                        }

                        return;
                    }

                    this.updateMobilePaintPrecisionGuide(
                        pointer,
                    );

                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                paintTarget.x,
                                paintTarget.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (!point) {
                        return;
                    }

                    this.playPaintSound();
                    this.isPainting = true;
                    this.activeStrokeTargetSessionId =
                        this.networkPlayerManager
                            .getLocalSessionId() ?? '';
                    this.activeStrokePoints = [
                        point,
                    ];
                    this.currentStrokeHistoryPoints = [
                        point,
                    ];

                    /*
                     * Always remember the stroke origin. Shift may be pressed
                     * before OR after pointer-down; preview should still work.
                     */
                    this.straightLineStart = {
                        x: point.x,
                        y: point.y,
                    };

                    this.straightLineStartWorld =
                        new Phaser.Math.Vector2(
                            paintTarget.x,
                            paintTarget.y,
                        );

                    this.straightLineModeActive =
                        Boolean(
                            this.shiftPaintKey
                                ?.isDown,
                        );

                    this.updateStraightLinePreview(
                        pointer,
                    );

                    return;
                }

                const selectedWorld =
                    this.getPointerWorldPoint(
                        pointer,
                    );

                const selected = this.findHiderAtPoint(
                    selectedWorld.x,
                    selectedWorld.y,
                );

                if (!selected) {
                    return;
                }

                this.selectHider(selected.index);
                this.isPainting = true;

                this.paintOnHider(
                    selected.hider,
                    pointer.worldX,
                    pointer.worldY,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (pointer: Phaser.Input.Pointer) => {
                if (
                    this.mobileControlsEnabled &&
                    this.eyedropperArmed
                ) {
                    /*
                     * Eyedropper owns the visual channel completely.
                     * Never allow brush preview/precision-guide code farther
                     * below to follow the finger while the pipette is selected.
                     */
                    this.paintPreview
                        ?.setVisible(false);
                    this.hideMobilePaintPrecisionGuide();
                }

                if (
                    this.mobileControlsEnabled &&
                    this.mobileNativePinchActive
                ) {
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    (
                        this.mobileNativeEyedropperPointerId >=
                            0 ||
                        this.mobileNativeEyedropperTouchIdentifier >=
                            0
                    ) &&
                    this.eyedropperArmed
                ) {
                    /*
                     * Native window pointer stream owns this drag. Avoid
                     * duplicate Phaser updates / ID mismatches.
                     */
                    return;
                }

                if (
                    this.eyedropperArmed &&
                    pointer.id ===
                        this.eyedropperPointerId
                ) {
                    /* Pinch owns both fingers; never sample/move the tool. */
                    if (
                        this.mobileControlsEnabled &&
                        (
                            this.mobilePinchActive ||
                            this.mobileTouchPoints.size >= 2
                        )
                    ) {
                        return;
                    }

                    this.updateEyedropperMagnifier(
                        pointer,
                    );
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    this.eyedropperArmed
                ) {
                    /*
                     * No active pipette drag owns this pointer. Keep the idle
                     * pipette where it is; do not fall through into brush
                     * movement/painting code.
                     */
                    return;
                }

                if (
                    this.mobileControlsEnabled
                ) {
                    this.pruneMobileTouchPoints();

                    const moveEvent =
                        pointer.event as
                            | PointerEvent
                            | TouchEvent
                            | undefined;

                    const definitelySingleTouch =
                        (
                            typeof PointerEvent !==
                                'undefined' &&
                            moveEvent instanceof
                                PointerEvent &&
                            moveEvent.pointerType ===
                                'touch' &&
                            moveEvent.isPrimary
                        ) ||
                        (
                            typeof TouchEvent !==
                                'undefined' &&
                            moveEvent instanceof
                                TouchEvent &&
                            moveEvent.touches.length <= 1
                        );

                    if (
                        definitelySingleTouch &&
                        this.mobileTouchPoints.size <= 1
                    ) {
                        this.mobilePinchActive = false;
                        this.mobilePinchDistance = 0;
                    }
                }

                const activeMobilePaintTouches =
                    this.mobileControlsEnabled
                        ? [
                            ...this.mobileTouchPoints
                                .entries(),
                        ].filter(
                            (
                                [
                                    id,
                                    point,
                                ],
                            ) =>
                                this.isMobilePointerActuallyDown(
                                    id,
                                ) &&
                                id !==
                                    this.mobileMovePointerId &&
                                id !==
                                    this.mobileAimPointerId &&
                                id !==
                                    this.mobileFirePointerId &&
                                !this.isMobileControlScreenPoint(
                                    point.x,
                                    point.y,
                                ),
                        ).length
                        : 0;

                if (
                    this.mobileControlsEnabled &&
                    (
                        this.mobilePinchActive ||
                        activeMobilePaintTouches >= 2
                    )
                ) {
                    return;
                }

                /*
                 * A joystick/aim/fire finger is NEVER a brush finger. In v195
                 * the precision guide updated before this ownership check, so
                 * touching the movement stick could teleport the idle brush.
                 */
                if (
                    this.mobileControlsEnabled &&
                    (
                        pointer.id === this.mobileMovePointerId ||
                        pointer.id === this.mobileAimPointerId ||
                        pointer.id === this.mobileFirePointerId
                    )
                ) {
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    this.phase === 'paint' &&
                    pointer.isDown &&
                    pointer.id !== this.mobilePendingPaintPointerId &&
                    !this.isPainting &&
                    pointer.id !== this.eyedropperPointerId &&
                    this.isMobileDomUiScreenPoint(
                        pointer.x,
                        pointer.y,
                    )
                ) {
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    this.phase === 'paint' &&
                    pointer.isDown
                ) {
                    this.updateMobilePaintPrecisionGuide(
                        pointer,
                    );
                }

                if (
                    this.mobileControlsEnabled &&
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    const handledPending =
                        this.beginMobilePaintAfterDrag(
                            pointer,
                        );

                    if (
                        handledPending &&
                        !this.isPainting
                    ) {
                        return;
                    }

                    /*
                     * If painting just started in this move event, it already
                     * painted/interpolated to the current point above.
                     */
                    if (handledPending) {
                        return;
                    }
                }

                if (
                    pointer.id ===
                        this.mobileMovePointerId ||
                    pointer.id ===
                        this.mobileAimPointerId
                ) {
                    return;
                }

                this.updatePaintPreview(pointer);

                /*
                 * v0.10.10.238.27:
                 * PC Hider drag-in painting.
                 *
                 * Previously a stroke could only start when POINTER_DOWN itself
                 * landed on a paintable Hider pixel. If the player pressed just
                 * outside the character and dragged onto it, paintLocalPlayer()
                 * returned null on pointer-down, isPainting stayed false, and
                 * POINTER_MOVE exited forever.
                 *
                 * While the desktop left button is held, allow the first
                 * paintable pixel entered by the drag to become the stroke
                 * origin. Mobile keeps its separate precision-drag contract.
                 */
                if (
                    !this.mobileControlsEnabled &&
                    this.phase === 'paint' &&
                    pointer.isDown &&
                    pointer.leftButtonDown() &&
                    !this.isPainting &&
                    (
                        (
                            this.isMultiplayerSession() &&
                            multiplayerClient
                                .getLocalPlayer()
                                ?.role === 'hider'
                        ) ||
                        this.practiceMode ===
                            'hider'
                    )
                ) {
                    const dragInTarget =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );

                    const dragInPoint =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                dragInTarget.x,
                                dragInTarget.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (dragInPoint) {
                        this.playPaintSound();
                        this.isPainting = true;
                        this.activeStrokeTargetSessionId =
                            this.networkPlayerManager
                                .getLocalSessionId() ?? '';
                        this.activeStrokePoints = [
                            dragInPoint,
                        ];
                        this.currentStrokeHistoryPoints = [
                            dragInPoint,
                        ];

                        this.straightLineStart = {
                            x: dragInPoint.x,
                            y: dragInPoint.y,
                        };

                        this.straightLineStartWorld =
                            dragInTarget.clone();

                        this.straightLineModeActive =
                            Boolean(
                                this.shiftPaintKey
                                    ?.isDown,
                            );

                        this.updateStraightLinePreview(
                            pointer,
                        );
                    }
                }

                if (
                    this.phase !== 'paint' ||
                    !this.isPainting ||
                    !pointer.isDown
                ) {
                    return;
                }

                if (
                    this.isMultiplayerSession() ||
                    this.practiceMode ===
                        'hider'
                ) {
                    if (
                        this.shiftPaintKey?.isDown &&
                        this.straightLineStart
                    ) {
                        this.straightLineModeActive =
                            true;

                        /*
                         * Live visual preview. No permanent paint is stamped
                         * until release, so the player can aim the line.
                         */
                        this.updateStraightLinePreview(
                            pointer,
                        );
                        return;
                    }

                    if (
                        this.straightLineModeActive
                    ) {
                        /*
                         * Once a stroke entered line mode, keep previewing
                         * until release even if Shift is released first.
                         */
                        this.updateStraightLinePreview(
                            pointer,
                        );
                        return;
                    }

                    const point =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                this.getPaintInputWorldPoint(
                                    pointer,
                                ).x,
                                this.getPaintInputWorldPoint(
                                    pointer,
                                ).y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (point) {
                        this.playPaintSound();
                        this.interpolateActivePaintStroke(
                            point,
                        );
                    }

                    return;
                }

                const hider =
                    this.hiders[this.selectedHiderIndex];

                if (!hider || !hider.alive) {
                    return;
                }

                this.paintOnHider(
                    hider,
                    pointer.worldX,
                    pointer.worldY,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                /*
                 * v0.10.10.174: release canvas capture only after Phaser has
                 * received the final pointer-up, so the stroke remains
                 * continuous even if the finger finishes above the palette.
                 */
                this.releaseMobilePaintPointer(
                    pointer,
                );

                if (
                    this.mobileControlsEnabled &&
                    (
                        this.mobileNativeEyedropperPointerId >=
                            0 ||
                        this.mobileNativeEyedropperTouchIdentifier >=
                            0
                    ) &&
                    this.eyedropperArmed
                ) {
                    /*
                     * Native window pointerup will perform the exact final
                     * sample and cleanup.
                     */
                    return;
                }

                if (
                    this.eyedropperArmed &&
                    pointer.id ===
                        this.eyedropperPointerId
                ) {
                    const target =
                        this.getPaintPreviewWorldPoint(
                            pointer,
                        );

                    this.mobileLastBrushTargetWorld =
                        target.clone();

                    this.pickColorFromBackground(
                        target.x,
                        target.y,
                    );

                    /*
                     * Eyedropper remains the selected tool after release.
                     * The sampled-color pipette stays at the last position
                     * until Circle/Square is explicitly selected.
                     */
                    this.eyedropperPointerId = -1;
                    this.finishMobileEyedropperSelection();

                    this.isPainting = false;
                    this.finishActivePaintStroke();
                    return;
                }

                if (
                    this.mobileControlsEnabled &&
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    /*
                     * A quick tap stays preview-only. A short hold has already
                     * committed exactly one dot, so finish that stroke here.
                     */
                    const committedDot =
                        this.mobilePaintDotCommitted &&
                        this.isPainting;

                    this.clearMobilePendingPaint();
                    this.mobilePaintHoldArmed = false;
                    this.isPainting = false;

                    if (committedDot) {
                        this.finishActivePaintStroke();
                    }

                    this.showMobileIdleBrushGuide();
                    return;
                }

                if (
                    this.phase === 'paint' &&
                    (
                        this.isMultiplayerSession() ||
                        this.practiceMode ===
                            'hider'
                    ) &&
                    this.isPainting &&
                    this.straightLineStart &&
                    this.straightLineModeActive
                ) {
                    /*
                     * v0.10.10.164:
                     * A Shift-line is a real first paint action too. Its
                     * preview intentionally stamps nothing, so start the
                     * Hider record the instant the line is committed.
                     */
                    if (
                        this.practiceMode ===
                            'hider'
                    ) {
                        this.markPracticeHiderPaintStarted();
                    }

                    const target =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );

                    const endPoint =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                target.x,
                                target.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (endPoint) {
                        /*
                         * Reuse the existing interpolation routine so Shift
                         * produces the same gap-free raster line locally and
                         * over the network.
                         */
                        this.interpolateActivePaintStroke(
                            endPoint,
                        );
                    }
                }

                this.straightLineStart =
                    undefined;
                this.straightLineStartWorld =
                    undefined;
                this.straightLineModeActive =
                    false;
                this.mobilePaintHoldArmed = false;

                /*
                 * V1010417_PERSISTENT_LINE_TOOL
                 * LINE is a persistent selected tool.
                 * Completing one line ends only the active stroke/preview.
                 * Do NOT switch back to Circle/Square or Finger/Precision.
                 * The user leaves LINE only by explicitly choosing another tool.
                 */
                if (
                    this.straightLineToolSelected
                ) {
                    this.syncMobilePaintDockUi();
                }

                this.clearStraightLinePreview();

                this.hideMobilePaintPrecisionGuide();

                this.isPainting = false;
                this.finishActivePaintStroke();
                this.showMobileIdleBrushGuide();
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP_OUTSIDE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                this.releaseMobilePaintPointer(
                    pointer,
                );

                if (
                    pointer.id ===
                        this.mobilePendingPaintPointerId
                ) {
                    const committedDot =
                        this.mobilePaintDotCommitted &&
                        this.isPainting;
                    this.clearMobilePendingPaint();
                    this.isPainting = false;
                    if (committedDot) {
                        this.finishActivePaintStroke();
                    }
                    this.showMobileIdleBrushGuide();
                    return;
                }

                /*
                 * v0.10.10.163
                 * Shift-line preview may extend to the canvas edge. If the
                 * pointer is released just outside the canvas, commit the
                 * line using the last known pointer position instead of
                 * discarding the preview-only stroke.
                 */
                if (
                    this.phase ===
                        'paint' &&
                    (
                        this.isMultiplayerSession() ||
                        this.practiceMode ===
                            'hider'
                    ) &&
                    this.isPainting &&
                    this.straightLineStart &&
                    this.straightLineModeActive
                ) {
                    if (
                        this.practiceMode ===
                            'hider'
                    ) {
                        this.markPracticeHiderPaintStarted();
                    }

                    const target =
                        this.getPaintInputWorldPoint(
                            pointer,
                        );

                    const endPoint =
                        this.networkPlayerManager
                            .paintLocalPlayer(
                                target.x,
                                target.y,
                                this.brushTextureKey,
                                this.paintColor,
                                this.brushSize,
                                this.brushShape,
                            );

                    if (
                        endPoint
                    ) {
                        this.interpolateActivePaintStroke(
                            endPoint,
                        );
                    }

                    this.straightLineStart =
                        undefined;
                    this.straightLineStartWorld =
                        undefined;
                    this.straightLineModeActive =
                        false;
                    this.clearStraightLinePreview();
                    this.isPainting =
                        false;
                    this.finishActivePaintStroke();
                }
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_WHEEL,
            (
                pointer:
                    Phaser.Input.Pointer,
                _gameObjects:
                    Phaser.GameObjects.GameObject[],
                _deltaX: number,
                deltaY: number,
            ) => {
                if (
                    this.phase !== 'paint' ||
                    (
                        !this.isMultiplayerSession() &&
                        this.practiceMode !== 'hider'
                    )
                ) {
                    return;
                }

                const nativeEvent =
                    pointer.event as
                        | WheelEvent
                        | undefined;

                if (nativeEvent?.ctrlKey) {
                    /*
                     * Ctrl + Wheel = 브러시 크기.
                     * 위로 스크롤하면 크게, 아래로 스크롤하면 작게.
                     */
                    const delta =
                        deltaY < 0
                            ? 1
                            : -1;

                    this.setBrushSize(
                        this.brushSize +
                            delta,
                    );

                    return;
                }

                /*
                 * 일반 Wheel = Paint 화면 확대/축소.
                 */
                const zoom =
                    this.adjustPaintWorldZoom(
                        deltaY,
                    );

                this.networkPlayerManager
                    .showOnlyLocalPlayer();

                this.paintZoomText.setText(
                    [
                        tr(`ZOOM ${zoom.toFixed(2)}x`),
                        tr(`BRUSH ${this.brushSize}`),
                        tr('휠: 확대/축소 · Ctrl+휠: 브러시 크기'),
                    ].join('\n'),
                );

                this.updatePaintPreviewImmediately();
            },
        );

        this.game.canvas.addEventListener(
            'contextmenu',
            (event) => {
                event.preventDefault();
            },
        );
    
        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            () => {
                this.releaseHiderSkillCharge();
            },
        );
}

    private paintOnHider(
        hider: Hider,
        worldX: number,
        worldY: number,
    ): void {
        const textureX =
            worldX - hider.paintTexture.x;

        const textureY =
            worldY - hider.paintTexture.y;

        if (
            textureX < 0 ||
            textureY < 0 ||
            textureX > hider.paintTexture.width ||
            textureY > hider.paintTexture.height
        ) {
            return;
        }

        this.recordActivePaintPoint(
            textureX,
            textureY,
        );

        this.playPaintSound();

        hider.paintTexture.stamp(
            this.brushTextureKey,
            undefined,
            textureX,
            textureY,
            {
                originX: 0.5,
                originY: 0.5,
            },
        );

        // Phaser 4에서는 DynamicTexture 변경 사항을 실제 화면에
        // 반영하려면 render()를 호출해야 합니다.
        const renderTexture = hider.paintTexture as unknown as {
            render?: () => void;
        };

        renderTexture.render?.();
    }

    private flushActivePaintStrokeChunk(
        keepLastPoint = true,
    ): void {
        if (
            !multiplayerClient.isConnected() ||
            !this.activeStrokeTargetSessionId ||
            this.activeStrokePoints.length === 0
        ) {
            return;
        }

        const pointsToSend = [
            ...this.activeStrokePoints,
        ];

        multiplayerClient.sendPaintStroke({
            targetSessionId:
                this.activeStrokeTargetSessionId,
            color: this.paintColor,
            size: this.brushSize,
            shape: this.brushShape,
            points: pointsToSend,
        });

        if (
            keepLastPoint &&
            pointsToSend.length > 0
        ) {
            this.activeStrokePoints = [
                pointsToSend[
                    pointsToSend.length - 1
                ],
            ];
        } else {
            this.activeStrokePoints = [];
        }
    }

    private recordActivePaintPoint(
        textureX: number,
        textureY: number,
    ): void {
        if (
            !this.isPainting ||
            (
                multiplayerClient.isConnected() &&
                !this.activeStrokeTargetSessionId
            )
        ) {
            return;
        }

        const previousPoint =
            this.activeStrokePoints[
                this.activeStrokePoints.length - 1
            ];

        const nextX =
            Phaser.Math.Clamp(
                Math.round(textureX),
                0,
                80,
            );

        const nextY =
            Phaser.Math.Clamp(
                Math.round(textureY),
                0,
                120,
            );

        /*
         * Local interpolation stamps raster pixels continuously.
         * Only skip an identical pixel; otherwise remote clients must
         * receive the same path the painter actually saw.
         */
        if (
            previousPoint &&
            Math.round(previousPoint.x) === nextX &&
            Math.round(previousPoint.y) === nextY
        ) {
            return;
        }

        const recordedPoint = {
            x: nextX,
            y: nextY,
        };

        if (
            this.practiceMode ===
                'hider'
        ) {
            this.markPracticeHiderPaintStarted();
        }

        this.activeStrokePoints.push(
            recordedPoint,
        );

        const previousHistoryPoint =
            this.currentStrokeHistoryPoints[
                this.currentStrokeHistoryPoints.length - 1
            ];

        if (
            !previousHistoryPoint ||
            Math.round(
                previousHistoryPoint.x,
            ) !== nextX ||
            Math.round(
                previousHistoryPoint.y,
            ) !== nextY
        ) {
            this.currentStrokeHistoryPoints.push(
                recordedPoint,
            );
        }

        if (
            multiplayerClient.isConnected() &&
            this.activeStrokePoints.length >= 48
        ) {
            this.flushActivePaintStrokeChunk(
                true,
            );
        }
    }

    private interpolateActivePaintStroke(
        current:
            NetworkPaintPoint,
    ): void {
        const previous =
            this.activeStrokePoints[
                this.activeStrokePoints.length - 1
            ];

        if (!previous) {
            this.recordActivePaintPoint(
                current.x,
                current.y,
            );
            return;
        }

        const distance =
            Phaser.Math.Distance.Between(
                previous.x,
                previous.y,
                current.x,
                current.y,
            );

        const spacing =
            Math.max(
                0.75,
                Math.min(
                    1.5,
                    this.brushSize * 0.22,
                ),
            );

        const steps =
            Math.max(
                1,
                Math.ceil(
                    distance /
                    spacing,
                ),
            );

        for (
            let step = 1;
            step <= steps;
            step += 1
        ) {
            const t =
                step / steps;

            const x =
                Phaser.Math.Linear(
                    previous.x,
                    current.x,
                    t,
                );

            const y =
                Phaser.Math.Linear(
                    previous.y,
                    current.y,
                    t,
                );

            this.networkPlayerManager
                .stampLocalPaintPoint(
                    x,
                    y,
                    this.brushTextureKey,
                    this.paintColor,
                    this.brushSize,
                    this.brushShape,
                );

            this.recordActivePaintPoint(
                x,
                y,
            );
        }
    }

    private finishActivePaintStroke(): void {
        const completedTarget =
            this.activeStrokeTargetSessionId ||
            (
                this.practiceMode ===
                    'hider'
                    ? this.practiceHiderSessionId
                    : ''
            );

        if (
            multiplayerClient.isConnected() &&
            completedTarget &&
            this.activeStrokePoints.length > 0
        ) {
            this.flushActivePaintStrokeChunk(
                false,
            );
        }

        if (
            completedTarget &&
            this.currentStrokeHistoryPoints.length >
                0
        ) {
            this.localPaintHistory.push({
                targetSessionId:
                    completedTarget,
                color:
                    this.paintColor,
                size:
                    this.brushSize,
                shape:
                    this.brushShape,
                points:
                    this.currentStrokeHistoryPoints
                        .map(
                            (point) => ({
                                x: point.x,
                                y: point.y,
                            }),
                        ),
            });

            /*
             * Standard Undo/Redo behavior:
             * once the player draws something new after Undo, the old Redo
             * branch is no longer valid.
             */
            this.redoPaintHistory = [];

            /*
             * IMPORTANT:
             * localPaintHistory is the complete authoritative picture used
             * by rebuildLocalPaintFromHistory() at Paint -> Hunt.
             *
             * Do NOT trim old strokes here. The old 40-stroke limit meant
             * early camouflage (very often torso/legs painted first) was
             * discarded. Hunt then cleared the body to white and replayed
             * only the newest 40 strokes, making the Hunter see an
             * incompletely painted Hider.
             *
             * Undo depth can be handled independently; the final painted
             * state must retain every stroke for the duration of this round.
             */
        }

        this.activeStrokePoints = [];
        this.currentStrokeHistoryPoints = [];
        this.activeStrokeTargetSessionId = '';
        this.straightLineStart = undefined;
        this.straightLineStartWorld =
            undefined;
        this.straightLineModeActive =
            false;
        this.clearStraightLinePreview();
    }

    private broadcastAssistedFinalPaintBeforeReady(): void {
        /*
         * V1010451J_ASSIST_READY_FINAL_PARITY / FINAL_ASSIST_PARITY
         *
         * Only Paint Help needs this authoritative final pass. Normal manual
         * strokes already arrive as continuous live paint traffic.
         */
        if (
            !this.paintAssistUsedThisRound ||
            !this.isMultiplayerSession() ||
            !multiplayerClient.isConnected()
        ) {
            return;
        }

        const sessionId =
            multiplayerClient.getSessionId();

        if (!sessionId) {
            return;
        }

        /*
         * First make the Hider's own visible raster exactly equal to its saved
         * round history. This is the same state we are about to send to peers.
         */
        this.rebuildLocalPaintFromHistory(
            false,
        );

        /*
         * Dense legal white reset. 14 * 21 = 294 points, deliberately below the
         * server's 300-point paint_stroke cap.
         */
        const resetPoints:
            NetworkPaintPoint[] = [];

        for (
            let y = 0;
            y <= 120;
            y += 6
        ) {
            for (
                let x = 0;
                x <= 80;
                x += 6
            ) {
                resetPoints.push({
                    x,
                    y,
                });
            }
        }

        multiplayerClient.sendPaintStroke({
            targetSessionId:
                sessionId,
            color:
                0xf5eee2,
            size:
                8,
            shape:
                'square',
            points:
                resetPoints,
        });

        /*
         * Paint Help buckets can be large. Keep every point authoritative while
         * staying safely below the server's per-message slice(0, 300).
         */
        const maxNetworkPoints =
            240;

        this.localPaintHistory.forEach(
            (stroke) => {
                for (
                    let pointIndex = 0;
                    pointIndex <
                        stroke.points.length;
                    pointIndex +=
                        maxNetworkPoints
                ) {
                    multiplayerClient
                        .sendPaintStroke({
                            ...stroke,
                            targetSessionId:
                                sessionId,
                            points:
                                stroke.points
                                    .slice(
                                        pointIndex,
                                        pointIndex +
                                            maxNetworkPoints,
                                    ),
                        });
                }
            },
        );
    }

    private rebuildLocalPaintFromHistory(
        broadcast = true,
    ): void {
        const sessionId =
            this.practiceMode ===
                'hider'
                ? this.practiceHiderSessionId
                : multiplayerClient.getSessionId();

        if (!sessionId) {
            return;
        }

        /*
         * Network-synchronized repaint:
         * 1) cover the full authoritative silhouette with legal white stamps
         * 2) replay every currently active stroke in original order
         *
         * Every client receives the same ordered paint_stroke messages.
         */
        /*
         * V101023828_PAINT_DRAG_UNDO_EYEDROPPER
         * Dense masked reset for exact Undo/Redo. The former two-stamp reset
         * missed narrow limbs and edge pixels, leaving colored crumbs behind.
         */
        const resetPoints: NetworkPaintPoint[] = [];

        for (let y = 0; y <= 120; y += 6) {
            for (let x = 0; x <= 80; x += 6) {
                resetPoints.push({ x, y });
            }
        }

        const resetStroke:
            NetworkPaintStroke = {
                targetSessionId:
                    sessionId,
                color:
                    0xf5eee2,
                size:
                    8,
                shape:
                    'square',
                points:
                    resetPoints,
            };

        resetStroke.points.forEach(
            (point) => {
                this.networkPlayerManager
                    .stampLocalPaintPoint(
                        point.x,
                        point.y,
                        this.brushTextureKey,
                        resetStroke.color,
                        resetStroke.size,
                        resetStroke.shape,
                    );
            },
        );

        if (
            broadcast &&
            this.isMultiplayerSession()
        ) {
            multiplayerClient
                .sendPaintStroke(
                    resetStroke,
                );
        }

        this.localPaintHistory.forEach(
            (stroke) => {
                stroke.points.forEach(
                    (point) => {
                        this.networkPlayerManager
                            .stampLocalPaintPoint(
                                point.x,
                                point.y,
                                this.brushTextureKey,
                                stroke.color,
                                stroke.size,
                                stroke.shape,
                            );
                    },
                );

                if (
                    broadcast &&
                    this.isMultiplayerSession()
                ) {
                    multiplayerClient
                        .sendPaintStroke(
                            stroke,
                        );
                }
            },
        );
    }

    private schedulePaintHistoryRebuild(): void {
        if (
            this.paintHistoryRebuildTimer !==
            undefined
        ) {
            window.clearTimeout(
                this.paintHistoryRebuildTimer,
            );
        }

        /*
         * 42 ms is short enough to feel instant, but long enough to collapse
         * button mashing into a single expensive texture reconstruction.
         */
        this.paintHistoryRebuildTimer =
            window.setTimeout(
                () => {
                    this.paintHistoryRebuildTimer =
                        undefined;

                    this.rebuildLocalPaintFromHistory();
                },
                42,
            );
    }

    private undoLastPaintStroke(): void {
        if (
            this.phase !== 'paint' ||
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !==
                    'hider'
            )
        ) {
            return;
        }

        this.finishActivePaintStroke();

        const removedStroke =
            this.localPaintHistory.pop();

        if (!removedStroke) {
            return;
        }

        /*
         * Undo moves the stroke to the Redo stack rather than discarding it.
         */
        this.redoPaintHistory.push(
            removedStroke,
        );

        if (
            this.redoPaintHistory.length >
            40
        ) {
            this.redoPaintHistory.shift();
        }

        this.schedulePaintHistoryRebuild();

        this.showStatus(
            tr('한 단계 되돌렸습니다.'),
        );
    }

    private redoLastPaintStroke(): void {
        if (
            this.phase !== 'paint' ||
            (
                !this.isMultiplayerSession() &&
                this.practiceMode !==
                    'hider'
            )
        ) {
            return;
        }

        this.finishActivePaintStroke();

        const restoredStroke =
            this.redoPaintHistory.pop();

        if (!restoredStroke) {
            return;
        }

        this.localPaintHistory.push(
            restoredStroke,
        );

        /*
         * Never trim localPaintHistory here either. It is also the complete
         * reconstruction source for the Hunt transition.
         */

        /*
         * Rebuild and broadcast the same complete paint state used by Undo,
         * so Redo is visible on every connected player's screen as well.
         */
        this.schedulePaintHistoryRebuild();

        this.showStatus(
            tr('한 단계 다시 실행했습니다.'),
        );
    }

    private applyRemotePaintStroke(
        stroke: NetworkPaintStroke,
    ): void {
        if (stroke.points.length === 0) {
            return;
        }

        const textureKey =
            `${this.remoteBrushTexturePrefix}-` +
            `${stroke.shape}-${stroke.size}-` +
            `${stroke.color}`;

        this.ensureRemoteBrushTexture(
            textureKey,
            stroke.color,
            stroke.size,
            stroke.shape,
        );

        this.networkPlayerManager.applyPaintStroke(
            stroke,
            textureKey,
        );
    }

    private ensureRemoteBrushTexture(
        textureKey: string,
        color: number,
        size: number,
        shape: NetworkBrushShape,
    ): void {
        if (
            this.textures.exists(
                textureKey,
            )
        ) {
            return;
        }

        if (size === 1) {
            const graphics =
                this.add.graphics();

            graphics.fillStyle(
                color,
                1,
            );
            graphics.fillRect(
                0,
                0,
                1,
                1,
            );
            graphics.generateTexture(
                textureKey,
                1,
                1,
            );
            this.textures
                .get(textureKey)
                .setFilter(
                    Phaser.Textures
                        .FilterMode.NEAREST,
                );
            graphics.destroy();
            return;
        }

        const radius =
            Math.max(
                1,
                Math.round(size),
            );

        const diameter =
            radius * 2 + 1;

        const graphics =
            this.add.graphics();

        graphics.fillStyle(
            color,
            1,
        );

        if (shape === 'dotCircle') {
            /*
             * 로컬 DOT CIRCLE 브러시와 같은 픽셀 원 알고리즘을
             * 사용해 다른 클라이언트에서도 네모로 보이지 않게 합니다.
             */
            const center = (diameter - 1) / 2;
            const pixelRadius = Math.max(0.5, diameter / 2 - 0.25);

            for (let y = 0; y < diameter; y += 1) {
                for (let x = 0; x < diameter; x += 1) {
                    const dx = x - center;
                    const dy = y - center;
                    if (dx * dx + dy * dy <= pixelRadius * pixelRadius) {
                        graphics.fillRect(x, y, 1, 1);
                    }
                }
            }
        } else if (
            shape === 'circle'
        ) {
            graphics.fillCircle(
                diameter / 2,
                diameter / 2,
                radius,
            );
        } else {
            graphics.fillRect(
                0,
                0,
                diameter,
                diameter,
            );
        }

        graphics.generateTexture(
            textureKey,
            diameter,
            diameter,
        );

        this.textures
            .get(textureKey)
            .setFilter(
                Phaser.Textures.FilterMode.NEAREST,
            );

        graphics.destroy();
    }

    private ensureEyedropperMagnifier(): void {
        if (
            this.eyedropperMagnifier &&
            this.eyedropperMagnifierSwatch
        ) {
            return;
        }

        if (
            !this.textures.exists(
                this.eyedropperMagnifierTextureKey,
            )
        ) {
            const canvasTexture =
                this.textures.createCanvas(
                    this.eyedropperMagnifierTextureKey,
                    112,
                    112,
                );

            if (!canvasTexture) {
                return;
            }

            canvasTexture.refresh();

            this.textures
                .get(
                    this.eyedropperMagnifierTextureKey,
                )
                .setFilter(
                    Phaser.Textures.FilterMode.NEAREST,
                );
        }

        this.eyedropperMagnifier =
            this.add.image(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.eyedropperMagnifierTextureKey,
            )
                .setScrollFactor(0)
                .setDepth(9100)
                .setVisible(false);

        this.eyedropperToolGuide =
            this.add.graphics()
                .setDepth(9102)
                .setVisible(false);

        this.eyedropperMagnifierSwatch =
            this.add.rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2 + 64,
                42,
                14,
                0xffffff,
                1,
            )
                .setStrokeStyle(
                    2,
                    0xffffff,
                    0.95,
                )
                .setScrollFactor(0)
                .setDepth(9101)
                .setVisible(false);
    }

    private showMobileIdleEyedropperGuide(): void {
        if (
            !this.mobileControlsEnabled ||
            this.phase !== 'paint' ||
            !this.eyedropperArmed
        ) {
            return;
        }

        this.ensureEyedropperMagnifier();
        this.eyedropperMagnifier
            ?.setVisible(false);
        this.eyedropperMagnifierSwatch
            ?.setVisible(false);
        this.hideMobilePaintPrecisionGuide();
        this.paintPreview
            ?.setVisible(false);

        const container =
            this.networkPlayerManager
                ?.getLocalPlayerContainer?.();

        if (!container || !this.eyedropperToolGuide) {
            return;
        }

        const zoom =
            Math.max(0.01, this.cameras.main.zoom);
        const visualScale =
            Math.max(
                Math.abs(container.scaleX || 1),
                Math.abs(container.scaleY || 1),
            );

        const target =
            this.mobileLastBrushTargetWorld?.clone() ??
            new Phaser.Math.Vector2(
                container.x,
                container.y - 18 * visualScale,
            );

        const grip =
            new Phaser.Math.Vector2(
                target.x + 72 / zoom,
                target.y + 82 / zoom,
            );

        this.drawMobileEyedropperGuide(
            target,
            grip,
            this.paintColor,
        );
    }

    private drawMobileEyedropperGuide(
        target: Phaser.Math.Vector2,
        grip: Phaser.Math.Vector2,
        previewColor: number,
    ): void {
        const guide = this.eyedropperToolGuide;
        if (!guide) {
            return;
        }

        const zoom =
            Math.max(0.01, this.cameras.main.zoom);

        /*
         * V1010416_FINGER_EYEDROPPER_SWATCH_RESTORE
         * Finger mode samples at the actual finger position and shows only
         * the sampled-color preview above the finger. Never draw the pipette.
         */
        if (
            this.mobilePaintInputMode ===
                'finger'
        ) {
            /*
             * V1010475_MOBILE_PAINT_UX_POLISH / EXACT_FINGER_CENTER
             * The square is centered exactly where the finger touched.
             * That same target is also the sampling coordinate.
             */
            const previewX =
                target.x;
            const previewY =
                target.y;
            /*
             * V1010492B_LARGER_FINGER_SWATCH
             * Same center, same sampled pixel. Bigger visual only.
             */
            /*
             * V1010493_FINGER_PREVIEW_3X
             *
             * Sampling coordinate stays EXACTLY at the finger / preview center.
             * Only the visible color chip becomes ~3x larger.
             */
            const outerSize =
                176 / zoom;
            const innerSize =
                136 / zoom;

            guide
                .clear()
                .fillStyle(
                    0x172027,
                    0.94,
                )
                .fillRoundedRect(
                    previewX - outerSize / 2,
                    previewY - outerSize / 2,
                    outerSize,
                    outerSize,
                    10 / zoom,
                )
                .fillStyle(
                    previewColor,
                    1,
                )
                .fillRoundedRect(
                    previewX - innerSize / 2,
                    previewY - innerSize / 2,
                    innerSize,
                    innerSize,
                    7 / zoom,
                )
                .lineStyle(
                    4 / zoom,
                    0xffffff,
                    0.97,
                )
                .strokeRoundedRect(
                    previewX - innerSize / 2,
                    previewY - innerSize / 2,
                    innerSize,
                    innerSize,
                    7 / zoom,
                )
                .setVisible(true);
            return;
        }
        const dx = grip.x - target.x;
        const dy = grip.y - target.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const barrelStartX = target.x + ux * (18 / zoom);
        const barrelStartY = target.y + uy * (18 / zoom);

        const bulbStartX =
            grip.x - ux * (15 / zoom);
        const bulbStartY =
            grip.y - uy * (15 / zoom);

        guide
            .clear()
            /*
             * V1010349_PAINT_BANNER_TOOL_ART_JOYSTICK_CENTER / DETAILED_EYEDROPPER
             * Sampled color chip remains beside the exact sampling tip.
             */
            .fillStyle(
                0x172027,
                0.95,
            )
            .fillCircle(
                target.x - px * (25 / zoom),
                target.y - py * (25 / zoom),
                16 / zoom,
            )
            .fillStyle(
                previewColor,
                1,
            )
            .fillCircle(
                target.x - px * (25 / zoom),
                target.y - py * (25 / zoom),
                12 / zoom,
            )
            /* dark barrel silhouette */
            .lineStyle(
                14 / zoom,
                0x304b54,
                1,
            )
            .lineBetween(
                barrelStartX,
                barrelStartY,
                bulbStartX,
                bulbStartY,
            )
            /* translucent glass body */
            .lineStyle(
                9 / zoom,
                0xd9edf4,
                1,
            )
            .lineBetween(
                barrelStartX,
                barrelStartY,
                bulbStartX,
                bulbStartY,
            )
            /* glass highlight */
            .lineStyle(
                2 / zoom,
                0xffffff,
                0.92,
            )
            .lineBetween(
                barrelStartX + px * (2 / zoom),
                barrelStartY + py * (2 / zoom),
                bulbStartX + px * (2 / zoom),
                bulbStartY + py * (2 / zoom),
            )
            /* sampled-color liquid inside glass */
            .lineStyle(
                4 / zoom,
                previewColor,
                0.94,
            )
            .lineBetween(
                target.x + ux * (29 / zoom),
                target.y + uy * (29 / zoom),
                bulbStartX - ux * (2 / zoom),
                bulbStartY - uy * (2 / zoom),
            )
            /* rubber bulb silhouette */
            .lineStyle(
                19 / zoom,
                0x26363d,
                1,
            )
            .lineBetween(
                bulbStartX,
                bulbStartY,
                grip.x,
                grip.y,
            )
            /* rubber bulb body */
            .lineStyle(
                13 / zoom,
                0x8fa6b0,
                1,
            )
            .lineBetween(
                bulbStartX,
                bulbStartY,
                grip.x,
                grip.y,
            )
            /* flat bulb end cap: no confusing circle */
            .lineStyle(
                15 / zoom,
                0x26363d,
                1,
            )
            .lineBetween(
                grip.x - px * (6 / zoom),
                grip.y - py * (6 / zoom),
                grip.x + px * (6 / zoom),
                grip.y + py * (6 / zoom),
            )
            .lineStyle(
                9 / zoom,
                0xaec3cb,
                1,
            )
            .lineBetween(
                grip.x - px * (5 / zoom),
                grip.y - py * (5 / zoom),
                grip.x + px * (5 / zoom),
                grip.y + py * (5 / zoom),
            )
            /* dark exact sampling-tip silhouette */
            .fillStyle(
                0x26363d,
                1,
            )
            .fillTriangle(
                target.x - ux * (2 / zoom),
                target.y - uy * (2 / zoom),
                target.x + ux * (21 / zoom) -
                    px * (8 / zoom),
                target.y + uy * (21 / zoom) -
                    py * (8 / zoom),
                target.x + ux * (21 / zoom) +
                    px * (8 / zoom),
                target.y + uy * (21 / zoom) +
                    py * (8 / zoom),
            )
            /* glass sampling tip */
            .fillStyle(
                0xe8f5f9,
                1,
            )
            .fillTriangle(
                target.x,
                target.y,
                target.x + ux * (19 / zoom) -
                    px * (5 / zoom),
                target.y + uy * (19 / zoom) -
                    py * (5 / zoom),
                target.x + ux * (19 / zoom) +
                    px * (5 / zoom),
                target.y + uy * (19 / zoom) +
                    py * (5 / zoom),
            )
            .setVisible(true);
    }

    private hideEyedropperMagnifier(): void {
        this.stopMobileNativeEyedropperDrag();

        this.eyedropperPointerId = -1;

        this.eyedropperMagnifier
            ?.setVisible(false);

        this.eyedropperMagnifierSwatch
            ?.setVisible(false);

        this.eyedropperToolGuide
            ?.clear()
            .setVisible(false);
    }

    private getMobileNativeEyedropperWorldPoints(
        clientX: number,
        clientY: number,
    ): {
        target: Phaser.Math.Vector2;
        grip: Phaser.Math.Vector2;
    } | null {
        const canvas =
            this.game.canvas;

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return null;
        }

        /*
         * Convert browser client coordinates to Phaser logical screen
         * coordinates. This bypasses Phaser.Pointer's occasionally stale x/y
         * values after DOM overlays / pointer capture transitions.
         */
        const screenX =
            (
                clientX -
                rect.left
            ) *
            (
                this.gameWidth /
                rect.width
            );

        const screenY =
            (
                clientY -
                rect.top
            ) *
            (
                this.gameHeight /
                rect.height
            );

        const target =
            new Phaser.Math.Vector2();

        const grip =
            new Phaser.Math.Vector2();

        /*
         * V1010474B_STANDALONE_MOBILE_PAINT_UX / FINGER_PIPETTE_SYNC
         *
         * Finger mode's visible square preview is centered at
         * (fingerX + 40, fingerY - 94). Sample THAT exact center.
         * Precision mode keeps the visible pipette-tip offset.
         */
        const targetScreenX =
            this.mobilePaintInputMode === 'finger'
                ? screenX
                : screenX - 46;
        const targetScreenY =
            this.mobilePaintInputMode === 'finger'
                ? screenY
                : screenY - 54;

        this.cameras.main.getWorldPoint(
            targetScreenX,
            targetScreenY,
            target,
        );

        this.cameras.main.getWorldPoint(
            screenX,
            screenY,
            grip,
        );

        return {
            target,
            grip,
        };
    }

    private updateMobileNativeEyedropperDrag(
        clientX: number,
        clientY: number,
        forceSample = false,
    ): Phaser.Math.Vector2 | null {
        const points =
            this.getMobileNativeEyedropperWorldPoints(
                clientX,
                clientY,
            );

        if (!points) {
            return null;
        }

        this.mobileLastBrushTargetWorld =
            points.target.clone();

        const now =
            performance.now();

        if (
            forceSample ||
            now -
                this.mobileEyedropperLastSampleAt >=
                80
        ) {
            this.mobileEyedropperLastSampleAt =
                now;

            this.mobileEyedropperPreviewColor =
                this.getEyedropperColorAtWorld(
                    points.target.x,
                    points.target.y,
                ) ??
                this.mobileEyedropperPreviewColor;
        }

        /*
         * This draw is deliberately cheap and always runs for every native
         * pointermove, independently from preview-color sampling.
         */
        this.drawMobileEyedropperGuide(
            points.target,
            points.grip,
            this.mobileEyedropperPreviewColor,
        );

        return points.target;
    }

    private stopMobileNativeEyedropperDrag(): void {
        if (
            this.mobileNativeEyedropperMoveHandler
        ) {
            window.removeEventListener(
                'pointermove',
                this.mobileNativeEyedropperMoveHandler,
                true,
            );

            this.mobileNativeEyedropperMoveHandler =
                undefined;
        }

        if (
            this.mobileNativeEyedropperEndHandler
        ) {
            window.removeEventListener(
                'pointerup',
                this.mobileNativeEyedropperEndHandler,
                true,
            );
            window.removeEventListener(
                'pointercancel',
                this.mobileNativeEyedropperEndHandler,
                true,
            );

            this.mobileNativeEyedropperEndHandler =
                undefined;
        }

        if (
            this.mobileNativeEyedropperTouchMoveHandler
        ) {
            window.removeEventListener(
                'touchmove',
                this.mobileNativeEyedropperTouchMoveHandler,
                true,
            );
            this.mobileNativeEyedropperTouchMoveHandler =
                undefined;
        }

        if (
            this.mobileNativeEyedropperTouchEndHandler
        ) {
            window.removeEventListener(
                'touchend',
                this.mobileNativeEyedropperTouchEndHandler,
                true,
            );
            window.removeEventListener(
                'touchcancel',
                this.mobileNativeEyedropperTouchEndHandler,
                true,
            );
            this.mobileNativeEyedropperTouchEndHandler =
                undefined;
        }

        this.mobileNativeEyedropperPointerId =
            -1;
        this.mobileNativeEyedropperTouchIdentifier =
            -1;
    }

    private startMobileNativeEyedropperDrag(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.stopMobileNativeEyedropperDrag();

        /*
         * v0.10.10.236.8:
         * Some mobile browsers (notably iOS/WebView combinations) give Phaser
         * a TouchEvent-backed pointer. In those browsers our v236.7
         * PointerEvent listener never started, which exactly matches the
         * symptom "first touch works, drag never moves".
         *
         * Install BOTH native PointerEvent and TouchEvent tracking paths.
         * Whichever stream the browser actually emits will keep the pipette
         * moving. Both are window-capture + passive:false, so DOM overlays and
         * browser scrolling cannot steal the active drag.
         */

        const nativeEvent =
            pointer.event;

        if (
            typeof PointerEvent !== 'undefined' &&
            nativeEvent instanceof PointerEvent
        ) {
            this.mobileNativeEyedropperPointerId =
                nativeEvent.pointerId;

            this.mobileNativeEyedropperMoveHandler =
                (
                    event:
                        PointerEvent,
                ): void => {
                    if (
                        event.pointerId !==
                            this.mobileNativeEyedropperPointerId ||
                        !this.eyedropperArmed ||
                        this.phase !== 'paint'
                    ) {
                        return;
                    }

                    if (event.cancelable) {
                        event.preventDefault();
                    }

                    this.updateMobileNativeEyedropperDrag(
                        event.clientX,
                        event.clientY,
                    );
                };

            this.mobileNativeEyedropperEndHandler =
                (
                    event:
                        PointerEvent,
                ): void => {
                    if (
                        event.pointerId !==
                            this.mobileNativeEyedropperPointerId
                    ) {
                        return;
                    }

                    if (event.cancelable) {
                        event.preventDefault();
                    }

                    const target =
                        this.updateMobileNativeEyedropperDrag(
                            event.clientX,
                            event.clientY,
                            true,
                        );

                    if (
                        target &&
                        this.eyedropperArmed
                    ) {
                        this.pickColorFromBackground(
                            target.x,
                            target.y,
                        );

                        this.mobileLastBrushTargetWorld =
                            target.clone();

                        this.eyedropperPointerId =
                            -1;

                        /*
                         * V1010474B_STANDALONE_MOBILE_PAINT_UX: sample is complete; return to the last
                         * Circle/Square brush instead of leaving pipette armed.
                         */
                        this.activateMobileBrushTool(
                            this.mobileBrushShapeBeforeEyedropper,
                        );

                        this.isPainting = false;
                        this.finishActivePaintStroke();
                    }

                    this.releaseMobilePaintPointer();
                    this.stopMobileNativeEyedropperDrag();

                    /*
                     * V101023832_STABLE_MOBILE_PINCH_OWNERSHIP
                     * Do not clear mobileTouchPoints from the native eyedropper
                     * callback. Native and Phaser end events can arrive in
                     * different orders; clearing the whole map here can erase a
                     * newly registered real finger. releasePointer owns removal.
                     */
                    this.mobilePinchDistance = 0;
                    this.mobilePinchActive = false;
                    this.eyedropperPointerId = -1;
                };

            window.addEventListener(
                'pointermove',
                this.mobileNativeEyedropperMoveHandler,
                {
                    capture: true,
                    passive: false,
                },
            );

            window.addEventListener(
                'pointerup',
                this.mobileNativeEyedropperEndHandler,
                true,
            );

            window.addEventListener(
                'pointercancel',
                this.mobileNativeEyedropperEndHandler,
                true,
            );

            this.updateMobileNativeEyedropperDrag(
                nativeEvent.clientX,
                nativeEvent.clientY,
                true,
            );
        }

        /*
         * TouchEvent fallback is installed even when PointerEvent exists.
         * Certain Android/iOS embedded browsers expose PointerEvent globally
         * but Phaser's active stream still comes through TouchEvent.
         */
        const getTrackedTouch =
            (
                event:
                    TouchEvent,
            ): Touch | undefined => {
                const allTouches =
                    [
                        ...Array.from(
                            event.touches,
                        ),
                        ...Array.from(
                            event.changedTouches,
                        ),
                    ];

                if (
                    this.mobileNativeEyedropperTouchIdentifier >=
                        0
                ) {
                    return allTouches.find(
                        (touch) =>
                            touch.identifier ===
                            this.mobileNativeEyedropperTouchIdentifier,
                    );
                }

                return allTouches[0];
            };

        if (
            typeof TouchEvent !== 'undefined' &&
            nativeEvent instanceof TouchEvent
        ) {
            const firstTouch =
                nativeEvent.changedTouches[0] ??
                nativeEvent.touches[0];

            if (firstTouch) {
                this.mobileNativeEyedropperTouchIdentifier =
                    firstTouch.identifier;

                this.updateMobileNativeEyedropperDrag(
                    firstTouch.clientX,
                    firstTouch.clientY,
                    true,
                );
            }
        } else {
            /*
             * If Phaser gave us PointerEvent, we still don't know the Touch
             * identifier yet. The first touchmove will adopt the only active
             * touch automatically.
             */
            this.mobileNativeEyedropperTouchIdentifier =
                -1;
        }

        this.mobileNativeEyedropperTouchMoveHandler =
            (
                event:
                    TouchEvent,
            ): void => {
                if (
                    !this.eyedropperArmed ||
                    this.phase !== 'paint'
                ) {
                    return;
                }

                const touch =
                    getTrackedTouch(
                        event,
                    );

                if (!touch) {
                    return;
                }

                if (
                    this.mobileNativeEyedropperTouchIdentifier <
                        0
                ) {
                    this.mobileNativeEyedropperTouchIdentifier =
                        touch.identifier;
                }

                if (event.cancelable) {
                    event.preventDefault();
                }

                this.updateMobileNativeEyedropperDrag(
                    touch.clientX,
                    touch.clientY,
                );
            };

        this.mobileNativeEyedropperTouchEndHandler =
            (
                event:
                    TouchEvent,
            ): void => {
                if (
                    !this.eyedropperArmed
                ) {
                    return;
                }

                const endedTouch =
                    Array.from(
                        event.changedTouches,
                    ).find(
                        (touch) =>
                            this.mobileNativeEyedropperTouchIdentifier <
                                0 ||
                            touch.identifier ===
                                this.mobileNativeEyedropperTouchIdentifier,
                    );

                if (!endedTouch) {
                    return;
                }

                if (event.cancelable) {
                    event.preventDefault();
                }

                const target =
                    this.updateMobileNativeEyedropperDrag(
                        endedTouch.clientX,
                        endedTouch.clientY,
                        true,
                    );

                if (target) {
                    this.pickColorFromBackground(
                        target.x,
                        target.y,
                    );

                    this.mobileLastBrushTargetWorld =
                        target.clone();

                    this.eyedropperPointerId =
                        -1;

                    /*
                     * V1010474B_STANDALONE_MOBILE_PAINT_UX: sample is complete; return to the last
                     * Circle/Square brush instead of leaving pipette armed.
                     */
                    this.activateMobileBrushTool(
                        this.mobileBrushShapeBeforeEyedropper,
                    );

                    this.isPainting = false;
                    this.finishActivePaintStroke();
                }

                this.releaseMobilePaintPointer();
                this.stopMobileNativeEyedropperDrag();
            };

        window.addEventListener(
            'touchmove',
            this.mobileNativeEyedropperTouchMoveHandler,
            {
                capture: true,
                passive: false,
            },
        );

        window.addEventListener(
            'touchend',
            this.mobileNativeEyedropperTouchEndHandler,
            {
                capture: true,
                passive: false,
            },
        );

        window.addEventListener(
            'touchcancel',
            this.mobileNativeEyedropperTouchEndHandler,
            {
                capture: true,
                passive: false,
            },
        );

        /*
         * Ensure the game canvas itself never hands a one-finger eyedropper
         * drag to browser panning/zooming.
         */
        this.game.canvas.style.touchAction =
            'none';
    }

    private updateEyedropperMagnifier(
        pointer: Phaser.Input.Pointer,
    ): void {
        this.ensureEyedropperMagnifier();

        if (!this.eyedropperMagnifier) {
            return;
        }

        /*
         * v0.10.10.236.5 MOBILE EYEDROPPER FAST PATH
         *
         * The old mobile path rebuilt an invisible 15x15 loupe canvas on every
         * pointermove, including reconstructing the entire local paint history.
         * The loupe itself has been hidden since v197, so that work only caused
         * severe drag stutter.
         *
         * Mobile now samples exactly ONE color at the visible pipette tip and
         * redraws only the lightweight Graphics guide.
         *
         * IMPORTANT: use getPaintInputWorldPoint(), not
         * getPaintPreviewWorldPoint(). The latter intentionally snaps BRUSH
         * coordinates to character texture pixels, which made the pipette
         * appear to move in jerky steps over the background.
         */
        if (this.mobileControlsEnabled) {
            /*
             * CRITICAL: movement must be cheap.
             * Move/redraw the pipette on EVERY pointer event, but do the
             * expensive body-history + image pixel read only once per 80ms.
             * The selected color is still sampled exactly on finger-up.
             */
            const target =
                this.getPaintInputWorldPoint(
                    pointer,
                );

            this.mobileLastBrushTargetWorld =
                target.clone();

            const now =
                performance.now();

            if (
                now -
                    this.mobileEyedropperLastSampleAt >=
                80
            ) {
                this.mobileEyedropperLastSampleAt =
                    now;

                this.mobileEyedropperPreviewColor =
                    this.getEyedropperColorAtWorld(
                        target.x,
                        target.y,
                    ) ??
                    this.mobileEyedropperPreviewColor;
            }

            const grip =
                this.getPointerWorldPoint(
                    pointer,
                );

            this.eyedropperMagnifier
                .setVisible(false);
            this.eyedropperMagnifierSwatch
                ?.setVisible(false);

            this.drawMobileEyedropperGuide(
                target,
                grip,
                this.mobileEyedropperPreviewColor,
            );

            return;
        }

        const sourceImage =
            this.textures
                .get(
                    this.currentBackgroundTextureKey,
                )
                .getSourceImage() as
                    HTMLImageElement;

        if (!sourceImage) {
            return;
        }

        const bounds =
            this.backgroundImage.getBounds();

        /*
         * v0.10.10.198:
         * The mobile pipette is intentionally offset from the fingertip,
         * exactly like the diagonal brush. Sample from the PIPETTE TIP, not
         * from pointer.worldX/worldY. This keeps the live color chip and the
         * color committed on pointer-up perfectly aligned with the visible
         * tool tip.
         */
        const sampleWorldPoint =
            this.mobileControlsEnabled
                ? this.getPaintPreviewWorldPoint(
                    pointer,
                )
                : this.getPointerWorldPoint(
                    pointer,
                );

        const normalizedX =
            Phaser.Math.Clamp(
                (
                    sampleWorldPoint.x -
                    bounds.left
                ) /
                bounds.width,
                0,
                1,
            );

        const normalizedY =
            Phaser.Math.Clamp(
                (
                    sampleWorldPoint.y -
                    bounds.top
                ) /
                bounds.height,
                0,
                1,
            );

        const imageX =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedX *
                    sourceImage.width,
                ),
                0,
                sourceImage.width - 1,
            );

        const imageY =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedY *
                    sourceImage.height,
                ),
                0,
                sourceImage.height - 1,
            );

        const sampleSize = 15;
        const half =
            Math.floor(
                sampleSize / 2,
            );

        const sourceX =
            Phaser.Math.Clamp(
                imageX - half,
                0,
                Math.max(
                    0,
                    sourceImage.width -
                    sampleSize,
                ),
            );

        const sourceY =
            Phaser.Math.Clamp(
                imageY - half,
                0,
                Math.max(
                    0,
                    sourceImage.height -
                    sampleSize,
                ),
            );

        const texture =
            this.textures.get(
                this.eyedropperMagnifierTextureKey,
            );

        const canvas =
            texture.getSourceImage() as
                HTMLCanvasElement;

        const context =
            canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.clearRect(
            0,
            0,
            112,
            112,
        );

        /*
         * Build a 15x15 representation of what is ACTUALLY visible:
         * background + the local player's current painted RenderTexture.
         * The old loupe sampled only the raw background image, so already
         * painted pixels vanished inside the mobile magnifier.
         */
        const sceneSample =
            document.createElement(
                'canvas',
            );

        sceneSample.width =
            sampleSize;
        sceneSample.height =
            sampleSize;

        const sceneContext =
            sceneSample.getContext(
                '2d',
            );

        if (!sceneContext) {
            return;
        }

        sceneContext.imageSmoothingEnabled =
            false;

        sceneContext.drawImage(
            sourceImage,
            sourceX,
            sourceY,
            sampleSize,
            sampleSize,
            0,
            0,
            sampleSize,
            sampleSize,
        );

        /*
         * Always draw the Hider base silhouette first. This must NOT depend
         * on RenderTexture readback, which can fail on mobile/WebGL.
         */
        if (
            this.networkPlayerManager
                ?.isLocalHider?.()
        ) {
            const localPosition =
                this.networkPlayerManager
                    .getLocalPlayerPosition();

            const localScale =
                this.networkPlayerManager
                    .getLocalPlayerVisualScale();

            if (localPosition) {
                const worldPerSourceX =
                    bounds.width /
                    sourceImage.width;

                const worldPerSourceY =
                    bounds.height /
                    sourceImage.height;

                const patchWorldLeft =
                    bounds.left +
                    sourceX *
                        worldPerSourceX;

                const patchWorldTop =
                    bounds.top +
                    sourceY *
                        worldPerSourceY;

                const bodyWorldLeft =
                    localPosition.x -
                    40 *
                        localScale;

                const bodyWorldTop =
                    localPosition.y -
                    60 *
                        localScale;

                const destX =
                    (
                        bodyWorldLeft -
                        patchWorldLeft
                    ) /
                    worldPerSourceX;

                const destY =
                    (
                        bodyWorldTop -
                        patchWorldTop
                    ) /
                    worldPerSourceY;

                const destWidth =
                    (
                        80 *
                        localScale
                    ) /
                    worldPerSourceX;

                const destHeight =
                    (
                        120 *
                        localScale
                    ) /
                    worldPerSourceY;

                const bodyCanvas =
                    document.createElement(
                        'canvas',
                    );

                bodyCanvas.width = 80;
                bodyCanvas.height = 120;

                const bodyContext =
                    bodyCanvas.getContext(
                        '2d',
                    );

                if (bodyContext) {
                    bodyContext.imageSmoothingEnabled =
                        false;
                    bodyContext.fillStyle =
                        '#f5eee2';

                    for (
                        let bodyY = 0;
                        bodyY < 120;
                        bodyY += 1
                    ) {
                        for (
                            let bodyX = 0;
                            bodyX < 80;
                            bodyX += 1
                        ) {
                            const headDx =
                                bodyX - 40;
                            const headDy =
                                bodyY - 48;

                            const insideHead =
                                headDx * headDx +
                                    headDy * headDy <=
                                12 * 12;

                            const insideBody =
                                bodyX >= 31 &&
                                bodyX <= 48 &&
                                bodyY >= 55 &&
                                bodyY <= 78;

                            const insideLeftArm =
                                bodyX >= 24 &&
                                bodyX <= 31 &&
                                bodyY >= 57 &&
                                bodyY <= 74;

                            const insideRightArm =
                                bodyX >= 48 &&
                                bodyX <= 55 &&
                                bodyY >= 57 &&
                                bodyY <= 74;

                            const insideLeftLeg =
                                bodyX >= 31 &&
                                bodyX <= 38 &&
                                bodyY >= 75 &&
                                bodyY <= 88;

                            const insideRightLeg =
                                bodyX >= 41 &&
                                bodyX <= 48 &&
                                bodyY >= 75 &&
                                bodyY <= 88;

                            if (
                                insideHead ||
                                insideBody ||
                                insideLeftArm ||
                                insideRightArm ||
                                insideLeftLeg ||
                                insideRightLeg
                            ) {
                                bodyContext.fillRect(
                                    bodyX,
                                    bodyY,
                                    1,
                                    1,
                                );
                            }
                        }
                    }

                    /*
                     * Reconstruct the current camouflage directly from the
                     * authoritative local stroke history.
                     *
                     * This is intentionally independent from Phaser/WebGL
                     * RenderTexture readback, which is unreliable on several
                     * mobile browsers. Undo/Redo already mutate this same
                     * localPaintHistory, so the loupe automatically shows the
                     * exact current painted state.
                     */
                    bodyContext.save();
                    bodyContext.globalCompositeOperation =
                        'source-atop';

                    const drawHistoryPoint = (
                        stroke:
                            NetworkPaintStroke,
                        point:
                            NetworkPaintPoint,
                    ): void => {
                        const radius =
                            Math.max(
                                1,
                                Math.round(
                                    stroke.size,
                                ),
                            );

                        bodyContext.fillStyle =
                            `#${stroke.color
                                .toString(16)
                                .padStart(6, '0')}`;

                        if (
                            stroke.size === 1
                        ) {
                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ),
                                Math.round(
                                    point.y,
                                ),
                                1,
                                1,
                            );
                            return;
                        }

                        if (
                            stroke.shape ===
                            'square'
                        ) {
                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ) - radius,
                                Math.round(
                                    point.y,
                                ) - radius,
                                radius * 2 + 1,
                                radius * 2 + 1,
                            );
                            return;
                        }

                        if (
                            stroke.shape ===
                            'circle'
                        ) {
                            bodyContext.beginPath();
                            bodyContext.arc(
                                point.x,
                                point.y,
                                radius,
                                0,
                                Math.PI * 2,
                            );
                            bodyContext.fill();
                            return;
                        }

                        /*
                         * DOT CIRCLE keeps the same pixel-circle geometry
                         * used by the actual brush.
                         */
                        for (
                            let offsetY =
                                -radius;
                            offsetY <=
                                radius;
                            offsetY += 1
                        ) {
                            const halfWidth =
                                Math.floor(
                                    Math.sqrt(
                                        Math.max(
                                            0,
                                            radius *
                                                radius -
                                            offsetY *
                                                offsetY,
                                        ),
                                    ),
                                );

                            bodyContext.fillRect(
                                Math.round(
                                    point.x,
                                ) -
                                    halfWidth,
                                Math.round(
                                    point.y,
                                ) +
                                    offsetY,
                                halfWidth * 2 +
                                    1,
                                1,
                            );
                        }
                    };

                    this.localPaintHistory
                        .forEach(
                            (stroke) => {
                                stroke.points
                                    .forEach(
                                        (point) => {
                                            drawHistoryPoint(
                                                stroke,
                                                point,
                                            );
                                        },
                                    );
                            },
                        );

                    /*
                     * Normally eyedropper arming finishes the active stroke,
                     * but include it defensively so the loupe never lags one
                     * gesture behind.
                     */
                    if (
                        this.currentStrokeHistoryPoints
                            .length > 0
                    ) {
                        const activeStroke:
                            NetworkPaintStroke = {
                                targetSessionId:
                                    multiplayerClient
                                        .getSessionId() ??
                                    '',
                                color:
                                    this.paintColor,
                                size:
                                    this.brushSize,
                                shape:
                                    this.brushShape,
                                points:
                                    this.currentStrokeHistoryPoints,
                            };

                        activeStroke.points
                            .forEach(
                                (point) => {
                                    drawHistoryPoint(
                                        activeStroke,
                                        point,
                                    );
                                },
                            );
                    }

                    bodyContext.restore();

                    sceneContext.drawImage(
                        bodyCanvas,
                        0,
                        0,
                        80,
                        120,
                        destX,
                        destY,
                        destWidth,
                        destHeight,
                    );
                }
            }
        }

        /*
         * Circular pixel loupe.
         */
        context.save();
        context.beginPath();
        context.arc(
            56,
            56,
            50,
            0,
            Math.PI * 2,
        );
        context.clip();
        context.imageSmoothingEnabled =
            false;
        context.drawImage(
            sceneSample,
            0,
            0,
            sampleSize,
            sampleSize,
            6,
            6,
            100,
            100,
        );
        context.restore();

        context.beginPath();
        context.arc(
            56,
            56,
            50,
            0,
            Math.PI * 2,
        );
        context.lineWidth = 5;
        context.strokeStyle =
            '#fffdf3';
        context.stroke();

        /*
         * Exact selected pixel is always the center crosshair.
         */
        context.strokeStyle =
            '#172027';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(
            44,
            56,
        );
        context.lineTo(
            68,
            56,
        );
        context.moveTo(
            56,
            44,
        );
        context.lineTo(
            56,
            68,
        );
        context.stroke();

        const candidateColor =
            this.getEyedropperColorAtWorld(
                sampleWorldPoint.x,
                sampleWorldPoint.y,
            ) ??
            0xffffff;

        (
            texture as unknown as
                {
                    refresh?: () => void;
                }
        ).refresh?.();

        /*
         * v0.10.10.197 mobile eyedropper UX:
         * remove the old giant circular loupe entirely. The eyedropper now
         * occupies the exact same persistent diagonal-tool slot as the brush.
         * Its large color chip sits by the tip, safely away from the finger.
         */
        this.eyedropperMagnifier
            .setVisible(false);
        this.eyedropperMagnifierSwatch
            ?.setVisible(false);

        const target =
            this.getPaintPreviewWorldPoint(pointer);
        this.mobileLastBrushTargetWorld =
            target.clone();

        const zoom =
            Math.max(0.01, this.cameras.main.zoom);
        const grip =
            new Phaser.Math.Vector2(
                target.x + 72 / zoom,
                target.y + 82 / zoom,
            );

        this.drawMobileEyedropperGuide(
            target,
            grip,
            candidateColor,
        );
    }

    private sampleBackgroundColorAtWorld(
        worldX: number,
        worldY: number,
    ): number | null {
        const sourceImage =
            this.textures
                .get(
                    this.currentBackgroundTextureKey,
                )
                .getSourceImage() as
                    HTMLImageElement;

        if (!sourceImage) {
            return null;
        }

        const bounds =
            this.backgroundImage.getBounds();

        const normalizedX =
            Phaser.Math.Clamp(
                (
                    worldX -
                    bounds.left
                ) /
                Math.max(
                    1,
                    bounds.width,
                ),
                0,
                1,
            );

        const normalizedY =
            Phaser.Math.Clamp(
                (
                    worldY -
                    bounds.top
                ) /
                Math.max(
                    1,
                    bounds.height,
                ),
                0,
                1,
            );

        const imageX =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedX *
                    sourceImage.width,
                ),
                0,
                sourceImage.width - 1,
            );

        const imageY =
            Phaser.Math.Clamp(
                Math.floor(
                    normalizedY *
                    sourceImage.height,
                ),
                0,
                sourceImage.height - 1,
            );

        if (
            !this.mobileEyedropperSampleCanvas
        ) {
            this.mobileEyedropperSampleCanvas =
                document.createElement(
                    'canvas',
                );
            this.mobileEyedropperSampleCanvas.width =
                1;
            this.mobileEyedropperSampleCanvas.height =
                1;

            this.mobileEyedropperSampleContext =
                this.mobileEyedropperSampleCanvas.getContext(
                    '2d',
                    {
                        willReadFrequently:
                            true,
                    },
                ) ?? undefined;
        }

        const context =
            this.mobileEyedropperSampleContext;

        if (!context) {
            return null;
        }

        context.clearRect(
            0,
            0,
            1,
            1,
        );

        context.drawImage(
            sourceImage,
            imageX,
            imageY,
            1,
            1,
            0,
            0,
            1,
            1,
        );

        const pixel =
            context.getImageData(
                0,
                0,
                1,
                1,
            ).data;

        return Phaser.Display.Color
            .GetColor(
                pixel[0],
                pixel[1],
                pixel[2],
            );
    }

    private sampleOwnPaintHistoryColorAtWorld(
        worldX: number,
        worldY: number,
    ): number | null {
        if (
            !this.networkPlayerManager
                ?.isLocalHider?.()
        ) {
            return null;
        }

        const container =
            this.networkPlayerManager
                .getLocalPlayerContainer();

        if (!container) {
            return null;
        }

        const scaleX =
            container.scaleX || 1;
        const scaleY =
            container.scaleY || 1;

        /*
         * V101023828_PAINT_DRAG_UNDO_EYEDROPPER
         * Pixel-addressing, not nearest-point rounding. This avoids hopping to
         * the adjacent texel around 1px edges such as Hider legs.
         */
        const textureX =
            Math.floor(
                (
                    worldX -
                    container.x
                ) /
                    scaleX +
                    40,
            );

        const textureY =
            Math.floor(
                (
                    worldY -
                    container.y
                ) /
                    scaleY +
                    60,
            );

        if (
            textureX < 0 ||
            textureX > 79 ||
            textureY < 0 ||
            textureY > 119
        ) {
            return null;
        }

        /*
         * V1010351_EYEDROPPER_BODY_MASK_HOTFIX
         *
         * localPaintHistory lives in the Hider's 80x120 texture coordinate
         * space, but most of that rectangle is transparent. Previously the
         * eyedropper searched stroke history anywhere inside that rectangle.
         * A stroke whose brush footprint crossed transparent space could then
         * win over the map sampler, so a visibly green map pixel could be
         * reported as an old black camouflage color.
         *
         * Only let local camouflage history participate when the pipette tip
         * is on a REAL Hider body pixel. Transparent character bounds must
         * fall through to sampleBackgroundColorAtWorld().
         */
        const headDx = textureX - 40;
        const headDy = textureY - 48;

        const insideHead =
            headDx * headDx +
                headDy * headDy <=
            12 * 12;

        const insideTorso =
            textureX >= 31 &&
            textureX <= 48 &&
            textureY >= 55 &&
            textureY <= 78;

        const insideLeftArm =
            textureX >= 24 &&
            textureX <= 31 &&
            textureY >= 57 &&
            textureY <= 74;

        const insideRightArm =
            textureX >= 48 &&
            textureX <= 55 &&
            textureY >= 57 &&
            textureY <= 74;

        const insideLeftLeg =
            textureX >= 31 &&
            textureX <= 38 &&
            textureY >= 75 &&
            textureY <= 88;

        const insideRightLeg =
            textureX >= 41 &&
            textureX <= 48 &&
            textureY >= 75 &&
            textureY <= 88;

        const insideActualHiderBody =
            insideHead ||
            insideTorso ||
            insideLeftArm ||
            insideRightArm ||
            insideLeftLeg ||
            insideRightLeg;

        if (!insideActualHiderBody) {
            return null;
        }

        /*
         * Walk newest stroke -> oldest stroke so the sampled color is exactly
         * the topmost paint currently visible at this body pixel.
         */
        for (
            let strokeIndex =
                this.localPaintHistory.length -
                1;
            strokeIndex >= 0;
            strokeIndex -= 1
        ) {
            const stroke =
                this.localPaintHistory[
                    strokeIndex
                ];

            const diameter =
                Math.max(
                    1,
                    Math.round(
                        stroke.size,
                    ),
                );

            const minOffset =
                -Math.floor(
                    diameter / 2,
                );

            const maxOffset =
                minOffset +
                diameter -
                1;

            const centerOffset =
                (
                    minOffset +
                    maxOffset
                ) / 2;

            const circleRadius =
                Math.max(
                    0.5,
                    diameter / 2 -
                        0.25,
                );

            for (
                let pointIndex =
                    stroke.points.length -
                        1;
                pointIndex >= 0;
                pointIndex -= 1
            ) {
                const point =
                    stroke.points[
                        pointIndex
                    ];

                const offsetX =
                    textureX -
                    Math.round(
                        point.x,
                    );

                const offsetY =
                    textureY -
                    Math.round(
                        point.y,
                    );

                if (
                    offsetX < minOffset ||
                    offsetX > maxOffset ||
                    offsetY < minOffset ||
                    offsetY > maxOffset
                ) {
                    continue;
                }

                if (
                    stroke.shape !==
                        'square'
                ) {
                    const dx =
                        offsetX -
                        centerOffset;
                    const dy =
                        offsetY -
                        centerOffset;

                    if (
                        dx * dx +
                            dy * dy >
                        circleRadius *
                            circleRadius
                    ) {
                        continue;
                    }
                }

                return stroke.color;
            }
        }

        return null;
    }

    private getEyedropperColorAtWorld(
        worldX: number,
        worldY: number,
    ): number | null {
        return (
            this.sampleOwnPaintHistoryColorAtWorld(
                worldX,
                worldY,
            ) ??
            this.sampleBackgroundColorAtWorld(
                worldX,
                worldY,
            )
        );
    }

    private pickColorFromBackground(
        worldX: number,
        worldY: number,
    ): void {
        const sampledColor =
            this.getEyedropperColorAtWorld(
                worldX,
                worldY,
            );

        if (
            sampledColor === null
        ) {
            this.showStatus(
                tr('배경 이미지를 읽을 수 없습니다'),
            );
            return;
        }

        this.paintColor =
            sampledColor;

        this.mobileEyedropperPreviewColor =
            sampledColor;

        this.createBrushTexture(true);

        this.isPainting = false;
        this.activeStrokePoints = [];
        this.activeStrokeTargetSessionId = '';

        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
    }

    private updatePaintPreview(
        pointer: Phaser.Input.Pointer,
    ): void {
        if (this.phase !== 'paint') {
            this.paintPreview.setVisible(false);
            return;
        }

        const previewPoint =
            this.mobileControlsEnabled
                ? this.getPaintPreviewWorldPoint(
                    pointer,
                )
                : new Phaser.Math.Vector2(
                    pointer.worldX,
                    pointer.worldY,
                );

        this.paintPreview.setPosition(
            previewPoint.x,
            previewPoint.y,
        );

        this.redrawPaintPreview();
        this.paintPreview
            .setAlpha(
                this.mobilePendingPaintPointerId >=
                        0
                    ? 0.72
                    : 1,
            )
            .setVisible(true);
    }

    private updatePaintPreviewImmediately(): void {
        if (
            this.phase !== 'paint' ||
            !this.paintPreview
        ) {
            return;
        }

        const pointer = this.input.activePointer;
        let previewPoint: Phaser.Math.Vector2;

        if (
            this.mobileControlsEnabled &&
            !pointer.isDown &&
            this.mobilePendingPaintPointerId < 0 &&
            !this.isPainting
        ) {
            const container =
                this.networkPlayerManager
                    ?.getLocalPlayerContainer?.();

            const visualScale =
                container
                    ? Math.max(
                        Math.abs(container.scaleX || 1),
                        Math.abs(container.scaleY || 1),
                    )
                    : 1;

            /*
             * Persistent idle swatch on the upper torso. Changing shape or
             * size never makes the preview disappear, so the next stroke's
             * true footprint is always visible.
             */
            previewPoint = container
                ? new Phaser.Math.Vector2(
                    container.x,
                    container.y - 18 * visualScale,
                )
                : this.getPaintPreviewWorldPoint(pointer);
        } else {
            previewPoint =
                this.mobileControlsEnabled
                    ? this.getPaintPreviewWorldPoint(pointer)
                    : new Phaser.Math.Vector2(
                        pointer.worldX,
                        pointer.worldY,
                    );
        }

        this.paintPreview.setPosition(
            previewPoint.x,
            previewPoint.y,
        );

        this.redrawPaintPreview();
        this.paintPreview
            .setAlpha(
                this.mobileControlsEnabled
                    ? 0.72
                    : 1,
            )
            .setVisible(true);

        if (
            this.mobileControlsEnabled &&
            !pointer.isDown &&
            this.mobilePendingPaintPointerId < 0 &&
            !this.isPainting
        ) {
            this.showMobileIdleBrushGuide();
        }
    }

    private updateBrushSizeInput(): void {
        let brushSizeChanged = false;

        const increasePressed =
            Phaser.Input.Keyboard.JustDown(
                this.brushPlusKey,
            ) ||
            Phaser.Input.Keyboard.JustDown(
                this.brushNumpadPlusKey,
            );

        const decreasePressed =
            Phaser.Input.Keyboard.JustDown(
                this.brushMinusKey,
            ) ||
            Phaser.Input.Keyboard.JustDown(
                this.brushNumpadMinusKey,
            );

        if (increasePressed) {
            this.setBrushSize(
                this.brushSize + 1,
            );
            brushSizeChanged = true;
        }

        if (decreasePressed) {
            this.setBrushSize(
                this.brushSize - 1,
            );
            brushSizeChanged = true;
        }

        if (!brushSizeChanged) {
            return;
        }
    }

    private toggleBrushShape(): void {
        const brushOrder:
            BrushShape[] = [
                'dotCircle',
                'circle',
                'square',
            ];

        const currentIndex =
            brushOrder.indexOf(
                this.brushShape,
            );

        this.brushShape =
            brushOrder[
                (currentIndex + 1) %
                brushOrder.length
            ];

        this.createBrushTexture();
        this.highlightBrushShape(
            this.brushShape,
        );
        this.updatePaintHud();
        this.updatePaintPreviewImmediately();
        this.updatePaintControlHelp();

        this.showStatus(
            tr(`${this.getBrushShapeLabel()} 브러시`),
        );
    }

    private getBrushShapeLabel(): string {
        if (
            this.brushShape ===
            'dotCircle'
        ) {
            return tr('DOT CIRCLE');
        }

        if (
            this.brushShape ===
            'circle'
        ) {
            return tr('SMOOTH CIRCLE');
        }

        return tr('SQUARE DOT');
    }

    /*
     * Aim and shotgun
     */

    private createAimObjects(): void {
        /*
         * HOTFIX v0.10.10.152
         *
         * Hiders render at depth 120 and their camouflage at 122.
         * The old local Hunter aimLine used depth 20, so when the line
         * crossed a hidden Hider it disappeared BEHIND the body and
         * unintentionally revealed the exact hiding silhouette.
         *
         * Keep aiming visuals above every gameplay character/paint layer,
         * but far below fixed HUD (3000+ / 6000+).
         */
        this.aimLine = this.add.graphics();
        this.aimLine.setDepth(180);

        this.crosshair = this.add.graphics();
        this.crosshair.setDepth(181);
    }

    private updateAim(): void {
        /*
         * V1010480B_SNIPER_TRANSITION_AIM_SEAL
         *
         * PC's normal shotgun crosshair includes a small center circle at the
         * mouse world point. During sniper transition it looked like a strange
         * clear/bright circle under the incoming scope.
         */
        if (
            this.sniperCinematicActive ||
            this.sniperActive ||
            this.vulcanCinematicActive ||
            this.vulcanActive ||
            Boolean(this.vulcanSpotlight?.visible)
        ) {
            this.aimLine
                ?.clear()
                .setVisible(false);

            this.crosshair
                ?.clear()
                .setVisible(false);

            this.gun?.setVisible(false);
            this.networkPlayerManager?.clearHunterAimLines();
            return;
        }

        /*
         * V1010461_VICTORY_NO_AIM_LINES
         * Victory/social-card capture is an absolute aim-render barrier.
         */
        if (
            this.victoryShowcaseCleanCaptureActive ||
            this.phase !== 'hunt'
        ) {
            this.aimLine
                .clear()
                .setVisible(false);

            this.crosshair
                .clear()
                .setVisible(false);

            this.gun
                .setVisible(false);

            this.networkPlayerManager
                ?.clearHunterAimLines();

            return;
        }

        /*
         * V1010460_SNIPER_OVERWATCH_UI_SCOPE_INPUT_TIMEOUT
         * Overwatch is NOT Hunter shotgun aim.
         * Do not rotate the Hunter, publish shotgun aim, draw line/crosshair,
         * or let the gun follow the sniper pointer.
         */
        if (this.sniperActive) {
            this.aimLine
                .clear()
                .setVisible(false);

            this.crosshair
                .clear()
                .setVisible(false);

            this.gun
                .setVisible(false);

            return;
        }

        /*
         * V1010452N3 / HIDER_AIM_SEAL
         * Hider Battle skills are dormant. Current Hider must never inherit
         * Hunter aim-line/crosshair/gun visuals on PC or Mobile.
         */
        if (
            this.isMultiplayerSession() &&
            (
                multiplayerClient
                    .getLocalPlayer()
                    ?.role === 'hider' ||
                this.networkPlayerManager
                    .isLocalHider()
            )
        ) {
            this.aimLine
                .clear()
                .setVisible(false);

            this.crosshair
                .clear()
                .setVisible(false);

            this.gun
                .setVisible(false);

            return;
        }

        const multiplayer =
            this.isMultiplayerSession();

        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const localHiderSkillCombat =
            multiplayer &&
            this.phase === 'hunt' &&
            (
                localRole === 'hider' ||
                this.networkPlayerManager
                    .isLocalHider()
            );

        const localHunterCombat =
            !multiplayer ||
            this.practiceMode === 'hunter' ||
            this.networkPlayerManager
                .canLocalControlHunter();

        if (
            multiplayer &&
            !localHunterCombat &&
            !localHiderSkillCombat
        ) {
            this.aimLine.clear();
            this.crosshair.clear();
            this.gun.setVisible(false);
            return;
        }

        const origin =
            multiplayer
                ? this.networkPlayerManager
                    .getLocalPlayerPosition()
                : new Phaser.Math.Vector2(
                    this.player.x,
                    this.player.y,
                );

        if (!origin) {
            return;
        }

        const pointer =
            this.input.activePointer;

        const desktopAimWorld =
            !this.mobileControlsEnabled
                ? this.getPointerWorldPoint(
                    pointer,
                )
                : undefined;

        const usingMobileAim =
            this.mobileControlsEnabled &&
            (
                localHunterCombat ||
                localHiderSkillCombat
            ) &&
            this.mobileAimHasDirection;

        const mobileCombatControl =
            this.mobileControlsEnabled &&
            (
                localHunterCombat ||
                localHiderSkillCombat
            );

        const angle =
            mobileCombatControl
                ? (
                    usingMobileAim
                        ? this.mobileAimAngle
                        : this.hunterFocusAngle
                )
                : Phaser.Math.Angle.Between(
                    origin.x,
                    origin.y,
                    desktopAimWorld?.x ??
                        pointer.worldX,
                    desktopAimWorld?.y ??
                        pointer.worldY,
                );

        this.hunterFocusAngle =
            angle;

        /*
         * Hider reuses only the Hunter INPUT contract.
         * Never expose the Hunter gun or publish Hunter aim state.
         */
        if (localHiderSkillCombat) {
            this.gun.setVisible(false);
        } else {
            this.gun.setRotation(angle);

            if (
                this.practiceMode === 'hunter'
            ) {
                this.networkPlayerManager
                    .updateHunterAim(
                        this.practiceHunterSessionId,
                        angle,
                        122,
                    );
            }

            if (multiplayer) {
                const now =
                    this.time.now;

                this.networkPlayerManager
                    .updateHunterAim(
                        multiplayerClient
                            .getSessionId() ?? '',
                        angle,
                        122,
                    );

                if (
                    now -
                    this.lastHunterAimSentAt >=
                    this.hunterAimSendInterval
                ) {
                    this.lastHunterAimSentAt =
                        now;

                    multiplayerClient
                        .sendHunterAim(
                            angle,
                        );
                }
            }
        }

        this.aimLine
            .setDepth(180)
            .clear();

        this.crosshair
            .setDepth(181);

        this.aimLine.lineStyle(
            localHiderSkillCombat ? 1 : 2,
            localHiderSkillCombat &&
                this.selectedHiderSkill === 'laser'
                ? 0xff3344
                : 0xffffff,
            localHiderSkillCombat ? 0.28 : 0.35,
        );

        const lineLength =
            localHiderSkillCombat
                ? 150
                : 122;

        this.aimLine.lineBetween(
            origin.x,
            origin.y,
            origin.x +
                Math.cos(angle) *
                    lineLength,
            origin.y +
                Math.sin(angle) *
                    lineLength,
        );

        if (usingMobileAim) {
            this.drawCrosshair(
                origin.x +
                    Math.cos(angle) *
                    lineLength,
                origin.y +
                    Math.sin(angle) *
                    lineLength,
            );
        } else {
            this.drawCrosshair(
                desktopAimWorld?.x ??
                    pointer.worldX,
                desktopAimWorld?.y ??
                    pointer.worldY,
            );
        }
    }

    private drawCrosshair(
        x: number,
        y: number,
    ): void {
        const size = 11;
        const gap = 4;

        this.crosshair.clear();
        this.crosshair.lineStyle(
            2,
            0xffffff,
            1,
        );

        this.crosshair.lineBetween(
            x - size,
            y,
            x - gap,
            y,
        );

        this.crosshair.lineBetween(
            x + gap,
            y,
            x + size,
            y,
        );

        this.crosshair.lineBetween(
            x,
            y - size,
            x,
            y - gap,
        );

        this.crosshair.lineBetween(
            x,
            y + gap,
            x,
            y + size,
        );

        this.crosshair.strokeCircle(x, y, 2);
    }

    /*
     * V1010452I5_HIDER_SKILL_IMMEDIATE_CONTROLS / LOCAL_SKILL_TEST
     *
     * First gameplay test pass:
     * - desktop: mouse aim + left click
     * - mobile: Hunter AIM stick + FIRE button
     * - paintball stain persists for the round
     * - laser is a short-lived taunt beam
     *
     * This pass deliberately does NOT impersonate Hunter network messages.
     * Multiplayer replication can be wired after input/feel is approved.
     */
    /*
     * V1010452J_PAINTBALL_ARC_SPLASH_LASER_INFINITE
     * Persistent Paintball splats live only for the current Hunt round.
     */
    private hiderSkillRoundFx =
        new Set<Phaser.GameObjects.GameObject>();

    private clearHiderSkillRoundFx(): void {
        this.hiderSkillRoundFx
            .forEach(
                (object) => {
                    object.destroy();
                },
            );

        this.hiderSkillRoundFx.clear();
    }

    private fireHiderSkill(
        aimAngleOverride?: number,
        paintballDistanceOverride?: number,
    ): void {
        if (!this.hiderBattleSkillsEnabled) {
            return;
        }

        if (
            this.phase !== 'hunt' ||
            !this.isMultiplayerSession() ||
            !(
                multiplayerClient.getLocalPlayer()?.role === 'hider' ||
                this.networkPlayerManager.isLocalHider()
            ) ||
            this.spectatorSessionId
        ) {
            return;
        }

        const origin = this.networkPlayerManager.getLocalPlayerPosition();
        if (!origin) return;

        const pointer = this.input.activePointer;
        const desktopAimWorld =
            !this.mobileControlsEnabled
                ? this.getPointerWorldPoint(pointer)
                : undefined;

        const angle =
            aimAngleOverride ??
            (
                this.mobileControlsEnabled && this.mobileAimHasDirection
                    ? this.mobileAimAngle
                    : Phaser.Math.Angle.Between(
                        origin.x,
                        origin.y,
                        desktopAimWorld?.x ?? pointer.worldX,
                        desktopAimWorld?.y ?? pointer.worldY,
                    )
            );

        this.hunterFocusAngle = angle;

        if (this.selectedHiderSkill === 'laser') {
            const range = 390;
            const ux = Math.cos(angle);
            const uy = Math.sin(angle);
            let hitDistance = range;

            this.networkPlayerManager.getAliveHunterPositions().forEach((hunter) => {
                const vx = hunter.x - origin.x;
                const vy = hunter.y - origin.y;
                const projection = vx * ux + vy * uy;

                if (projection <= 0 || projection >= hitDistance) return;

                const nearestX = origin.x + ux * projection;
                const nearestY = origin.y + uy * projection;
                const miss = Phaser.Math.Distance.Between(
                    nearestX,
                    nearestY,
                    hunter.x,
                    hunter.y,
                );

                if (miss <= 18) hitDistance = projection;
            });

            const endX = origin.x + ux * hitDistance;
            const endY = origin.y + uy * hitDistance;

            const beam = this.add.graphics().setDepth(179);
            beam.lineStyle(1, 0xff102f, 0.98);
            beam.lineBetween(origin.x, origin.y, endX, endY);

            if (hitDistance < range) {
                const hitFx = this.add.graphics().setDepth(182);
                hitFx.fillStyle(0xff1238, 1);
                hitFx.fillCircle(endX, endY, 4);
                hitFx.lineStyle(3, 0xff3152, 0.90);
                hitFx.lineBetween(
                    endX - ux * 10,
                    endY - uy * 10,
                    endX + ux * 10,
                    endY + uy * 10,
                );

                this.tweens.add({
                    targets: hitFx,
                    alpha: 0,
                    scale: 1.45,
                    duration: 180,
                    ease: 'Quad.easeOut',
                    onComplete: () => hitFx.destroy(),
                });
            }

            this.tweens.add({
                targets: beam,
                alpha: 0,
                duration: 150,
                ease: 'Quad.easeOut',
                onComplete: () => beam.destroy(),
            });
            return;
        }

        const paintColors = [
            0xff4f87, 0x38bdf8, 0xfacc15, 0x22c55e,
            0x8b5cf6, 0xf97316, 0xef4444, 0x14b8a6,
        ] as const;

        const paintColor = Phaser.Utils.Array.GetRandom([...paintColors]);
        const travelDistance = Phaser.Math.Clamp(
            paintballDistanceOverride ?? 168,
            80,
            245,
        );

        const impactX = origin.x + Math.cos(angle) * travelDistance;
        const impactY = origin.y + Math.sin(angle) * travelDistance;

        const ball = this.add.graphics().setDepth(179);
        ball.fillStyle(paintColor, 1);
        ball.fillRect(-6, -6, 12, 12);
        ball.fillRect(-8, -3, 16, 6);
        ball.fillRect(-3, -8, 6, 16);
        ball.fillStyle(0xffffff, 0.34);
        ball.fillRect(-3, -4, 3, 3);
        ball.setPosition(origin.x, origin.y);

        const travelDuration = Phaser.Math.Linear(
            250,
            430,
            travelDistance / 245,
        );

        let lastTrailAt = -Infinity;

        this.tweens.add({
            targets: ball,
            x: impactX,
            y: impactY,
            duration: travelDuration,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                if (this.time.now - lastTrailAt < 38) return;
                lastTrailAt = this.time.now;

                const trailDot = this.add.rectangle(
                    ball.x,
                    ball.y,
                    Phaser.Math.Between(3, 6),
                    Phaser.Math.Between(3, 6),
                    paintColor,
                    0.60,
                ).setDepth(177);

                this.tweens.add({
                    targets: trailDot,
                    alpha: 0,
                    scale: 0.35,
                    duration: 220,
                    ease: 'Quad.easeOut',
                    onComplete: () => trailDot.destroy(),
                });
            },
            onComplete: () => {
                ball.destroy();

                const splat = this.add.graphics().setDepth(124);
                splat.fillStyle(paintColor, 0.94);
                splat.fillCircle(impactX, impactY, 24);

                [
                    [-30, -10, 10], [29, -14, 9], [-25, 21, 8],
                    [30, 19, 8], [-7, -34, 7], [10, 35, 6],
                    [-39, 7, 5], [41, 4, 5], [-19, -28, 4], [22, 31, 4],
                ].forEach(([dx, dy, radius]) => {
                    splat.fillCircle(impactX + dx, impactY + dy, radius);
                });

                const impactRing = this.add.circle(impactX, impactY, 12)
                    .setStrokeStyle(3, paintColor, 0.86)
                    .setDepth(178);

                this.tweens.add({
                    targets: impactRing,
                    scale: 3.6,
                    alpha: 0,
                    duration: 230,
                    ease: 'Quad.easeOut',
                    onComplete: () => impactRing.destroy(),
                });

                this.hiderSkillRoundFx.add(splat);
            },
        });

        this.tweens.add({
            targets: ball,
            scaleX: 1.65,
            scaleY: 1.65,
            duration: travelDuration / 2,
            ease: 'Sine.easeOut',
            yoyo: true,
        });

        this.tweens.add({
            targets: ball,
            angle: 14,
            scaleX: '+=0.10',
            scaleY: '-=0.08',
            duration: 70,
            yoyo: true,
            repeat: Math.max(1, Math.floor(travelDuration / 140)),
        });
    }

    /* V1010498_FEATURE_DISCOVERY_BUBBLES: short "띠용" discovery bubble anchored to a real button. */
    private showFeatureDiscoveryBubble(
        kind: 'sniper' | 'paintAssist',
    ): void {
        const existing =
            kind === 'sniper'
                ? this.sniperDiscoveryBubble
                : this.paintAssistDiscoveryBubble;

        existing?.remove();

        const language = getLanguage();
        const copy =
            kind === 'sniper'
                ? ({
                    ko: '필살기! 눌러보세요!',
                    ja: '必殺技！押してみよう！',
                    en: 'ULTIMATE! Try it!',
                    zh: '必杀技！试试看！',
                } as const)[language]
                : ({
                    ko: '색칠이 서툴면 도움받으세요!',
                    ja: '色塗りが苦手ならお手伝い！',
                    en: 'Need help painting? Try this!',
                    zh: '不擅长上色？试试辅助！',
                } as const)[language];

        const bubble = document.createElement('div');
        bubble.textContent = copy;

        const isPaintAssistBubble =
            kind === 'paintAssist';

        Object.assign(bubble.style,{
            position:'fixed',
            zIndex:'2147483001',
            pointerEvents:'none',
            boxSizing:'border-box',
            padding:this.mobileControlsEnabled ? '7px 10px' : '9px 13px',
            borderRadius:'13px',
            border:isPaintAssistBubble
                ? '2px solid rgba(34,49,43,.96)'
                : '2px solid rgba(255,255,255,.92)',
            background:isPaintAssistBubble
                ? 'rgba(255,248,218,.98)'
                : 'rgba(25,32,43,.96)',
            color:isPaintAssistBubble
                ? '#26362f'
                : '#fff7c7',
            fontFamily:'"Arial Black","Noto Sans KR",Arial,sans-serif',
            fontSize:this.mobileControlsEnabled ? '12px' : '15px',
            fontWeight:'900',
            lineHeight:'1.15',
            whiteSpace:'nowrap',
            textAlign:'center',
            textShadow:isPaintAssistBubble
                ? '0 1px 0 rgba(255,255,255,.8)'
                : '0 2px 2px rgba(0,0,0,.75)',
            boxShadow:isPaintAssistBubble
                ? '0 7px 18px rgba(34,49,43,.22)'
                : '0 8px 22px rgba(0,0,0,.32)',
            opacity:'0',
            transform:'translateY(-8px) scale(.92)',
            transition:'opacity 150ms ease, transform 180ms cubic-bezier(.2,1.5,.4,1)',
        });

        const tail=document.createElement('span');
        Object.assign(tail.style,{
            position:'absolute',
            left:'50%',
            top:'-10px',
            transform:'translateX(-50%)',
            width:'0',
            height:'0',
            borderLeft:'9px solid transparent',
            borderRight:'9px solid transparent',
            borderBottom:isPaintAssistBubble
                ? '10px solid rgba(255,248,218,.98)'
                : '10px solid rgba(25,32,43,.96)',
        });
        bubble.appendChild(tail);
        document.body.appendChild(bubble);

        if(kind==='sniper') this.sniperDiscoveryBubble=bubble;
        else this.paintAssistDiscoveryBubble=bubble;

        const place=():void=>{
            if(!document.body.contains(bubble))return;
            const canvas=this.game.canvas.getBoundingClientRect();
            let target:DOMRect|undefined;

            if(kind==='paintAssist'){
                target=this.paintAssistButton?.getBoundingClientRect();
            }else if(this.sniperButton?.visible){
                const scaleX=canvas.width/this.gameWidth;
                const scaleY=canvas.height/this.gameHeight;
                const cx=canvas.left+this.sniperButton.x*scaleX;
                const cy=canvas.top+this.sniperButton.y*scaleY;
                const w=176*scaleX;
                const h=44*scaleY;
                target=new DOMRect(cx-w/2,cy-h/2,w,h);
            }

            if(!target)return;
            const bw=bubble.offsetWidth;
            let left=target.left+target.width/2-bw/2;
            left=Math.max(canvas.left+6,Math.min(left,canvas.right-bw-6));
            // Requested: directly UNDER the button, never over the character/button.
            let top:number;

            if(kind==='paintAssist'){
                /*
                 * V1010499B_UI_POLISH_SPECTATOR_VICTORY / PAINT_HELP_PERSISTENT_BUBBLE
                 * Paint Help guidance belongs ABOVE the Paint Help button,
                 * like the READY guidance bubble. It remains there until used.
                 */
                top=Math.max(
                    canvas.top+6,
                    target.top-bubble.offsetHeight-12,
                );
                tail.style.top='auto';
                tail.style.bottom='-10px';
                tail.style.borderBottom='0 solid transparent';
                tail.style.borderTop='10px solid rgba(255,248,218,.98)';
            }else{
                /*
                 * Keep the sniper discovery bubble clearly separated from the
                 * sniper-mode button instead of visually covering it.
                 */
                /*
                 * V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE / SNIPER_HINT_REAL_GAP
                 * Previous target rect/pulse could make 18~22px look almost
                 * unchanged. Add another ~22px of real separation.
                 */
                const sniperGap =
                    this.mobileControlsEnabled
                        ? 112
                        : 116;
                top=target.bottom+sniperGap;

                if(top+bubble.offsetHeight>canvas.bottom-6){
                    top=Math.max(
                        canvas.top+6,
                        target.top-bubble.offsetHeight-sniperGap,
                    );
                    tail.style.top='auto';
                    tail.style.bottom='-10px';
                    tail.style.borderBottom='0 solid transparent';
                    tail.style.borderTop='10px solid rgba(25,32,43,.96)';
                }
            }

            bubble.style.left=`${Math.round(left)}px`;
            bubble.style.top=`${Math.round(top)}px`;
        };

        place();

        /*
         * V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE / DISCOVERY_BUBBLE_FOLLOWS_TARGET
         * Phaser support buttons can move/pulse after the DOM bubble is created.
         * Re-anchor for the whole visible lifetime instead of sampling only once.
         */
        let placementFrames = 0;
        const followTarget =
            (): void => {
                if (
                    !document.body.contains(bubble) ||
                    placementFrames > 330
                ) {
                    return;
                }

                placementFrames += 1;
                place();
                requestAnimationFrame(
                    followTarget,
                );
            };

        requestAnimationFrame(
            followTarget,
        );

        requestAnimationFrame(()=>{
            place();
            if(document.body.contains(bubble)){
                bubble.style.opacity='1';
                bubble.style.transform='translateY(0) scale(1)';
            }
        });
        window.setTimeout(place,100);

        /*
         * V1010499B_UI_POLISH_SPECTATOR_VICTORY: Paint Help hint is persistent until the player presses
         * the Paint Help button (or Paint UI is destroyed). Sniper remains
         * a short one-time discovery hint.
         */
        if(kind==='sniper'){
            window.setTimeout(()=>{
                if(!document.body.contains(bubble))return;
                bubble.style.opacity='0';
                bubble.style.transform='translateY(-4px) scale(.96)';
                window.setTimeout(()=>{
                    bubble.remove();
                    if(this.sniperDiscoveryBubble===bubble)
                        this.sniperDiscoveryBubble=undefined;
                },220);
            },4200);
        }
    }

    private hideFeatureDiscoveryBubble(
        kind: 'sniper' | 'paintAssist',
    ): void {
        const bubble =
            kind === 'sniper'
                ? this.sniperDiscoveryBubble
                : this.paintAssistDiscoveryBubble;
        bubble?.remove();
        if(kind==='sniper') this.sniperDiscoveryBubble=undefined;
        else this.paintAssistDiscoveryBubble=undefined;
    }

    /* V1010456_SNIPER_SEQUENCE_SCOPE_REWORK */
    private ensureSniperSupportUi(): void {
        if (this.sniperButton) return;

        const buttonWidth =
            176;
        const buttonHeight =
            44;

        const bg =
            this.add.rectangle(
                0,
                0,
                buttonWidth,
                buttonHeight,
                0x183428,
                0.98,
            )
                .setStrokeStyle(
                    2,
                    0xa7f3d0,
                    0.96,
                );

        const label =
            this.add.text(
                0,
                0,
                '🎯 저격 모드 전환',
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize:
                        '15px',
                    fontStyle:
                        'bold',
                    color:
                        '#ffffff',
                    stroke:
                        '#07120d',
                    strokeThickness:
                        2,
                },
            )
                .setOrigin(0.5);

        const button =
            this.add.container(
                this.gameWidth / 2,
                this.gameHeight / 2 + 64,
                [
                    bg,
                    label,
                ],
            )
                .setDepth(25020)
                .setScrollFactor(0)
                .setSize(
                    buttonWidth,
                    buttonHeight,
                )
                .setInteractive({
                    useHandCursor: true,
                })
                .setVisible(false);

        button.on(
            'pointerdown',
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                if (
                    !this.sniperAvailable ||
                    this.sniperActive
                ) {
                    return;
                }

                /*
                 * V1010489_POINTERDOWN_FOCUS_BRIDGE
                 *
                 * Local visual state must switch on the SAME frame as the click.
                 * Do not wait for server RTT to set sniperActive.
                 */
                this.hideFeatureDiscoveryBubble('sniper');
                this.vulcanSupportCommitted = true;
                this.sniperButton?.disableInteractive().setVisible(false);
                this.vulcanButton?.disableInteractive().setVisible(false);

                this.sniperButtonPressBlockUntil =
                    Date.now() +
                    2_500;

                this.hiderVisionGraphics
                    ?.clear()
                    .setVisible(false);

                this.hiderVisionOverlays
                    .forEach(
                        (overlay) =>
                            overlay.setVisible(false),
                    );

                this.hunterMinimapPanel
                    ?.setVisible(false);

                this.hunterMinimapText
                    ?.setVisible(false);

                this.hunterMinimapMarker
                    ?.setVisible(false);

                this.heartbeatDangerOverlay
                    ?.setVisible(false)
                    .setAlpha(0);

                this.heartbeatBorders
                    .forEach(
                        (border) =>
                            border
                                .setVisible(false)
                                .setAlpha(0),
                    );

                this.heartbeatText
                    ?.setVisible(false);

                this.hidePointText
                    ?.setVisible(false);

                this.aimLine
                    ?.clear()
                    .setVisible(false);

                this.crosshair
                    ?.clear()
                    .setVisible(false);

                this.gun
                    ?.setVisible(false);

                button.setVisible(false);

                this.unlockGameAudio();
                /*
                 * V1010490_DISABLE_SUPPORT_INPUT_ON_CLICK
                 * Hidden Phaser UI must not retain an active hit area.
                 */
                button
                    .disableInteractive()
                    .setVisible(false);

                /*
                 * V1010492B_PRACTICE_SNIPER_ACTIVATE
                 */
                if (
                    this.practiceMode ===
                    'hunter'
                ) {
                    this.sniperActive =
                        true;
                    this.sniperAvailable =
                        true;
                    this.sniperReadyAt =
                        0;

                    this.networkPlayerManager
                        .setLocalMovementHardLocked(
                            true,
                        );

                    this.startSniperTacticalBgm();
                    this.enterSniperCinematic();
                    this.refreshSniperSupportUi();
                    return;
                }

                multiplayerClient
                    .sendSniperToggle(
                        true,
                    );
            },
        );

        this.sniperButton =
            button;
        this.sniperButtonBg =
            bg;
        this.sniperButtonText =
            label;

        const vulcanBg =
            this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x302814, 0.98)
                .setStrokeStyle(2, 0xfde68a, 0.96);

        const vulcanLabel =
            this.add.text(0, 0, '🚁 발칸 공중지원', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '15px',
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#120d04',
                strokeThickness: 2,
            }).setOrigin(0.5);

        const vulcanButton =
            this.add.container(
                this.gameWidth / 2,
                this.gameHeight / 2 + 110,
                [vulcanBg, vulcanLabel],
            )
                .setDepth(25020)
                .setScrollFactor(0)
                .setSize(buttonWidth, buttonHeight)
                .setInteractive({ useHandCursor: true })
                .setVisible(false);

        vulcanButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            pointer.event?.preventDefault?.();
            pointer.event?.stopPropagation?.();
            if (!this.sniperAvailable || this.sniperActive || this.vulcanActive || this.vulcanSupportCommitted) return;

            this.hideFeatureDiscoveryBubble('sniper');
            this.vulcanSupportCommitted = true;
            this.sniperButtonPressBlockUntil = Date.now() + 2_500;
            this.sniperButton?.disableInteractive().setVisible(false);
            vulcanButton.disableInteractive().setVisible(false);
            this.unlockGameAudio();

            if (this.practiceMode === 'hunter') {
                this.vulcanActive = true;
                this.networkPlayerManager.setLocalMovementHardLocked(true);
                this.startSniperTacticalBgm();
                this.enterVulcanCinematic(true);
                return;
            }
            multiplayerClient.sendVulcanToggle(true);
        });

        this.vulcanButton = vulcanButton;
        this.vulcanButtonText = vulcanLabel;

        this.fixedHudBaseTransforms.set(vulcanButton, {
            x: this.gameWidth / 2,
            y: this.gameHeight / 2 + 110,
            scaleX: 1,
            scaleY: 1,
        });

        this.tweens.add({
            targets: vulcanBg,
            scaleX: 178 / 176,
            scaleY: 46 / 44,
            duration: 820,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this.vulcanDarkness =
            this.add.graphics()
                .setDepth(24993)
                .setVisible(false);

        this.vulcanSpotlight =
            this.add.graphics()
                .setDepth(24995)
                .setVisible(false);

        this.vulcanCooldownGraphics =
            this.add.graphics()
                .setDepth(24996)
                .setVisible(false);

        this.vulcanCinematicShade =
            this.add.rectangle(
                this.gameWidth / 2,
                this.gameHeight / 2,
                this.gameWidth + 8,
                this.gameHeight + 8,
                0x02060a,
                0,
            )
                .setDepth(25008)
                .setScrollFactor(0)
                .setVisible(false);

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.vulcanActive ||
                    this.phase !==
                        'hunt' ||
                    this.vulcanCinematicActive
                ) {
                    return;
                }

                const world =
                    pointer.positionToCamera(
                        this.cameras.main,
                    ) as Phaser.Math.Vector2;

                this.vulcanTargetX =
                    Phaser.Math.Clamp(
                        world.x,
                        0,
                        960,
                    );

                this.vulcanTargetY =
                    Phaser.Math.Clamp(
                        world.y,
                        0,
                        540,
                    );

                /*
                 * IMPORTANT:
                 * Do not freeze spotlight while the Vulcan is firing.
                 * Hunter can sweep the 3-second burst across the map.
                 */
                const now =
                    this.time.now;

                if (
                    now -
                        this.vulcanLastAimBroadcastAt >=
                        66 &&
                    this.practiceMode !==
                        'hunter'
                ) {
                    this.vulcanLastAimBroadcastAt =
                        now;

                    multiplayerClient
                        .sendVulcanAim(
                            this.vulcanTargetX,
                            this.vulcanTargetY,
                        );
                }
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.vulcanActive ||
                    this.phase !==
                        'hunt' ||
                    this.vulcanCinematicActive
                ) {
                    return;
                }

                const now =
                    Date.now();

                if (
                    this.vulcanFiring ||
                    this.vulcanOverheated ||
                    now <
                        this.vulcanReadyAt ||
                    this.vulcanHeat >=
                        0.999
                ) {
                    return;
                }

                pointer.event
                    ?.preventDefault?.();

                const world =
                    pointer.positionToCamera(
                        this.cameras.main,
                    ) as Phaser.Math.Vector2;

                this.vulcanTargetX =
                    Phaser.Math.Clamp(
                        world.x,
                        0,
                        960,
                    );

                this.vulcanTargetY =
                    Phaser.Math.Clamp(
                        world.y,
                        0,
                        540,
                    );

                this.vulcanPointerHeld =
                    true;

                this.vulcanFiring =
                    true;

                this.vulcanFireStartedAt =
                    now;

                this.vulcanLastMuzzleFxAt =
                    0;


                /*
                 * Immediate audible confirmation.
                 */
                this.playVulcanGunPulse();

                if (
                    this.practiceMode !==
                    'hunter'
                ) {
                    multiplayerClient
                        .sendVulcanAim(
                            this.vulcanTargetX,
                            this.vulcanTargetY,
                        );

                    multiplayerClient
                        .sendVulcanFireStart();
                }
            },
        );

        const stopVulcanPointerFire =
            (): void => {
                if (
                    !this.vulcanPointerHeld &&
                    !this.vulcanFiring
                ) {
                    return;
                }

                const now =
                    Date.now();

                this.vulcanPointerHeld =
                    false;

                this.vulcanFiring =
                    false;

                this.vulcanHeatUpdatedAt =
                    now;

                if (
                    this.practiceMode !==
                    'hunter'
                ) {
                    multiplayerClient
                        .sendVulcanFireStop();
                }
            };

        this.input.on(
            Phaser.Input.Events.POINTER_UP,
            stopVulcanPointerFire,
        );

        this.input.on(
            Phaser.Input.Events.POINTER_UP_OUTSIDE,
            stopVulcanPointerFire,
        );

        this.fixedHudBaseTransforms.set(
            button,
            {
                x:
                    this.gameWidth / 2,
                y:
                    this.gameHeight / 2 + 64,
                scaleX:
                    1,
                scaleY:
                    1,
            },
        );

        /*
         * TRUE micro-pulse:
         * container scale stays exactly 1.
         * Only the background rectangle grows 176x44 -> 178x46.
         */
        /*
         * V1010480B_SNIPER_TRUE_MICRO_HEARTBEAT
         *
         * Never scale the whole HUD container.
         * Scale only its background:
         *   176x44 -> visually about 178x46 -> 176x44.
         */
        bg.setScale(1);

        this.tweens.add({
            targets:
                bg,
            scaleX:
                178 / 176,
            scaleY:
                46 / 44,
            duration:
                820,
            yoyo:
                true,
            repeat:
                -1,
            ease:
                'Sine.easeInOut',
        });

        /*
         * Countdown: text only. No panel/background.
         */
        this.sniperRadioText =
            this.add.text(
                this.gameWidth / 2,
                this.gameHeight / 2 + 60,
                '',
                {
                    fontFamily:
                        'Arial, sans-serif',
                    fontSize:
                        '15px',
                    fontStyle:
                        'bold',
                    color:
                        '#f5fbff',
                    stroke:
                        '#06131c',
                    strokeThickness:
                        4,
                    align:
                        'center',
                },
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(25019)
                .setVisible(false);

        this.fixedHudBaseTransforms.set(
            this.sniperRadioText,
            {
                x:
                    this.gameWidth / 2,
                y:
                    this.gameHeight / 2 + 60,
                scaleX:
                    1,
                scaleY:
                    1,
            },
        );

        this.sniperScope =
            this.add.graphics()
                .setDepth(25032)
                .setScrollFactor(0)
                .setVisible(false);

        this.sniperScopeShade =
            this.add.graphics()
                .setDepth(25030)
                .setScrollFactor(0)
                .setVisible(false);

        this.sniperReloadGraphics =
            this.add.graphics()
                .setDepth(25033)
                .setScrollFactor(0)
                .setVisible(false);

        this.input.on(
            Phaser.Input.Events.POINTER_MOVE,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.sniperActive ||
                    this.phase !== 'hunt' ||
                    this.mobileControlsEnabled
                ) {
                    return;
                }

                const world =
                    pointer.positionToCamera(
                        this.cameras.main,
                    ) as Phaser.Math.Vector2;

                this.setSniperAimWorld(
                    world.x,
                    world.y,
                );
            },
        );

        this.input.on(
            Phaser.Input.Events.POINTER_DOWN,
            (
                pointer:
                    Phaser.Input.Pointer,
            ) => {
                if (
                    !this.sniperActive ||
                    this.phase !== 'hunt' ||
                    this.mobileControlsEnabled
                ) {
                    return;
                }

                /*
                 * V1010490_GHOST_BUTTON_BOUNDS_FIX
                 *
                 * Invisible support-button bounds must NEVER create a dead
                 * shooting zone in active sniper mode.
                 */
                if (
                    this.sniperButton?.visible &&
                    this.sniperButton.input?.enabled &&
                    this.sniperButton
                        .getBounds()
                        .contains(
                            pointer.x,
                            pointer.y,
                        )
                ) {
                    return;
                }

                pointer.event
                    ?.preventDefault?.();
                pointer.event
                    ?.stopPropagation?.();

                this.fireSniperAtCurrentAim();
            },
        );
    }

    /* V1010460B_REMOVE_UNUSED_SNIPER_COUNTDOWN_LEGACY: countdown text is now authored directly by refreshSniperSupportUi(). */

    private syncSniperScopeToPointer(
        pointer:
            Phaser.Input.Pointer,
        broadcast:
            boolean,
    ): void {
        this.sniperScopeScreenX =
            Phaser.Math.Clamp(
                pointer.x,
                0,
                this.gameWidth,
            );

        this.sniperScopeScreenY =
            Phaser.Math.Clamp(
                pointer.y,
                0,
                this.gameHeight,
            );

        const world =
            pointer.positionToCamera(
                this.cameras.main,
            ) as Phaser.Math.Vector2;

        this.sniperAimWorldX =
            Phaser.Math.Clamp(
                world.x,
                0,
                this.gameWidth,
            );

        this.sniperAimWorldY =
            Phaser.Math.Clamp(
                world.y,
                0,
                this.gameHeight,
            );

        if (
            broadcast &&
            this.time.now -
                this.sniperLastAimBroadcastAt >=
                66
        ) {
            this.sniperLastAimBroadcastAt =
                this.time.now;

            multiplayerClient
                .sendSniperAim(
                    this.sniperAimWorldX,
                    this.sniperAimWorldY,
                );
        }

        this.drawLocalSniperScope(
            this.sniperAimWorldX,
            this.sniperAimWorldY,
        );
    }

    /* V1010456A_REMOVE_UNUSED_SET_SNIPER_AIM_WORLD: obsolete helper removed; syncSniperScopeToPointer is authoritative. */


    private getSniperRadioMessage(
        seconds: number,
    ): string {
        const value = Phaser.Math.Clamp(seconds, 1, 5);
        const language = getLanguage();

        if (language === 'ja') return '戦術支援 待機中... ' + String(value);
        if (language === 'en') return 'Tactical support standing by... ' + String(value);
        if (language === 'zh') return '战术支援待命中... ' + String(value);
        return '전술지원 대기중... ' + String(value);
    }

    private setSniperAimWorld(
        x: number,
        y: number,
    ): void {
        this.sniperAimWorldX =
            Phaser.Math.Clamp(
                x,
                0,
                this.gameWidth,
            );

        this.sniperAimWorldY =
            Phaser.Math.Clamp(
                y,
                0,
                this.gameHeight,
            );

        this.drawLocalSniperScope(
            this.sniperAimWorldX,
            this.sniperAimWorldY,
        );

        multiplayerClient.sendSniperAim(
            this.sniperAimWorldX,
            this.sniperAimWorldY,
        );
    }

    private fireSniperAtCurrentAim(): void {
        if (!this.sniperScopeInteractive) {
            return;
        }

        const now = Date.now();
        if (now < this.sniperReadyAt) return;

        if (
            this.practiceMode ===
            'hunter'
        ) {
            /*
             * V1010492B_PRACTICE_SNIPER_FIRE
             */
            const hit =
                this.hiders.find(
                    (hider) =>
                        hider.alive &&
                        this.getAllPartObjects(
                            hider,
                        ).some(
                            (part) =>
                                Phaser.Geom.Rectangle.Contains(
                                    part.getBounds(),
                                    this.sniperAimWorldX,
                                    this.sniperAimWorldY,
                                ),
                        ),
                );

            if (hit) {
                this.hitHider(
                    hit,
                );

                this.showHitMarker();

                if (
                    this.getAliveHiderCount() ===
                    0
                ) {
                    this.showHunterVictory();
                }
            }
        } else {
            multiplayerClient.sendSniperFire(
                this.sniperAimWorldX,
                this.sniperAimWorldY,
            );
        }

        this.sniperReadyAt =
            now + 2000;

        this.playProceduralSniperShot();

        this.time.delayedCall(
            310,
            () => {
                if (
                    this.sniperActive &&
                    this.phase ===
                        'hunt'
                ) {
                    this.playProceduralSniperRack();
                }
            },
        );

        this.time.delayedCall(
            980,
            () => {
                if (
                    this.sniperActive &&
                    this.phase ===
                        'hunt'
                ) {
                    this.playProceduralSniperRack();
                }
            },
        );

        this.sniperScopeDom
            ?.animate(
                [
                    {
                        transform:
                            'translateY(0) scale(1)',
                        filter:
                            'brightness(1)',
                    },
                    {
                        transform:
                            'translateY(-13px) scale(1.055)',
                        filter:
                            'brightness(2.4)',
                    },
                    {
                        transform:
                            'translateY(0) scale(1)',
                        filter:
                            'brightness(1)',
                    },
                ],
                {
                    duration:
                        170,
                    easing:
                        'cubic-bezier(.2,.8,.2,1)',
                },
            );

        /*
         * V1010455C_SNIPER_MOBILE_CONTROLS_PC_HELI_FLICKER_FIRE_PERF
         * Mobile keeps optic recoil but skips expensive full-canvas shake.
         */
        if (
            !this.mobileControlsEnabled
        ) {
            this.cameras.main.shake(
                210,
                0.016,
            );
        }

        this.sniperScopeCamera
            ?.shake(
                180,
                0.020,
            );

        if (this.sniperScope) {
            this.tweens.killTweensOf(
                this.sniperScope,
            );

            this.tweens.add({
                targets:
                    this.sniperScope,
                y: -14,
                angle:
                    Phaser.Math.Between(
                        -2,
                        2,
                    ),
                scaleX: 1.045,
                scaleY: 1.045,
                duration: 65,
                yoyo: true,
                ease: 'Quad.easeOut',
            });
        }

        this.refreshSniperSupportUi();
    }

    /* RESTORE_SNIPER_EXACT_E43DCB5_LOCAL_SUBSYSTEM: exact local sniper subsystem restored from git e43dcb5. */
    private enterSniperCinematic(): void {
        this.applyTacticalSupportInputLock();


        /*
         * V1010501G2_CLEAN_SCOPE_START
         * Transition-order fix only. No blur/mask/zoom geometry changes.
         */
        this.aimLine
            ?.clear()
            .setVisible(false);

        this.crosshair
            ?.clear()
            .setVisible(false);

        this.sniperScope
            ?.clear()
            .setVisible(false);

        this.sniperScopeShade
            ?.clear()
            .setVisible(false);

        this.sniperReloadGraphics
            ?.clear()
            .setVisible(false);

        this.sniperScopeCamera
            ?.setVisible(false);

        /*
         * V1010480B_ENTER_SNIPER_CLEAR_NORMAL_AIM
         * Clear the desktop shotgun cursor BEFORE sniper transition visuals.
         */
        this.aimLine
            ?.clear()
            .setVisible(false);

        this.crosshair
            ?.clear()
            .setVisible(false);

        if (
            this.sniperCinematicActive ||
            this.phase !==
                'hunt'
        ) {
            return;
        }

        this.sniperCinematicActive =
            true;
        this.sniperScopeInteractive =
            false;
        this.sniperHelicopterArrived =
            false;

        this.sniperSavedCameraZoom =
            this.cameras.main.zoom;

        this.sniperButton
            ?.setVisible(false);

        this.sniperRadioText
            ?.setVisible(false);

        /*
         * V1010459_SNIPER_INDEPENDENT_OVERWATCH
         * The instant support is accepted, Hunter vision restrictions are gone.
         * Helicopter/zoom are cinematic follow-up, not prerequisites.
         */
        this.hiderVisionGraphics
            ?.clear()
            .setVisible(false);

        this.hiderVisionOverlays
            .forEach(
                (overlay) =>
                    overlay.setVisible(false),
            );

        this.heartbeatDangerOverlay
            .setVisible(false)
            .setAlpha(0);

        this.heartbeatBorders
            .forEach(
                (border) =>
                    border
                        .setVisible(false)
                        .setAlpha(0),
            );

        this.mobileMoveBase
            ?.setVisible(false);
        this.mobileMoveKnob
            ?.setVisible(false);
        this.mobileMoveLabel
            ?.setVisible(false);

        /*
         * Old shotgun aiming belongs to the running Hunter mode.
         * Once support is accepted it disappears before the helicopter enters.
         */
        this.aimLine
            ?.setVisible(false);
        this.crosshair
            ?.clear()
            .setVisible(false);
        this.gun
            ?.setVisible(false);

        this.mobileAimBase
            ?.setVisible(false);
        this.mobileAimKnob
            ?.setVisible(false);
        this.mobileAimLabel
            ?.setVisible(false);
        this.mobileFireButton
            ?.setVisible(false);
        this.mobileFireLabel
            ?.setVisible(false);

        this.hunterWeaponHudContainer
            ?.setVisible(false);

        /*
         * V1010462_SNIPER_SCOPE_POLISH_VICTORY_SCALE_RESTORE
         * Chat stays visually present, but it stops participating in hit testing
         * for the whole Overwatch session. Set this once to avoid hover jank.
         */
        if (this.chatRoot) {
            this.chatRoot.style.pointerEvents =
                'none';
            this.chatRoot.style.cursor =
                'default';
            this.chatRoot.style.userSelect =
                'none';
        }

        if (this.chatLog) {
            this.chatLog.style.pointerEvents =
                'none';
            this.chatLog.style.cursor =
                'default';
            this.chatLog.style.userSelect =
                'none';
        }

        if (this.chatInput) {
            this.chatInput.blur();
            this.chatInput.style.pointerEvents =
                'none';
            this.chatInput.style.cursor =
                'default';
            this.chatInput.style.userSelect =
                'none';
            this.chatInput.tabIndex =
                -1;
        }

        if (this.chatSendButton) {
            this.chatSendButton.style.pointerEvents =
                'none';
            this.chatSendButton.style.cursor =
                'default';
            this.chatSendButton.tabIndex =
                -1;
        }

        if (this.unifiedBgmButton) {
            this.unifiedBgmButton.style.pointerEvents = 'none';
            this.unifiedBgmButton.style.cursor = 'default';
            this.unifiedBgmButton.style.userSelect = 'none';
            this.unifiedBgmButton.tabIndex = -1;
        }

        if (this.controlsHelpRoot) {
            this.controlsHelpRoot.style.pointerEvents = 'none';
            this.controlsHelpRoot.style.cursor = 'default';
            this.controlsHelpRoot.style.userSelect = 'none';
        }

        if (this.controlsHelpButton) {
            this.controlsHelpButton.style.pointerEvents = 'none';
            this.controlsHelpButton.style.cursor = 'default';
            this.controlsHelpButton.style.userSelect = 'none';
            this.controlsHelpButton.tabIndex = -1;
        }

        const localPosition =
            this.networkPlayerManager
                .getLocalPlayerPosition();

        if (!localPosition) {
            this.sniperActive =
                false;
            multiplayerClient
                .sendSniperToggle(
                    false,
                );
            return;
        }

        this.sniperAimWorldX =
            localPosition.x;
        this.sniperAimWorldY =
            localPosition.y;

        this.mobileSniperAimX = 0;
        this.mobileSniperAimY = 0;
        this.mobileSniperScopeDirty = true;

        this.startSniperHelicopterAudio();
        this.createSniperHelicopter();

        const camera =
            this.cameras.main;

        const startY =
            camera.worldView.bottom +
            74 /
                Math.max(
                    0.01,
                    camera.zoom,
                );

        this.sniperHelicopter
            ?.setPosition(
                localPosition.x,
                startY,
            )
            .setAlpha(
                0.68,
            );

        if (
            this.sniperHelicopter
        ) {
            this.tweens.add({
                targets:
                    this.sniperHelicopter,
                y:
                    localPosition.y,
                alpha:
                    0.72,
                duration:
                    720,
                ease:
                    'Cubic.easeOut',
                onComplete:
                    () => {
                        if (
                            !this.sniperActive ||
                            this.phase !==
                                'hunt'
                        ) {
                            return;
                        }

                        this.sniperHelicopterArrived =
                            true;

                        /*
                         * Only NOW remove the black/fan vision restriction.
                         */
                        this.hiderVisionGraphics
                            ?.clear()
                            .setVisible(
                                false,
                            );

                        this.hiderVisionOverlays
                            .forEach(
                                (
                                    overlay,
                                ) =>
                                    overlay
                                        .setVisible(
                                            false,
                                        ),
                            );

                        this.startSniperWholeMapZoom();
                    },
            });
        } else {
            this.sniperHelicopterArrived =
                true;
            this.startSniperWholeMapZoom();
        }
    }

    private startSniperHelicopterAudio(): void {
        if (
            !this.audioUnlocked ||
            !this.bgmEnabled
        ) {
            return;
        }

        try {
            const hasRotorAudio =
                this.cache.audio.exists(
                    'sniper-helicopter-rotor',
                );

            if (
                hasRotorAudio &&
                !this.sniperHelicopterSound
            ) {
                this.sniperHelicopterSound =
                    this.sound.add(
                        'sniper-helicopter-rotor',
                        {
                            /*
                             * V1010455M_CINEMATIC_WAR_TACTICAL_BGM_REMIX
                             * Rotor is ambience, not the main mix.
                             */
                            volume:
                                0.26,
                            loop:
                                true,
                        },
                    );
            }

            if (
                this.sniperHelicopterSound &&
                !this.sniperHelicopterSound
                    .isPlaying
            ) {
                this.sniperHelicopterSound
                    .play();
            }
        } catch (error) {
            console.warn(
                '[Color Hunt] optional sniper helicopter audio unavailable',
                error,
            );
        }
    }

    /* V1010458B_REMOVE_UNUSED_SNIPER_CAMERA_TWEEN_STATE_SAFE: write-only camera tween field removed. */
    private startSniperWholeMapZoom(): void {
        if (
            !this.sniperActive ||
            this.phase !==
                'hunt'
        ) {
            return;
        }

        const camera =
            this.cameras.main;

        camera
            .stopFollow()
            .removeBounds()
            .setSize(
                this.gameWidth,
                this.gameHeight,
            );

        this.tweens.killTweensOf(
            camera,
        );

        const initialZoom =
            camera.zoom;

        const initialScrollX =
            camera.scrollX;

        const initialScrollY =
            camera.scrollY;

        const progress = {
            value:
                0,
        };

        /*
         * V1010459_SNIPER_INDEPENDENT_OVERWATCH
         * Explicit visual interpolation.
         * Normal camera-follow is disabled above, so nothing can steal this.
         */
        this.tweens.add({
            targets:
                progress,
            value:
                1,
            duration:
                1050,
            ease:
                'Sine.easeInOut',
            onUpdate:
                () => {
                    const t =
                        Phaser.Math.Clamp(
                            progress.value,
                            0,
                            1,
                        );

                    const zoom =
                        Phaser.Math.Linear(
                            initialZoom,
                            1,
                            t,
                        );

                    const scrollX =
                        Phaser.Math.Linear(
                            initialScrollX,
                            0,
                            t,
                        );

                    const scrollY =
                        Phaser.Math.Linear(
                            initialScrollY,
                            0,
                            t,
                        );

                    camera
                        .setZoom(
                            zoom,
                        )
                        .setScroll(
                            scrollX,
                            scrollY,
                        );

                    this.applyFixedHudForZoom(
                        zoom,
                    );
                },
            onComplete:
                () => {
                    if (
                        !this.sniperActive ||
                        this.phase !==
                            'hunt'
                    ) {
                        return;
                    }

                    camera
                        .stopFollow()
                        .removeBounds()
                        .setSize(
                            this.gameWidth,
                            this.gameHeight,
                        )
                        .setZoom(
                            1,
                        )
                        .setScroll(
                            0,
                            0,
                        );

                    this.applyFixedHudForZoom(
                        1,
                    );

                    /*
                     * Wait two render frames in the true full-map state before
                     * the scope racks into view.
                     */
                    this.time.delayedCall(
                        70,
                        () => {
                            if (
                                this.sniperActive &&
                                this.phase ===
                                    'hunt'
                            ) {
                                this.startSniperScopeRackIn();
                            }
                        },
                    );
                },
        });
    }

    private startSniperScopeRackIn(): void {
        /* V1010463_VICTORY_CAMERA_LOCK_SNIPER_INTRO_CHAT_FIX: rack-in owns the only visible scope until tween completion. */
        this.sniperScopeInteractive =
            false;
        this.sniperScopeRackInRunning =
            true;

        if (
            this.sniperScopeRackInBlackoutDom
        ) {
            this.sniperScopeRackInBlackoutDom
                .style.display =
                '';
        }

        /*
         * V1010455C_SNIPER_MOBILE_CONTROLS_PC_HELI_FLICKER_FIRE_PERF
         * Arrival shadow must never remain behind transparent scope-strip seams.
         */
        this.sniperHelicopter
            ?.setVisible(
                false,
            );

        this.sniperScopeStripCameras
            .forEach(
                (scopeCamera) => {
                    this.cameras.remove(
                        scopeCamera,
                        true,
                    );
                },
            );

        this.sniperScopeStripCameras =
            [];

        if (this.sniperScopeDom) {
            this.sniperScopeDom.style.display =
                'none';
        }

        if (this.sniperScopeClipDom) {
            this.sniperScopeClipDom.style.display =
                'none';
        }

        /*
         * V1010390_MOBILE_SNIPER_SINGLE_CAMERA_SMOOTH_ZOOM_BLUR
         * Mobile optic size restored. Performance comes from renderer cost,
         * not from shrinking the useful search area.
         */
        this.sniperScopeRadius =
            this.mobileControlsEnabled
                ? 194
                : 325;

        this.sniperScopeScreenX =
            this.gameWidth /
            2;

        this.sniperScopeScreenY =
            this.gameHeight +
            this.sniperScopeRadius +
            86;

        this.mobileSniperScopeDirty =
            true;

        this.createSniperScopeCamera();
        this.ensureSniperScopeDom();

        this.playProceduralSniperRack();

        this.sniperScopeIntroTween
            ?.stop();

        this.sniperScopeIntroTween =
            this.tweens.add({
                targets:
                    this as unknown as {
                        sniperScopeScreenY:
                            number;
                    },
                sniperScopeScreenY:
                    this.gameHeight /
                    2,
                duration:
                    520,
                ease:
                    'Back.easeOut',
                onUpdate:
                    () => {
                        this.drawLocalSniperScope(
                            this.sniperAimWorldX,
                            this.sniperAimWorldY,
                        );
                    },
                onComplete:
                    () => {
                        if (
                            !this.sniperActive ||
                            this.phase !==
                                'hunt'
                        ) {
                            return;
                        }

                        this.sniperScopeInteractive =
                            true;
                        this.sniperScopeRackInRunning =
                            false;

                        if (
                            this.sniperScopeRackInBlackoutDom
                        ) {
                            this.sniperScopeRackInBlackoutDom
                                .style.display =
                                'none';
                        }

                        if (
                            this.mobileControlsEnabled
                        ) {
                            this.sniperMobileHintHideAt =
                                Date.now() +
                                6_000;
                        }

                        if (
                            !this.mobileControlsEnabled
                        ) {
                            this.syncSniperScopeToPointer(
                                this.input
                                    .activePointer,
                                true,
                            );
                        } else {
                            this.drawLocalSniperScope(
                                this.sniperAimWorldX,
                                this.sniperAimWorldY,
                            );
                        }
                    },
            });
    }

    private exitSniperCinematic(): void {
        if (!this.sniperCinematicActive) return;
        this.sniperCinematicActive = false;
        this.sniperScopeInteractive = false;
        this.sniperHelicopterArrived = false;
        this.sniperScopeRackInRunning = false;

        if (
            this.sniperScopeRackInBlackoutDom
        ) {
            this.sniperScopeRackInBlackoutDom
                .style.display =
                'none';
        }

        this.mobileSniperAimX = 0;
        this.mobileSniperAimY = 0;
        this.mobileSniperTouchPointerId = -1;
        this.mobileSniperTouchTravel = 0;

        /*
         * V1010387_SNIPER_SCOPE_CLIP_AND_OUTSIDE_BLUR: remove the outside blur and clipped optical DOM immediately.
         */
        if (this.sniperScopeClipDom) {
            this.sniperScopeClipDom.style.display =
                'none';
        }

        if (this.sniperScopeBlurDom) {
            this.sniperScopeBlurDom.style.display =
                'none';
        }

        if (this.sniperPriorityTimerDom) {
            this.sniperPriorityTimerDom.style.display =
                'none';
        }

        if (this.sniperMobileHintDom) {
            this.sniperMobileHintDom.style.display =
                'none';
        }

        if (this.chatRoot) {
            this.chatRoot.style.pointerEvents =
                '';
            this.chatRoot.style.cursor =
                '';
            this.chatRoot.style.userSelect =
                '';
        }

        if (this.chatLog) {
            this.chatLog.style.pointerEvents =
                '';
            this.chatLog.style.cursor =
                '';
            this.chatLog.style.userSelect =
                '';
        }

        if (this.chatInput) {
            this.chatInput.style.pointerEvents =
                '';
            this.chatInput.style.cursor =
                '';
            this.chatInput.style.userSelect =
                '';
            this.chatInput.tabIndex =
                0;
        }

        if (this.chatSendButton) {
            this.chatSendButton.style.pointerEvents =
                '';
            this.chatSendButton.style.cursor =
                '';
            this.chatSendButton.tabIndex =
                0;
        }

        if (this.unifiedBgmButton) {
            this.unifiedBgmButton.style.pointerEvents = '';
            this.unifiedBgmButton.style.cursor = '';
            this.unifiedBgmButton.style.userSelect = '';
            this.unifiedBgmButton.tabIndex = 0;
        }

        if (this.controlsHelpRoot) {
            this.controlsHelpRoot.style.pointerEvents = '';
            this.controlsHelpRoot.style.cursor = '';
            this.controlsHelpRoot.style.userSelect = '';
        }

        if (this.controlsHelpButton) {
            this.controlsHelpButton.style.pointerEvents = '';
            this.controlsHelpButton.style.cursor = '';
            this.controlsHelpButton.style.userSelect = '';
            this.controlsHelpButton.tabIndex = 0;
        }

        this.sniperScopeStripCameras
            .forEach(
                (camera) => {
                    this.cameras.remove(
                        camera,
                        true,
                    );
                },
            );

        this.sniperScopeStripCameras =
            [];

        this.sniperScopeCornerMask
            ?.clear()
            .setVisible(false);


        this.networkPlayerManager
            ?.setLocalMovementHardLocked(
                false,
            );

        this.sniperScopeIntroTween?.stop();
        this.sniperScopeIntroTween = undefined;

        this.sniperHelicopterRotorTween?.stop();
        this.sniperHelicopterRotorTween = undefined;
        this.sniperHelicopter?.destroy(true);
        this.sniperHelicopter = undefined;

        if (this.sniperHelicopterSound?.isPlaying) {
            this.sniperHelicopterSound.stop();
        }

        this.sniperScope?.clear().setVisible(false);
        this.sniperScopeShade?.clear().setVisible(false);
        this.sniperReloadGraphics?.clear().setVisible(false);
        this.sniperScopeCornerMask?.clear().setVisible(false);

        if (this.sniperScopeDom) {
            this.sniperScopeDom.style.display =
                'none';
        }

        if (this.sniperScopeCamera) {
            this.cameras.remove(this.sniperScopeCamera);
            this.sniperScopeCamera = undefined;
        }
        this.sniperScopeMaskGraphics?.destroy();
        this.sniperScopeMaskGraphics = undefined;

        if (this.phase === 'hunt') {
            const camera = this.cameras.main;
            this.tweens.killTweensOf(camera);
            this.tweens.add({
                targets: camera,
                zoom: this.sniperSavedCameraZoom || 1.65,
                duration: 500,
                ease: 'Sine.easeInOut',
                onUpdate: () => this.applyFixedHudForZoom(camera.zoom),
            });
        }
    }

    /* V1010392C_FIX_CURRENT_BUILD_4_ERRORS */
    private startSniperTacticalBgm(): void {
        /*
         * V1010455L_FORCE_TACTICAL_BGM_TRANSITION
         * Set the global tactical state FIRST. If the network packet arrives
         * before browser audio unlock, unlockGameAudio()/syncPhaseMusic() can
         * still honor it later instead of losing the one activation event.
         */
        this.sniperTacticalBgmActive =
            true;

        if (
            !this.audioUnlocked ||
            !this.bgmEnabled
        ) {
            return;
        }

        this.huntMusic?.stop();
        this.paintMusic?.stop();
        this.lobbyMusic?.stop();
        this.backgroundMusic?.stop();

        if (this.sniperTacticalMusic) {
            if (
                this.sniperTacticalMusic.isPlaying
            ) {
                return;
            }

            /*
             * Force a clearly audible transition from the beginning instead of
             * inheriting any stale playback position.
             */
            this.sniperTacticalMusic.stop();
            this.sniperTacticalMusic.play();

            /*
             * V1010455M_CINEMATIC_WAR_TACTICAL_BGM_REMIX: start rotor after the music attack is established.
             */
        }

        this.startSniperHelicopterAudio();
    }

    private stopSniperTacticalBgm(
        restorePhaseMusic =
            true,
    ): void {
        this.sniperTacticalOscillators
            .forEach(
                (oscillator) => {
                    try {
                        oscillator.stop();
                    } catch {
                        // Already stopped.
                    }

                    try {
                        oscillator.disconnect();
                    } catch {
                        // Already disconnected.
                    }
                },
            );

        this.sniperTacticalOscillators =
            [];

        this.sniperTacticalAudioNodes
            .forEach(
                (node) => {
                    try {
                        node.disconnect();
                    } catch {
                        // Already disconnected.
                    }
                },
            );

        this.sniperTacticalAudioNodes =
            [];

        if (this.sniperHelicopterSound?.isPlaying) {
            this.sniperHelicopterSound.stop();
        }

        if (
            this.sniperTacticalMusic?.isPlaying
        ) {
            this.sniperTacticalMusic.stop();
        }

        const wasActive =
            this.sniperTacticalBgmActive;

        this.sniperTacticalBgmActive =
            false;

        if (
            restorePhaseMusic &&
            wasActive &&
            this.phase === 'hunt' &&
            this.bgmEnabled
        ) {
            this.syncPhaseMusic();
        }
    }

    private playProceduralSniperShot(): void {
        /*
         * V1010457_SNIPER_FINAL_FLOW_REWORK
         * Layer the recorded shotgun transient at a low rate underneath the
         * synthesized crack/boom. It reads much heavier than the normal shotgun.
         */
        try {
            this.sound.play(
                'shotgun-blast',
                {
                    volume:
                        0.98,
                    rate:
                        0.58,
                    detune:
                        -180,
                },
            );
        } catch {
            // Recorded layer is optional.
        }

        try {
            const manager =
                this.sound as unknown as {
                    context?: AudioContext;
                };

            const context =
                manager.context;

            if (!context) {
                return;
            }

            const now =
                context.currentTime;

            const master =
                context.createGain();

            master.gain
                .setValueAtTime(
                    0.0001,
                    now,
                );

            master.gain
                .exponentialRampToValueAtTime(
                    0.95,
                    now + 0.003,
                );

            master.gain
                .exponentialRampToValueAtTime(
                    0.0001,
                    now + 0.48,
                );

            master.connect(
                context.destination,
            );

            const crack =
                context.createOscillator();

            crack.type =
                'square';

            crack.frequency
                .setValueAtTime(
                    920,
                    now,
                );

            crack.frequency
                .exponentialRampToValueAtTime(
                    190,
                    now + 0.075,
                );

            crack.connect(
                master,
            );

            crack.start(
                now,
            );

            crack.stop(
                now + 0.09,
            );

            const boom =
                context.createOscillator();

            boom.type =
                'sine';

            boom.frequency
                .setValueAtTime(
                    108,
                    now,
                );

            boom.frequency
                .exponentialRampToValueAtTime(
                    42,
                    now + 0.30,
                );

            boom.connect(
                master,
            );

            boom.start(
                now,
            );

            boom.stop(
                now + 0.34,
            );

            const buffer =
                context.createBuffer(
                    1,
                    Math.floor(
                        context.sampleRate *
                        0.19,
                    ),
                    context.sampleRate,
                );

            const data =
                buffer.getChannelData(
                    0,
                );

            for (
                let i = 0;
                i < data.length;
                i += 1
            ) {
                const t =
                    i /
                    data.length;

                data[i] =
                    (
                        Math.random() *
                        2 -
                        1
                    ) *
                    Math.pow(
                        1 - t,
                        2.8,
                    );
            }

            const noise =
                context.createBufferSource();

            noise.buffer =
                buffer;
            noise.connect(
                master,
            );
            noise.start(
                now,
            );
        } catch {
            // Sniper punch SFX is optional.
        }
    }

    private playProceduralSniperRack(): void {
        try {
            const manager =
                this.sound as unknown as {
                    context?: AudioContext;
                };

            const context =
                manager.context;

            if (!context) {
                return;
            }

            const now =
                context.currentTime;

            const gain =
                context.createGain();

            gain.gain
                .setValueAtTime(
                    0.0001,
                    now,
                );

            gain.gain
                .exponentialRampToValueAtTime(
                    0.48,
                    now + 0.004,
                );

            gain.gain
                .exponentialRampToValueAtTime(
                    0.0001,
                    now + 0.20,
                );

            gain.connect(
                context.destination,
            );

            const metal =
                context.createOscillator();

            metal.type =
                'square';

            metal.frequency
                .setValueAtTime(
                    760,
                    now,
                );

            metal.frequency
                .exponentialRampToValueAtTime(
                    210,
                    now + 0.12,
                );

            metal.connect(
                gain,
            );
            metal.start(
                now,
            );
            metal.stop(
                now + 0.14,
            );

            const click =
                context.createOscillator();

            click.type =
                'triangle';

            click.frequency
                .setValueAtTime(
                    1250,
                    now + 0.055,
                );

            click.frequency
                .exponentialRampToValueAtTime(
                    460,
                    now + 0.15,
                );

            click.connect(
                gain,
            );

            click.start(
                now + 0.055,
            );

            click.stop(
                now + 0.17,
            );
        } catch {
            // Mechanical reload SFX is optional.
        }
    }

    private createSniperHelicopter(): void {
        if (
            this.sniperHelicopter
        ) {
            return;
        }

        const shadow =
            0x020609;

        /*
         * V1010457_SNIPER_FINAL_FLOW_REWORK
         * Top-down silhouette: nose at top, fuselage/tail vertical,
         * landing stubs and a large spinning rotor cross.
         */
        const fuselage =
            this.add.ellipse(
                0,
                -4,
                38,
                82,
                shadow,
                0.50,
            );

        const cockpit =
            this.add.ellipse(
                0,
                -28,
                29,
                31,
                shadow,
                0.60,
            );

        const tailBoom =
            this.add.rectangle(
                0,
                54,
                12,
                67,
                shadow,
                0.46,
            );

        const tailFinLeft =
            this.add.triangle(
                -1,
                83,
                0,
                0,
                -24,
                17,
                -3,
                19,
                shadow,
                0.48,
            );

        const tailFinRight =
            this.add.triangle(
                1,
                83,
                0,
                0,
                24,
                17,
                3,
                19,
                shadow,
                0.48,
            );

        const skidLeft =
            this.add.rectangle(
                -25,
                6,
                6,
                61,
                shadow,
                0.36,
            );

        const skidRight =
            this.add.rectangle(
                25,
                6,
                6,
                61,
                shadow,
                0.36,
            );

        const rotorHorizontal =
            this.add.rectangle(
                0,
                0,
                150,
                5,
                shadow,
                0.44,
            );

        const rotorVertical =
            this.add.rectangle(
                0,
                0,
                5,
                150,
                shadow,
                0.34,
            );

        const rotorHub =
            this.add.circle(
                0,
                0,
                8,
                shadow,
                0.58,
            );

        const rotorGroup =
            this.add.container(
                0,
                -8,
                [
                    rotorHorizontal,
                    rotorVertical,
                    rotorHub,
                ],
            );

        const tailRotor =
            this.add.container(
                0,
                88,
                [
                    this.add.rectangle(
                        0,
                        0,
                        34,
                        3,
                        shadow,
                        0.42,
                    ),
                    this.add.rectangle(
                        0,
                        0,
                        3,
                        34,
                        shadow,
                        0.32,
                    ),
                ],
            );

        const heli =
            this.add.container(
                0,
                0,
                [
                    tailBoom,
                    tailFinLeft,
                    tailFinRight,
                    skidLeft,
                    skidRight,
                    fuselage,
                    cockpit,
                    rotorGroup,
                    tailRotor,
                ],
            )
                .setDepth(1200)
                .setAlpha(0.72)
                /* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: same helicopter, twice the former presence for both support modes. */
                .setScale(1.288);

        this.sniperHelicopter =
            heli;

        this.sniperHelicopterRotorTween =
            this.tweens.add({
                targets:
                    rotorGroup,
                angle:
                    360,
                duration:
                    170,
                repeat:
                    -1,
            });

        this.tweens.add({
            targets:
                tailRotor,
            angle:
                -360,
            duration:
                105,
            repeat:
                -1,
        });
    }

    private createSniperScopeCamera(): void {
        if (
            this.sniperScopeStripCameras.length >
            0
        ) {
            return;
        }

        const radius =
            this.getActiveSniperScopeRadius();

        /*
         * V1010390_MOBILE_SNIPER_SINGLE_CAMERA_SMOOTH_ZOOM_BLUR
         * Each Phaser camera is another scene render pass.
         * Mobile now uses ONE magnification camera; desktop keeps 32 strips.
         */
        /*
         * V1010391C_MOBILE_SCOPE_CLEAR_CIRCLE_UI_HOLES
         * Mobile: 5 chord strips = circular-looking lens without returning to
         * the expensive old 10/32-camera path.
         */
        /* V1010392_SNIPER_MOBILE_THERMAL_AUDIO_BLUR_INTRO_BUTTON: mobile thermal pass, one fewer full scene render. */
        const stripCount =
            this.mobileControlsEnabled
                ? 4
                : 32;

        const scopeZoom =
            this.mobileControlsEnabled
                ? 3.35
                : 2.7;

        for (
            let index = 0;
            index < stripCount;
            index += 1
        ) {
            const y0 =
                -radius +
                (
                    index /
                    stripCount
                ) *
                    radius *
                    2;

            const y1 =
                -radius +
                (
                    (index + 1) /
                    stripCount
                ) *
                    radius *
                    2;

            const midY =
                (
                    y0 +
                    y1
                ) /
                2;

            const halfChord =
                Math.sqrt(
                    Math.max(
                        0,
                        radius *
                            radius -
                            midY *
                                midY,
                    ),
                );

            const stripHeight =
                Math.ceil(
                    y1 -
                    y0,
                ) +
                1;

            const stripWidth =
                Math.max(
                    2,
                    Math.ceil(
                        halfChord *
                            2,
                    ),
                );

            const camera =
                this.cameras.add(
                    this.sniperScopeScreenX -
                        halfChord,
                    this.sniperScopeScreenY +
                        y0,
                    stripWidth,
                    stripHeight,
                    false,
                    'sniper-overwatch-strip-' +
                        String(index),
                );

            camera
                .setZoom(
                    scopeZoom,
                )
                .centerOn(
                    this.sniperAimWorldX,
                    this.sniperAimWorldY +
                        midY /
                            scopeZoom,
                )
                .setBackgroundColor(
                    'rgba(0,0,0,0)',
                );

            [
                this.sniperButton,
                this.sniperRadioText,
                this.sniperScope,
                this.sniperScopeShade,
                this.sniperReloadGraphics,
                this.sniperScopeCornerMask,
                this.sniperHelicopter,
                this.timerText,
                this.phaseText,
                this.guideText,
                this.statusText,
                this.hunterWeaponHudContainer,
                this.fartHudContainer,
                this.mobileMoveBase,
                this.mobileMoveKnob,
                this.mobileMoveLabel,
                this.mobileAimBase,
                this.mobileAimKnob,
                this.mobileAimLabel,
                this.mobileFireButton,
                this.mobileFireLabel,
            ].forEach(
                (object) => {
                    if (object) {
                        camera.ignore(object);
                    }
                },
            );

            /*
             * V1010455B_SNIPER_PC_MOBILE_RENDER_SPLIT_SAFE: exclude helicopter shadow/rotor child objects too.
             */
            if (this.sniperHelicopter) {
                camera.ignore(
                    this.sniperHelicopter
                        .list,
                );
            }

            this.sniperScopeStripCameras.push(
                camera,
            );
        }

        /*
         * Compatibility only: old single-camera/corner-cover path is disabled.
         */
        if (this.sniperScopeCamera) {
            this.cameras.remove(
                this.sniperScopeCamera,
                true,
            );
            this.sniperScopeCamera =
                undefined;
        }

        this.sniperScopeCornerMask
            ?.clear()
            .setVisible(false);
    

        /*
         * V1010501G2_SCOPE_CAMERA_PREHIDE
         * Keep the magnified camera hidden until drawLocalSniperScope()
         * has finished drawing the outside treatment + reticle.
         */
        (
            this.sniperScopeCamera as
                Phaser.Cameras.Scene2D.Camera | undefined
        )
            ?.setVisible(false);
}

    private ensureSniperScopeDom(): void {
        if (
            this.sniperScopeDom
        ) {
            return;
        }

        if (
            typeof document ===
            'undefined'
        ) {
            return;
        }

        /*
         * V1010387_SNIPER_SCOPE_CLIP_AND_OUTSIDE_BLUR
         * Scope DOM now lives inside a container matching the Phaser canvas.
         * overflow:hidden guarantees the optical body never leaks outside the
         * actual game window even when its center reaches an edge.
         */
        const clipRoot =
            document.createElement(
                'div',
            );

        Object.assign(
            clipRoot.style,
            {
                position:
                    'fixed',
                zIndex:
                    '2147482500',
                pointerEvents:
                    'none',
                overflow:
                    'hidden',
                display:
                    'none',
                margin:
                    '0',
                padding:
                    '0',
                border:
                    '0',
                background:
                    'transparent',
                contain:
                    'layout paint style',
            },
        );

        /*
         * One masked backdrop layer:
         * - outside scope = blurred/dimmed
         * - circular hole = untouched/sharp Phaser scope camera
         */
        const blurLayer =
            document.createElement(
                'div',
            );

        Object.assign(
            blurLayer.style,
            {
                position:
                    'absolute',
                inset:
                    '0',
                zIndex:
                    '0',
                pointerEvents:
                    'none',
                /*
                 * V1010389_MOBILE_SNIPER_PERFORMANCE_CONTROLS
                 * Full-screen backdrop blur + moving mask is extremely expensive
                 * on mobile GPUs. Mobile uses a cheap tactical dim; desktop keeps
                 * the full optical blur.
                 */
                /*
                 * V1010390_MOBILE_SNIPER_SINGLE_CAMERA_SMOOTH_ZOOM_BLUR
                 * Mobile gets a real lightweight blur again. The major win is
                 * 10 -> 1 extra scene render, so a 2px tactical blur is affordable.
                 */
                /*
                 * V1010455B_SNIPER_PC_MOBILE_RENDER_SPLIT_SAFE: separate platform cost/appearance.
                 */
                backdropFilter:
                    this.mobileControlsEnabled
                        ? 'blur(3px) brightness(0.70) saturate(0.80)'
                        : 'blur(7px) brightness(0.70) saturate(0.78)',
                webkitBackdropFilter:
                    this.mobileControlsEnabled
                        ? 'blur(3px) brightness(0.70) saturate(0.80)'
                        : 'blur(7px) brightness(0.70) saturate(0.78)',
                background:
                    this.mobileControlsEnabled
                        ? 'rgba(2,8,10,0.07)'
                        : 'rgba(2,8,10,0.08)',
                maskRepeat:
                    'no-repeat',
                webkitMaskRepeat:
                    'no-repeat',
                /*
                 * V1010506_PC_SNIPER_BLUR_COMPOSITOR_STABILIZE
                 * PC Chrome compositor stabilization:
                 * keep the moving masked backdrop blur on a dedicated layer.
                 *
                 * This changes ONLY browser compositing hints.
                 * No scope radius / X/Y / mask geometry / camera / rack-in /
                 * aim / fire logic is touched.
                 */
                transform:
                    'translate3d(0,0,0)',
                transformOrigin:
                    '0 0',
                backfaceVisibility:
                    'hidden',
                webkitBackfaceVisibility:
                    'hidden',
                willChange:
                    'backdrop-filter, -webkit-backdrop-filter, mask-image, -webkit-mask-image',
            },
        );

        const lensShield =
            document.createElement(
                'div',
            );

        Object.assign(
            lensShield.style,
            {
                position: 'absolute',
                zIndex: '1',
                display: 'none',
                pointerEvents: 'none',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'transparent',
                backdropFilter: 'none',
                webkitBackdropFilter: 'none',
                isolation: 'isolate',
                contain: 'paint',
            },
        );

        const scope =
            document.createElement(
                'div',
            );

        Object.assign(
            scope.style,
            {
                position:
                    'absolute',
                zIndex:
                    '2',
                pointerEvents:
                    'none',
                display:
                    'none',
                borderRadius:
                    '50%',
                boxSizing:
                    'border-box',
                border:
                    '10px solid rgba(4,8,10,.99)',
                boxShadow:
                    [
                        '0 0 0 3px rgba(126,151,139,.92)',
                        '0 0 0 7px rgba(8,14,16,.98)',
                        '0 0 0 9px rgba(180,204,192,.42)',
                        'inset 0 0 0 2px rgba(187,213,200,.35)',
                        'inset 0 0 34px rgba(0,0,0,.62)',
                        '0 10px 28px rgba(0,0,0,.42)',
                    ].join(', '),
                background:
                    'transparent',
            },
        );

        /*
         * V1010455J_BLACKOUT_SCOPE_DURING_RACK_IN
         * While the optic racks in, never expose magnified world pixels.
         * Hiders must not be revealed before the scope is actually usable.
         */
        const rackInBlackout =
            document.createElement(
                'div',
            );

        Object.assign(
            rackInBlackout.style,
            {
                position: 'absolute',
                inset: '0',
                zIndex: '1',
                display: 'none',
                pointerEvents: 'none',
                borderRadius: '50%',
                background: '#000000',
            },
        );

        const crossV =
            document.createElement(
                'div',
            );

        Object.assign(
            crossV.style,
            {
                position:
                    'absolute',
                left:
                    'calc(50% - 1px)',
                top:
                    '7%',
                width:
                    '2px',
                height:
                    '86%',
                background:
                    'rgba(240,250,255,.90)',
            },
        );

        const crossH =
            document.createElement(
                'div',
            );

        Object.assign(
            crossH.style,
            {
                position:
                    'absolute',
                left:
                    '7%',
                top:
                    'calc(50% - 1px)',
                width:
                    '86%',
                height:
                    '2px',
                background:
                    'rgba(240,250,255,.90)',
            },
        );

        /*
         * V1010462_SNIPER_SCOPE_POLISH_VICTORY_SCALE_RESTORE
         * Four chunky optic index marks make this read as a weapon scope,
         * rather than a generic circular magnifier.
         */
        [
            {
                left: '50%',
                top: '-15px',
                width: '6px',
                height: '20px',
                transform: 'translateX(-50%)',
            },
            {
                left: '50%',
                bottom: '-15px',
                width: '6px',
                height: '20px',
                transform: 'translateX(-50%)',
            },
            {
                left: '-15px',
                top: '50%',
                width: '20px',
                height: '6px',
                transform: 'translateY(-50%)',
            },
            {
                right: '-15px',
                top: '50%',
                width: '20px',
                height: '6px',
                transform: 'translateY(-50%)',
            },
        ].forEach(
            (spec) => {
                const notch =
                    document.createElement(
                        'div',
                    );

                Object.assign(
                    notch.style,
                    {
                        position:
                            'absolute',
                        borderRadius:
                            '2px',
                        background:
                            'rgba(9,16,18,.99)',
                        boxShadow:
                            '0 0 0 2px rgba(157,184,170,.62)',
                        ...spec,
                    },
                );

                scope.appendChild(
                    notch,
                );
            },
        );

        const reloadTrack =
            document.createElement(
                'div',
            );

        Object.assign(
            reloadTrack.style,
            {
                position:
                    'absolute',
                right:
                    '-38px',
                top:
                    '25%',
                width:
                    '17px',
                height:
                    '50%',
                borderRadius:
                    '9px',
                overflow:
                    'hidden',
                border:
                    '3px solid rgba(7,13,15,.98)',
                boxShadow:
                    '0 0 0 2px rgba(184,207,195,.52), 0 3px 10px rgba(0,0,0,.48)',
                background:
                    'rgba(6,12,14,.94)',
            },
        );

        const reload =
            document.createElement(
                'div',
            );

        Object.assign(
            reload.style,
            {
                width:
                    '100%',
                height:
                    '100%',
                transformOrigin:
                    'center bottom',
                transform:
                    'scaleY(1)',
                background:
                    'linear-gradient(0deg,#d17a2f 0%,#ffbb55 48%,#ffe6a7 100%)',
            },
        );

        reloadTrack.appendChild(
            reload,
        );

        scope.appendChild(
            rackInBlackout,
        );

        scope.appendChild(
            crossV,
        );
        scope.appendChild(
            crossH,
        );
        scope.appendChild(
            reloadTrack,
        );

        const priorityTimer =
            document.createElement(
                'div',
            );

        Object.assign(
            priorityTimer.style,
            {
                position: 'absolute',
                left: '50%',
                top: '70px',
                transform: 'translateX(-50%)',
                zIndex: '5',
                display: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                minWidth: '74px',
                padding: '7px 13px',
                border: '2px solid rgba(217,238,226,.82)',
                borderRadius: '8px',
                background: 'rgba(5,13,17,.92)',
                color: '#f6fff8',
                fontFamily: '"Arial Black","Noto Sans KR",Arial,sans-serif',
                fontSize: '17px',
                fontWeight: '900',
                lineHeight: '1',
                textAlign: 'center',
                textShadow: '0 2px 3px rgba(0,0,0,.85)',
                boxShadow: '0 4px 14px rgba(0,0,0,.40)',
            },
        );

        clipRoot.appendChild(
            blurLayer,
        );

        clipRoot.appendChild(
            lensShield,
        );

        clipRoot.appendChild(
            scope,
        );

        /*
         * V1010391B_RESTORE_ORIGINAL_MOBILE_SNIPER_CONTROLS_I18N
         * No duplicate AIM/FIRE art. Blur mask exposes original Phaser controls.
         */
        const mobileHint =
            document.createElement(
                'div',
            );

        Object.assign(
            mobileHint.style,
            {
                position: 'absolute',
                zIndex: '8',
                display: 'none',
                pointerEvents: 'none',
                userSelect: 'none',
                left: '50%',
                bottom: '10px',
                transform: 'translateX(-50%)',
                width: 'min(88%, 560px)',
                maxWidth: '88%',
                padding: '8px 13px',
                border: '1px solid rgba(220,245,232,.80)',
                borderRadius: '10px',
                background: 'rgba(4,12,15,.90)',
                color: '#f4fff8',
                fontFamily: '"Noto Sans KR","Noto Sans JP",Arial,sans-serif',
                fontSize: '12px',
                fontWeight: '800',
                lineHeight: '1.35',
                textAlign: 'center',
                whiteSpace: 'pre-line',
                textShadow: '0 1px 3px rgba(0,0,0,.9)',
                boxShadow: '0 4px 14px rgba(0,0,0,.30)',
            },
        );

        clipRoot.appendChild(
            priorityTimer,
        );

        clipRoot.appendChild(
            mobileHint,
        );

        document.body.appendChild(
            clipRoot,
        );

        this.sniperScopeClipDom =
            clipRoot;

        this.sniperScopeBlurDom =
            blurLayer;

        this.sniperScopeLensShieldDom =
            lensShield;

        this.sniperScopeRackInBlackoutDom =
            rackInBlackout;

        this.sniperPriorityTimerDom =
            priorityTimer;

        this.sniperMobileHintDom =
            mobileHint;

        this.sniperScopeDom =
            scope;

        this.sniperScopeReloadDom =
            reload;

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.sniperScopeClipDom
                    ?.remove();

                this.sniperScopeClipDom =
                    undefined;

                this.sniperScopeBlurDom =
                    undefined;

                this.sniperScopeLensShieldDom =
                    undefined;

                this.sniperScopeRackInBlackoutDom =
                    undefined;

                this.sniperPriorityTimerDom =
                    undefined;

                this.sniperMobileHintDom =
                    undefined;

                this.sniperScopeDom =
                    undefined;

                this.sniperScopeReloadDom =
                    undefined;
            },
        );
    }

    private syncSniperScopeDom(): void {
        const scope =
            this.sniperScopeDom;

        if (
            !scope ||
            !this.sniperCinematicActive
        ) {
            return;
        }

        if (
            this.sniperActive &&
            !this.sniperScopeInteractive &&
            !this.sniperScopeRackInRunning
        ) {
            if (this.sniperScopeDom) this.sniperScopeDom.style.display = 'none';
            if (this.sniperScopeClipDom) this.sniperScopeClipDom.style.display = 'none';
            return;
        }

        const rect =
            this.game.canvas
                .getBoundingClientRect();

        const sx =
            rect.width /
            this.gameWidth;

        const sy =
            rect.height /
            this.gameHeight;

        const activeScopeRadius =
            this.getActiveSniperScopeRadius();

        const diameter =
            activeScopeRadius *
            2;

        const clipRoot =
            this.sniperScopeClipDom;

        const blurLayer =
            this.sniperScopeBlurDom;

        if (clipRoot) {
            clipRoot.style.display =
                '';

            clipRoot.style.left =
                String(
                    Math.round(
                        rect.left,
                    ),
                ) +
                'px';

            clipRoot.style.top =
                String(
                    Math.round(
                        rect.top,
                    ),
                ) +
                'px';

            clipRoot.style.width =
                String(
                    Math.round(
                        rect.width,
                    ),
                ) +
                'px';

            clipRoot.style.height =
                String(
                    Math.round(
                        rect.height,
                    ),
                ) +
                'px';
        }

        scope.style.display =
            '';

        if (
            this.sniperScopeRackInBlackoutDom
        ) {
            this.sniperScopeRackInBlackoutDom
                .style.display =
                (
                    this.sniperScopeRackInRunning ||
                    !this.sniperScopeInteractive
                )
                    ? ''
                    : 'none';
        }

        /*
         * Scope is now positioned RELATIVE to the clipped canvas root.
         */
        /*
         * V1010455H_FIX_DESKTOP_SCOPE_ALIGNMENT_RESTORE_SUPPORT_BUTTON
         * Ring / magnified lens / blur hole all share activeScopeRadius.
         */
        scope.style.left =
            String(
                Math.round(
                    (
                        this.sniperScopeScreenX -
                        activeScopeRadius
                    ) *
                        sx,
                ),
            ) +
            'px';

        scope.style.top =
            String(
                Math.round(
                    (
                        this.sniperScopeScreenY -
                        activeScopeRadius
                    ) *
                        sy,
                ),
            ) +
            'px';

        /* V1010391B_RESTORE_ORIGINAL_MOBILE_SNIPER_CONTROLS_I18N: original Phaser controls are exposed through blur holes. */
        if (this.sniperMobileHintDom) {
            const lang =
                getLanguage();

            this.sniperMobileHintDom.textContent =
                lang === 'ja'
                    ? '画面をドラッグして照準移動\n画面をタップして射撃'
                    : lang === 'en'
                        ? 'Drag the screen to aim\nTap the screen to fire'
                        : lang === 'zh'
                            ? '拖动画面移动准星\n点击画面射击'
                            : '화면을 드래그해 조준\n화면을 터치해 발사';

            this.sniperMobileHintDom.style.display =
                this.mobileControlsEnabled &&
                this.sniperActive &&
                this.phase === 'hunt' &&
                Date.now() <
                    this.sniperMobileHintHideAt
                    ? ''
                    : 'none';
        }

        if (this.sniperPriorityTimerDom) {
            const remainingSeconds =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            this.phaseEndTime -
                            this.time.now
                        ) /
                            1000,
                    ),
                );

            this.sniperPriorityTimerDom.textContent =
                '⏱ ' +
                String(
                    remainingSeconds,
                ) +
                's';

            this.sniperPriorityTimerDom.style.display =
                this.phase === 'hunt'
                    ? ''
                    : 'none';

            this.sniperPriorityTimerDom.style.color =
                remainingSeconds <= 5
                    ? '#ff7878'
                    : '#f6fff8';
        }

        if (blurLayer) {
            /*
             * V1010505_SECOND_ROUND_SNIPER_BLUR_LIFECYCLE
             * exitSniperCinematic() intentionally hides this reusable DOM node.
             * Re-arm ONLY its visibility when the active scope sync resumes.
             *
             * No mask/radius/camera/rack-in behavior changes.
             */
            blurLayer.style.display =
                '';

            const holeX =
                this.sniperScopeScreenX *
                sx;

            const holeY =
                this.sniperScopeScreenY *
                sy;

            /*
             * Include the heavy rifle-optic rim in the clear hole so blur never
             * muddies the edge of the scope itself.
             */
            /*
             * V1010391C_MOBILE_SCOPE_CLEAR_CIRCLE_UI_HOLES: only the optical lens is sharp.
             * The metal rim stays above blur via DOM; no oversized clear halo.
             */
            const holeRadius =
                activeScopeRadius *
                    Math.min(
                        sx,
                        sy,
                    ) -
                11;

            /* V1010392H_REMOVE_UNUSED_FEATHER: feather removed after desktop mask cleanup. */

            /* V1010392D_REMOVE_UNUSED_MASK_DECLARATION: branch-local mask assignments no longer need a shared variable. */

            /*
             * V1010455B_SNIPER_PC_MOBILE_RENDER_SPLIT_SAFE
             *
             * Platform split:
             * MOBILE -> one simple radial mask; reliable on Android Chrome.
             * DESKTOP -> one simple radial mask; never blur inside the optic.
             */
            const safeHoleRadius =
                Math.max(
                    8,
                    holeRadius -
                        (
                            this.mobileControlsEnabled
                                ? 2
                                : 0
                        ),
                );

            /*
             * V1010455E_MOBILE_SNIPER_SCOPE_ALPHA_HOLE
             * Explicit alpha mask:
             *   rgba(...,0) = completely remove backdrop blur in the lens
             *   rgba(...,1) = keep backdrop blur outside the lens
             */
            const scopeHoleMask =
                'radial-gradient(circle at ' +
                String(
                    Math.round(
                        holeX,
                    ),
                ) +
                'px ' +
                String(
                    Math.round(
                        holeY,
                    ),
                ) +
                'px, rgba(0,0,0,0) 0 ' +
                String(
                    Math.round(
                        safeHoleRadius,
                    ),
                ) +
                'px, rgba(0,0,0,0) ' +
                String(
                    Math.round(
                        safeHoleRadius +
                            1,
                    ),
                ) +
                'px, rgba(0,0,0,1) ' +
                String(
                    Math.round(
                        safeHoleRadius +
                            2,
                    ),
                ) +
                'px 100%)';

            /*
             * V1010455F_DESKTOP_BLUR_AND_SAFE_SUPPORT_BUTTON
             * Keep platform mask behavior separate.
             *
             * MOBILE:
             *   explicit alpha-hole semantics from 455e
             *
             * DESKTOP:
             *   simple radial mask; no mobile WebKit alpha-source overrides
             *   so backdrop blur remains visible outside the optic.
             */
            if (this.mobileControlsEnabled) {
                blurLayer.style.maskImage =
                    scopeHoleMask;

                blurLayer.style.webkitMaskImage =
                    scopeHoleMask;

                blurLayer.style.setProperty(
                    'mask-mode',
                    'alpha',
                );

                blurLayer.style.setProperty(
                    '-webkit-mask-source-type',
                    'alpha',
                );
            } else {
                const desktopScopeHoleMask =
                    'radial-gradient(circle at ' +
                    String(
                        Math.round(
                            holeX,
                        ),
                    ) +
                    'px ' +
                    String(
                        Math.round(
                            holeY,
                        ),
                    ) +
                    'px, transparent 0 ' +
                    String(
                        Math.round(
                            safeHoleRadius,
                        ),
                    ) +
                    'px, transparent ' +
                    String(
                        Math.round(
                            safeHoleRadius +
                                1,
                        ),
                    ) +
                    'px, #fff ' +
                    String(
                        Math.round(
                            safeHoleRadius +
                                3,
                        ),
                    ) +
                    'px 100%)';

                blurLayer.style.maskImage =
                    desktopScopeHoleMask;

                blurLayer.style.webkitMaskImage =
                    desktopScopeHoleMask;

                blurLayer.style.removeProperty(
                    'mask-mode',
                );

                blurLayer.style.removeProperty(
                    '-webkit-mask-source-type',
                );
            }

            blurLayer.style.maskComposite =
                '';

            blurLayer.style.webkitMaskComposite =
                '';

            blurLayer.style.maskSize =
                '100% 100%';

            blurLayer.style.webkitMaskSize =
                '100% 100%';

            blurLayer.style.maskPosition =
                '0 0';

            blurLayer.style.webkitMaskPosition =
                '0 0';

            /*
             * V1010455G_MOBILE_TOUCH_ONLY_SCOPE_CLARITY_PC_SCOPE_SIZE
             * No mobile AIM/FIRE widgets exist in Overwatch now, so the blur
             * layer no longer needs a right-side control notch.
             */
            blurLayer.style.clipPath =
                'none';

            blurLayer.style.setProperty(
                '-webkit-clip-path',
                'none',
            );

            /* V1010392C_FIX_CURRENT_BUILD_4_ERRORS: mobile/desktop branches already assign maskImage. */
        }

        if (this.sniperScopeLensShieldDom) {
            const shield =
                this.sniperScopeLensShieldDom;

            shield.style.display =
                this.mobileControlsEnabled
                    ? ''
                    : 'none';

            shield.style.left =
                String(
                    Math.round(
                        (
                            this.sniperScopeScreenX -
                            activeScopeRadius
                        ) *
                        sx,
                    ),
                ) +
                'px';

            shield.style.top =
                String(
                    Math.round(
                        (
                            this.sniperScopeScreenY -
                            activeScopeRadius
                        ) *
                        sy,
                    ),
                ) +
                'px';

            shield.style.width =
                String(
                    Math.round(
                        diameter *
                        sx,
                    ),
                ) +
                'px';

            shield.style.height =
                String(
                    Math.round(
                        diameter *
                        sy,
                    ),
                ) +
                'px';
        }

        scope.style.width =
            String(
                Math.round(
                    diameter *
                    sx,
                ),
            ) +
            'px';

        scope.style.height =
            String(
                Math.round(
                    diameter *
                    sy,
                ),
            ) +
            'px';

        const remain =
            Math.max(
                0,
                this.sniperReadyAt -
                Date.now(),
            );

        const ready =
            Phaser.Math.Clamp(
                1 -
                    remain /
                        2000,
                0,
                1,
            );

        if (
            this.sniperScopeReloadDom
        ) {
            this.sniperScopeReloadDom
                .style.transform =
                'scaleY(' +
                String(
                    ready,
                ) +
                ')';
        }
    }

    private drawLocalSniperScope(
        x: number,
        y: number,
    ): void {
        /*
         * V1010501G4_HIDE_CLEAR_CIRCLE_UNTIL_SCOPE_INTERACTIVE / PRE_SCOPE_CLEAR_CIRCLE_KILL
         */
        if (!this.sniperScopeInteractive) {
            (
                this.sniperScopeCamera as
                    Phaser.Cameras.Scene2D.Camera | undefined
            )
                ?.setVisible(false);
        }

        if (
            !this.sniperActive ||
            !this.sniperCinematicActive
        ) {
            return;
        }

        /*
         * V1010501H_RESTORE_EXACT_491_PRE_RACK_STRIP_GATE
         * Restore the previously working v491 lifecycle gate exactly:
         *
         * Before physical rack-in:
         *   - DO NOT create/render magnification strip cameras
         *   - hide stale strip cameras
         *   - hide optical scope UI
         *   - return
         *
         * During rack-in / once interactive:
         *   - existing renderer continues unchanged
         *
         * This is the exact bug shown in the video:
         * a borderless sharp circular/moving magnified patch appeared before
         * the physical scope because the strip cameras rendered too early.
         */
        const opticRendererAllowed =
            this.sniperScopeRackInRunning ||
            this.sniperScopeInteractive;

        if (!opticRendererAllowed) {
            this.sniperScopeStripCameras
                .forEach(
                    (scopeCamera) => {
                        scopeCamera.visible =
                            false;
                    },
                );

            this.sniperScope
                ?.clear()
                .setVisible(false);

            this.sniperScopeShade
                ?.clear()
                .setVisible(false);

            this.sniperReloadGraphics
                ?.clear()
                .setVisible(false);

            if (this.sniperScopeDom) {
                this.sniperScopeDom.style.display =
                    'none';
            }

            return;
        }

        if (
            this.sniperScopeStripCameras.length ===
            0
        ) {
            this.createSniperScopeCamera();
        }

        const radius =
            this.getActiveSniperScopeRadius();

        const stripCount =
            this.sniperScopeStripCameras.length;

        const scopeZoom =
            this.mobileControlsEnabled
                ? 3.35
                : 2.7;

        this.sniperScopeStripCameras
            .forEach(
                (
                    camera,
                    index,
                ) => {
                    const y0 =
                        -radius +
                        (
                            index /
                            stripCount
                        ) *
                            radius *
                            2;

                    const y1 =
                        -radius +
                        (
                            (index + 1) /
                            stripCount
                        ) *
                            radius *
                            2;

                    const midY =
                        (
                            y0 +
                            y1
                        ) /
                            2;

                    const halfChord =
                        Math.sqrt(
                            Math.max(
                                0,
                                radius *
                                    radius -
                                    midY *
                                        midY,
                            ),
                        );

                    camera
                        .setViewport(
                            this.sniperScopeScreenX -
                                halfChord,
                            this.sniperScopeScreenY +
                                y0,
                            Math.max(
                                2,
                                Math.ceil(
                                    halfChord *
                                        2,
                                ),
                            ),
                            Math.ceil(
                                y1 -
                                    y0,
                            ) +
                                1,
                        )
                        .centerOn(
                            x,
                            y +
                                midY /
                                    scopeZoom,
                        );
                },
            );

        this.sniperScopeCornerMask
            ?.clear()
            .setVisible(false);

        this.syncSniperScopeDom();
    

        /*
         * V1010501G2_SCOPE_REVEAL_LAST
         * Reveal only after this entire scope draw method has completed
         * its blur/shade/frame/reticle work.
         */
        /*
         * V1010501G4_HIDE_CLEAR_CIRCLE_UNTIL_SCOPE_INTERACTIVE
         * DO NOT reveal the magnified circular camera during rack-in.
         * It may appear only when the physical scope has finished arriving
         * and the existing sniperScopeInteractive gate is true.
         */
        this.sniperScopeCamera
            ?.setVisible(
                this.sniperScopeInteractive,
            );
}

    private drawSniperReloadGauge(): void {
        this.sniperReloadGraphics
            ?.clear()
            .setVisible(false);

        this.syncSniperScopeDom();
    }

    /*
     * V1010501E_NEXT_ROUND_SNIPER_SPECTATOR_HARD_RESET / REMOTE_SNIPER_SPECTATOR_RESET
     *
     * Remote sniper state is strictly ROUND/HUNT scoped.
     * One helper clears BOTH Phaser and DOM state so stale previous-round
     * sniper data can never leak into the next Hunt.
     */
    private resetRemoteSniperSpectatorState(): void {
        document
            .querySelector(
                '.colorhunt-sniper-spectator-status',
            )
            ?.remove();

        this.sniperSpectatorStatusText
            ?.setVisible(false);

        this.remoteSniperScopes
            .forEach(
                (scope) => {
                    scope.destroy();
                },
            );
        this.remoteSniperScopes.clear();

        this.remoteSniperActiveSessionIds
            .clear();

        this.remoteSniperAimBySessionId
            .clear();
    }

    private drawRemoteSniperScope(
        aim: NetworkSniperAim,
    ): void {
        /*
         * V1010501E_NEXT_ROUND_SNIPER_SPECTATOR_HARD_RESET / LATE_SNIPER_AIM_PACKET_GUARD
         *
         * A delayed sniper_aim from the just-finished round may arrive while
         * Lobby/Paint/Countdown is already active. Ignore it completely.
         */
        if (this.phase !== 'hunt') {
            return;
        }

        /*
         * V1010500_PAINT_BUBBLE_VICTORY_FONT_SNIPER_SPECTATE / REMOTE_SCOPE_CAMERA_TARGET
         * The same authoritative sniper_aim that draws the reticle also drives
         * the Hider spectator camera.
         */
        if (
            Number.isFinite(aim.x) &&
            Number.isFinite(aim.y)
        ) {
            this.remoteSniperAimBySessionId
                .set(
                    aim.sessionId,
                    {
                        x: aim.x,
                        y: aim.y,
                    },
                );
        }

        let g =
            this.remoteSniperScopes
                .get(
                    aim.sessionId,
                );

        if (!g) {
            g =
                this.add.graphics()
                    .setDepth(1190);

            this.remoteSniperScopes
                .set(
                    aim.sessionId,
                    g,
                );
        }

        g.clear();
        g.setAlpha(0.70);

        const radius =
            58;

        const outer =
            72;

        const inner =
            18;

        g.fillStyle(
            0xff2436,
            0.10,
        );

        g.fillCircle(
            aim.x,
            aim.y,
            radius,
        );

        g.lineStyle(
            7,
            0x050505,
            1,
        );

        g.strokeCircle(
            aim.x,
            aim.y,
            radius + 2,
        );

        g.lineStyle(
            4,
            0xff3348,
            1,
        );

        g.strokeCircle(
            aim.x,
            aim.y,
            radius,
        );

        /*
         * Black backing + red crosshair.
         */
        g.lineStyle(
            7,
            0x050505,
            1,
        );

        g.lineBetween(
            aim.x - outer,
            aim.y,
            aim.x - inner,
            aim.y,
        );

        g.lineBetween(
            aim.x + inner,
            aim.y,
            aim.x + outer,
            aim.y,
        );

        g.lineBetween(
            aim.x,
            aim.y - outer,
            aim.x,
            aim.y - inner,
        );

        g.lineBetween(
            aim.x,
            aim.y + inner,
            aim.x,
            aim.y + outer,
        );

        g.lineStyle(
            3,
            0xff3348,
            1,
        );

        g.lineBetween(
            aim.x - outer,
            aim.y,
            aim.x - inner,
            aim.y,
        );

        g.lineBetween(
            aim.x + inner,
            aim.y,
            aim.x + outer,
            aim.y,
        );

        g.lineBetween(
            aim.x,
            aim.y - outer,
            aim.x,
            aim.y - inner,
        );

        g.lineBetween(
            aim.x,
            aim.y + inner,
            aim.x,
            aim.y + outer,
        );

        g.lineStyle(
            5,
            0x050505,
            1,
        );

        g.strokeCircle(
            aim.x,
            aim.y,
            10,
        );

        g.lineStyle(
            2,
            0xffd7dc,
            1,
        );

        g.strokeCircle(
            aim.x,
            aim.y,
            7,
        );

        g.fillStyle(
            0xff3348,
            1,
        );

        g.fillCircle(
            aim.x,
            aim.y,
            3,
        );
    }
        /* V1010479B_ROBUST_LOBBY_ASSIST_SNIPER scope-alpha-confirmed */

    private showSniperImpact(shot: NetworkSniperFired): void {
        const ring = this.add.circle(shot.x, shot.y, shot.hitId ? 18 : 12)
            .setStrokeStyle(4, shot.hitId ? 0xffd54a : 0xfff3dc, 1)
            .setDepth(4920);
        const flash = this.add.circle(shot.x, shot.y, shot.hitId ? 9 : 6, 0xffe0a3, 0.92)
            .setDepth(4921);

        this.sniperImpactFx.add(ring);
        this.sniperImpactFx.add(flash);

        const shards =
            Array.from(
                {
                    length:
                        shot.hitId
                            ? 10
                            : 7,
                },
                (
                    _,
                    index,
                ) => {
                    const angle =
                        (
                            Math.PI *
                            2 *
                            index
                        ) /
                        (
                            shot.hitId
                                ? 10
                                : 7
                        );

                    const shard =
                        this.add.circle(
                            shot.x,
                            shot.y,
                            shot.hitId
                                ? 3
                                : 2,
                            shot.hitId
                                ? 0xffd36c
                                : 0xf8ead5,
                            0.96,
                        )
                            .setDepth(
                                4922,
                            );

                    this.sniperImpactFx
                        .add(
                            shard,
                        );

                    this.tweens.add({
                        targets:
                            shard,
                        x:
                            shot.x +
                            Math.cos(
                                angle,
                            ) *
                                (
                                    shot.hitId
                                        ? 42
                                        : 30
                                ),
                        y:
                            shot.y +
                            Math.sin(
                                angle,
                            ) *
                                (
                                    shot.hitId
                                        ? 42
                                        : 30
                                ),
                        scale:
                            0.2,
                        alpha:
                            0,
                        duration:
                            420,
                        ease:
                            'Quad.easeOut',
                        onComplete:
                            () => {
                                this.sniperImpactFx
                                    .delete(
                                        shard,
                                    );
                                shard.destroy();
                            },
                    });

                    return shard;
                },
            );

        void shards;

        this.tweens.add({
            targets: [ring, flash],
            scale:
                shot.hitId
                    ? 4.1
                    : 3.25,
            alpha: 0,
            duration: 460,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.sniperImpactFx.delete(ring);
                this.sniperImpactFx.delete(flash);
                ring.destroy();
                flash.destroy();
            },
        });

        this.cameras.main.shake(
            shot.hitId
                ? 125
                : 70,
            shot.hitId
                ? 0.006
                : 0.003,
        );
    }

    private updateSniperCinematicFrame(): void {
        if (
            !this.sniperCinematicActive ||
            !this.sniperActive ||
            this.phase !==
                'hunt'
        ) {
            return;
        }

        /*
         * Local Hunter never moves during overwatch.
         */
        this.networkPlayerManager
            .setLocalMovementHardLocked(
                true,
            );

        /*
         * V1010455B_SNIPER_PC_MOBILE_RENDER_SPLIT_SAFE
         * Once rack-in starts, Overwatch owns the main camera absolutely.
         */
        if (
            this.sniperHelicopterArrived &&
            (
                this.sniperScopeRackInRunning ||
                this.sniperScopeInteractive
            )
        ) {
            const overwatchCamera =
                this.cameras.main;

            overwatchCamera
                .stopFollow()
                .removeBounds()
                .setSize(
                    this.gameWidth,
                    this.gameHeight,
                );

            if (
                Math.abs(
                    overwatchCamera.zoom -
                        1,
                ) >
                    0.0001 ||
                Math.abs(
                    overwatchCamera.scrollX,
                ) >
                    0.01 ||
                Math.abs(
                    overwatchCamera.scrollY,
                ) >
                    0.01
            ) {
                overwatchCamera
                    .setZoom(
                        1,
                    )
                    .setScroll(
                        0,
                        0,
                    );

                this.applyFixedHudForZoom(
                    1,
                );
            }
        }

        /*
         * V1010460_SNIPER_OVERWATCH_UI_SCOPE_INPUT_TIMEOUT
         * Sniper owns combat/UI input.
         * Keep chat visible, but make it completely transparent to pointer hit
         * testing so the Phaser pointer/scope continues through it.
         */
        this.hunterWeaponHudContainer
            ?.setVisible(false);

        this.fartHudContainer
            ?.setVisible(false);

        this.aimLine
            .clear()
            .setVisible(false);

        this.crosshair
            .clear()
            .setVisible(false);

        this.gun
            .setVisible(false);

        const localPosition =
            this.networkPlayerManager
                .getLocalPlayerPosition();

        if (
            localPosition &&
            this.sniperHelicopter
        ) {
            this.sniperHelicopter.x =
                localPosition.x;

            if (
                this.sniperHelicopterArrived
            ) {
                this.sniperHelicopter.y =
                    localPosition.y;
            }
        }

        if (
            this.sniperScopeInteractive &&
            this.mobileControlsEnabled
        ) {
            /*
             * V1010389_MOBILE_SNIPER_PERFORMANCE_CONTROLS
             * Continuous virtual-stick scope motion.
             * Keep this independent from Hunter movement/shotgun aiming.
             */
            const frameScale =
                Phaser.Math.Clamp(
                    this.game.loop.delta /
                        16.667,
                    0.35,
                    2.0,
                );

            const scopeSpeed =
                7.4 *
                frameScale;

            const previousScopeX =
                this.sniperScopeScreenX;

            const previousScopeY =
                this.sniperScopeScreenY;

            this.sniperScopeScreenX =
                Phaser.Math.Clamp(
                    this.sniperScopeScreenX +
                        this.mobileSniperAimX *
                            scopeSpeed,
                    0,
                    this.gameWidth,
                );

            this.sniperScopeScreenY =
                Phaser.Math.Clamp(
                    this.sniperScopeScreenY +
                        this.mobileSniperAimY *
                            scopeSpeed,
                    0,
                    this.gameHeight,
                );

            if (
                Math.abs(
                    this.sniperScopeScreenX -
                        previousScopeX,
                ) > 0.01 ||
                Math.abs(
                    this.sniperScopeScreenY -
                        previousScopeY,
                ) > 0.01
            ) {
                this.mobileSniperScopeDirty =
                    true;
            }

            const world =
                this.cameras.main
                    .getWorldPoint(
                        this.sniperScopeScreenX,
                        this.sniperScopeScreenY,
                    );

            this.sniperAimWorldX =
                Phaser.Math.Clamp(
                    world.x,
                    0,
                    this.gameWidth,
                );

            this.sniperAimWorldY =
                Phaser.Math.Clamp(
                    world.y,
                    0,
                    this.gameHeight,
                );

            if (
                this.time.now -
                    this.sniperLastAimBroadcastAt >=
                    90
            ) {
                this.sniperLastAimBroadcastAt =
                    this.time.now;

                multiplayerClient
                    .sendSniperAim(
                        this.sniperAimWorldX,
                        this.sniperAimWorldY,
                    );
            }

            if (
                this.mobileSniperScopeDirty ||
                this.sniperScopeStripCameras.length ===
                    0
            ) {
                this.drawLocalSniperScope(
                    this.sniperAimWorldX,
                    this.sniperAimWorldY,
                );

                this.mobileSniperScopeDirty =
                    false;
            } else {
                /*
                 * Keep timer/reload/mask fresh without rewriting the camera
                 * viewport when the stick is idle.
                 */
                this.syncSniperScopeDom();
            }
        } else if (
            this.sniperScopeInteractive &&
            !this.mobileControlsEnabled
        ) {
            /*
             * FULL MAP authority:
             * no shotgun range, no player-radius clamp, no hunter cone.
             * pointer -> full-map world point directly.
             */
            const pointer =
                this.input.activePointer;

            /*
             * V1010462_SNIPER_SCOPE_POLISH_VICTORY_SCALE_RESTORE
             * The scope center follows the pointer all the way to the canvas edge.
             * The circle may naturally clip off-screen; it must never stop early.
             */
            this.sniperScopeScreenX =
                Phaser.Math.Clamp(
                    pointer.x,
                    0,
                    this.gameWidth,
                );

            this.sniperScopeScreenY =
                Phaser.Math.Clamp(
                    pointer.y,
                    0,
                    this.gameHeight,
                );

            const world =
                this.cameras.main
                    .getWorldPoint(
                        pointer.x,
                        pointer.y,
                    );

            this.sniperAimWorldX =
                Phaser.Math.Clamp(
                    world.x,
                    0,
                    this.gameWidth,
                );

            this.sniperAimWorldY =
                Phaser.Math.Clamp(
                    world.y,
                    0,
                    this.gameHeight,
                );

            if (
                this.time.now -
                    this.sniperLastAimBroadcastAt >=
                66
            ) {
                this.sniperLastAimBroadcastAt =
                    this.time.now;

                multiplayerClient
                    .sendSniperAim(
                        this.sniperAimWorldX,
                        this.sniperAimWorldY,
                    );
            }

            this.drawLocalSniperScope(
                this.sniperAimWorldX,
                this.sniperAimWorldY,
            );
        } else if (
            this.sniperScopeCamera
        ) {
            this.drawLocalSniperScope(
                this.sniperAimWorldX,
                this.sniperAimWorldY,
            );
        }

        this.drawSniperReloadGauge();
    }

    /* V1010460_SNIPER_OVERWATCH_UI_SCOPE_INPUT_TIMEOUT */
    private sniperScopeStripCameras: Phaser.Cameras.Scene2D.Camera[] = [];

    /* V1010507_TACTICAL_VULCAN_AIR_SUPPORT: same support intro, different final instrument. */





    private createVulcanHelicopter(): void {
        this.vulcanHelicopterRotorTween
            ?.stop();

        this.vulcanHelicopterRotorTween =
            undefined;

        this.vulcanHelicopter
            ?.destroy(true);

        this.vulcanHelicopter =
            undefined;

        const black =
            0x010204;

        const fuselage =
            this.add.ellipse(
                0,
                -4,
                38,
                82,
                black,
                1,
            );

        const cockpit =
            this.add.ellipse(
                0,
                -28,
                29,
                31,
                black,
                1,
            );

        const tailBoom =
            this.add.rectangle(
                0,
                54,
                12,
                67,
                black,
                1,
            );

        const tailFinLeft =
            this.add.triangle(
                -1,
                83,
                0,
                0,
                -24,
                17,
                -3,
                19,
                black,
                1,
            );

        const tailFinRight =
            this.add.triangle(
                1,
                83,
                0,
                0,
                24,
                17,
                3,
                19,
                black,
                1,
            );

        const skidLeft =
            this.add.rectangle(
                -25,
                6,
                6,
                61,
                black,
                1,
            );

        const skidRight =
            this.add.rectangle(
                25,
                6,
                6,
                61,
                black,
                1,
            );

        const rotorHorizontal =
            this.add.rectangle(
                0,
                0,
                150,
                5,
                black,
                1,
            );

        const rotorVertical =
            this.add.rectangle(
                0,
                0,
                5,
                150,
                black,
                1,
            );

        const rotorHub =
            this.add.circle(
                0,
                0,
                8,
                black,
                1,
            );

        const rotorGroup =
            this.add.container(
                0,
                -8,
                [
                    rotorHorizontal,
                    rotorVertical,
                    rotorHub,
                ],
            );

        const tailRotor =
            this.add.container(
                0,
                88,
                [
                    this.add.rectangle(
                        0,
                        0,
                        34,
                        3,
                        black,
                        1,
                    ),
                    this.add.rectangle(
                        0,
                        0,
                        3,
                        34,
                        black,
                        1,
                    ),
                ],
            );

        this.vulcanHelicopter =
            this.add.container(
                0,
                0,
                [
                    tailBoom,
                    tailFinLeft,
                    tailFinRight,
                    skidLeft,
                    skidRight,
                    fuselage,
                    cockpit,
                    rotorGroup,
                    tailRotor,
                ],
            )
                .setDepth(
                    25004,
                )
                .setAlpha(
                    1,
                )
                .setScale(
                    0.92,
                )
                .setVisible(
                    false,
                );

        /*
         * Same rotor feel as Sniper mode.
         */
        this.vulcanHelicopterRotorTween =
            this.tweens.add({
                targets:
                    rotorGroup,
                angle:
                    360,
                duration:
                    170,
                repeat:
                    -1,
            });

        this.tweens.add({
            targets:
                tailRotor,
            angle:
                -360,
            duration:
                105,
            repeat:
                -1,
        });
    }

    private enterVulcanCinematic(
        isOwner: boolean,
    ): void {
        if (
            isOwner
        ) {
            this.installVulcanDomInputBridge();
        }

        this.ensureVulcanRuntimeTimer();

        if (
            this.phase !==
                'hunt' ||
            !isOwner
        ) {
            return;
        }

        this.vulcanCinematicActive =
            true;

        this.vulcanSpectatorViewActive =
            false;


        this.vulcanFiring =
            false;

        this.vulcanPointerHeld =
            false;

        this.vulcanHeat =
            0;
        this.vulcanHeatUpdatedAt = 0;
        this.vulcanOverheated = false;

        this.vulcanReadyAt =
            0;

        /*
         * Vulcan never reveals the normal bright map.
         * Remove Hunter cone/circle immediately and replace it with
         * one persistent restricted-dark aerial layer.
         */
        this.hiderVisionGraphics
            ?.clear()
            .setVisible(false);

        this.hiderVisionOverlays
            .forEach(
                (overlay) =>
                    overlay
                        .setVisible(false),
            );

        this.heartbeatDangerOverlay
            ?.setVisible(false)
            .setAlpha(0);

        this.heartbeatBorders
            .forEach(
                (border) =>
                    border
                        .setVisible(false)
                        .setAlpha(0),
            );

        this.aimLine
            ?.clear()
            .setVisible(false);

        this.crosshair
            ?.clear()
            .setVisible(false);

        this.gun
            ?.setVisible(false);

        this.networkPlayerManager
            ?.clearHunterAimLines();

        this.mobileMoveBase
            ?.setVisible(false);

        this.mobileMoveKnob
            ?.setVisible(false);

        this.mobileMoveLabel
            ?.setVisible(false);

        this.mobileAimBase
            ?.setVisible(false);

        this.mobileAimKnob
            ?.setVisible(false);

        this.mobileAimLabel
            ?.setVisible(false);

        this.mobileFireButton
            ?.setVisible(false);

        this.mobileFireLabel
            ?.setVisible(false);

        this.hunterWeaponHudContainer
            ?.setVisible(false);

        this.vulcanDarkness
            ?.clear()
            .setDepth(
                24993,
            )
            .setVisible(true)
            .setBlendMode(
                Phaser.BlendModes.NORMAL,
            );

        this.vulcanDarkness
            ?.fillStyle(
                0x000103,
                0.60,
            );

        this.vulcanDarkness
            ?.fillRect(
                -260,
                -260,
                1500,
                1060,
            );

        this.vulcanSpotlight
            ?.clear()
            .setVisible(false);

        this.vulcanCooldownGraphics
            ?.clear()
            .setVisible(false);

        this.vulcanCinematicShade
            ?.setVisible(false)
            .setAlpha(0);

        this.createVulcanHelicopter();
        this.startSniperHelicopterAudio();

        const camera =
            this.cameras.main;

        camera
            .resetFX()
            .stopFollow()
            .removeBounds()
            .setSize(
                this.gameWidth,
                this.gameHeight,
            )
            .setRotation(0);

        const startZoom =
            Math.max(
                0.01,
                camera.zoom,
            );

        this.vulcanSavedCameraZoom =
            startZoom;

        const startX =
            camera.midPoint.x;

        const startY =
            camera.midPoint.y;

        const entryY =
            camera.worldView.bottom +
            120 /
                startZoom;

        this.vulcanHelicopter
            ?.setPosition(
                startX,
                entryY,
            )
            .setScale(
                0.82,
            )
            .setAlpha(
                0,
            )
            .setVisible(
                true,
            );

        const beginBlackout =
            (): void => {
                if (
                    this.phase !==
                        'hunt' ||
                    !this.vulcanActive
                ) {
                    return;
                }

                const heliX =
                    this.vulcanHelicopter
                        ?.x ??
                    startX;

                const heliY =
                    this.vulcanHelicopter
                        ?.y ??
                    startY;

                const punchZoom =
                    Phaser.Math.Clamp(
                        startZoom *
                            5,
                        4.8,
                        8,
                    );

                const punch = {
                    value: 0,
                };

                this.playVulcanTransitionWhoosh();

                /*
                 * Camera fadeOut is used here instead of a world rectangle:
                 * it guarantees a true 100% black viewport at max zoom.
                 */
                camera.fadeOut(
                    720,
                    0,
                    0,
                    0,
                );

                this.tweens.add({
                    targets:
                        punch,
                    value:
                        1,
                    duration:
                        720,
                    ease:
                        'Cubic.easeIn',
                    onUpdate:
                        () => {
                            const t =
                                Phaser.Math.Clamp(
                                    punch.value,
                                    0,
                                    1,
                                );

                            const eased =
                                t *
                                t;

                            camera
                                .setZoom(
                                    Phaser.Math.Linear(
                                        startZoom,
                                        punchZoom,
                                        eased,
                                    ),
                                )
                                .centerOn(
                                    heliX,
                                    heliY,
                                );

                            this.applyFixedHudForZoom(
                                camera.zoom,
                            );
                        },
                    onComplete:
                        () => {
                            /*
                             * Hold an actual all-black frame before moving
                             * into the aerial viewpoint.
                             */
                            camera
                                .setZoom(
                                    punchZoom,
                                )
                                .centerOn(
                                    heliX,
                                    heliY,
                                );

                            this.vulcanHelicopter
                                ?.destroy(true);

                            this.vulcanHelicopter =
                                undefined;

                            this.time.delayedCall(
                                260,
                                () => {
                                    if (
                                        this.phase !==
                                            'hunt' ||
                                        !this.vulcanActive
                                    ) {
                                        return;
                                    }

                                    const travel = {
                                        value: 0,
                                    };

                                    /*
                                     * Slower than before: ~3.2 s.
                                     * Start fully black and gradually brighten
                                     * only to the persistent Vulcan darkness.
                                     */
                                    camera.fadeIn(
                                        3200,
                                        0,
                                        0,
                                        0,
                                    );

                                    this.tweens.add({
                                        targets:
                                            travel,
                                        value:
                                            1,
                                        duration:
                                            3200,
                                        ease:
                                            'Sine.easeInOut',
                                        onUpdate:
                                            () => {
                                                const t =
                                                    Phaser.Math.Clamp(
                                                        travel.value,
                                                        0,
                                                        1,
                                                    );

                                                const eased =
                                                    Phaser.Math.SmoothStep(
                                                        t,
                                                        0,
                                                        1,
                                                    );

                                                camera
                                                    .setZoom(
                                                        Phaser.Math.Linear(
                                                            punchZoom,
                                                            1.34,
                                                            eased,
                                                        ),
                                                    )
                                                    .centerOn(
                                                        Phaser.Math.Linear(
                                                            heliX,
                                                            480,
                                                            eased,
                                                        ),
                                                        Phaser.Math.Linear(
                                                            heliY,
                                                            270,
                                                            eased,
                                                        ),
                                                    )
                                                    .setRotation(
                                                        0,
                                                    );

                                                this.applyFixedHudForZoom(
                                                    camera.zoom,
                                                );
                                            },
                                        onComplete:
                                            () => {
                                                if (
                                                    this.phase !==
                                                        'hunt' ||
                                                    !this.vulcanActive
                                                ) {
                                                    return;
                                                }

                                                camera
                                                    .resetFX()
                                                    .setZoom(
                                                        1.34,
                                                    )
                                                    .centerOn(
                                                        480,
                                                        270,
                                                    )
                                                    .setRotation(
                                                        0,
                                                    );

                                                this.vulcanTargetX =
                                                    480;

                                                this.vulcanTargetY =
                                                    270;

                                                this.vulcanDisplayX =
                                                    480;

                                                this.vulcanDisplayY =
                                                    270;

                                                this.vulcanOrbitStartedAt =
                                                    this.time.now;

                                                /*
                                                 * Make the lamp explicitly visible
                                                 * BEFORE enabling input.
                                                 */

                                                this.vulcanSpotlight
                                                    ?.setDepth(
                                                        25003,
                                                    )
                                                    .setVisible(
                                                        true,
                                                    );

                                                this.vulcanCooldownGraphics
                                                    ?.setDepth(
                                                        25005,
                                                    )
                                                    .setVisible(
                                                        true,
                                                    );

                                                this.drawVulcanSpotlight(
                                                    480,
                                                    270,
                                                );

                                                this.drawVulcanCooldownGauge(
                                                    480,
                                                    270,
                                                );

                                                this.playVulcanSearchlightPop();

                                                const pop =
                                                    this.add.circle(
                                                        480,
                                                        270,
                                                        38,
                                                        0xffffdd,
                                                        0.96,
                                                    )
                                                        .setDepth(
                                                            25006,
                                                        );

                                                this.tweens.add({
                                                    targets:
                                                        pop,
                                                    scale:
                                                        5.8,
                                                    alpha:
                                                        0,
                                                    duration:
                                                        320,
                                                    ease:
                                                        'Quad.easeOut',
                                                    onComplete:
                                                        () =>
                                                            pop.destroy(),
                                                });

                                                /*
                                                 * Input becomes live only after
                                                 * the lamp is already on screen.
                                                 */
                                                this.vulcanCinematicActive =
                                                    false;

                                                if (
                                                    this.practiceMode !==
                                                    'hunter'
                                                ) {
                                                    multiplayerClient
                                                        .sendVulcanAim(
                                                            480,
                                                            270,
                                                        );
                                                }
                                            },
                                    });
                                },
                            );
                        },
                });
            };

        if (
            this.vulcanHelicopter
        ) {
            this.tweens.add({
                targets:
                    this.vulcanHelicopter,
                y:
                    startY,
                alpha:
                    1,
                scaleX:
                    1.02,
                scaleY:
                    1.02,
                duration:
                    760,
                ease:
                    'Cubic.easeOut',
                onComplete:
                    beginBlackout,
            });
        } else {
            beginBlackout();
        }
    }


    private getVulcanWorldPointFromClient(
        clientX: number,
        clientY: number,
    ): Phaser.Math.Vector2 | undefined {
        const canvas =
            this.game.canvas;

        if (!canvas) {
            return undefined;
        }

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
        ) {
            return undefined;
        }

        const screenX =
            (
                clientX -
                rect.left
            ) *
            (
                this.gameWidth /
                rect.width
            );

        const screenY =
            (
                clientY -
                rect.top
            ) *
            (
                this.gameHeight /
                rect.height
            );

        const world =
            this.cameras.main
                .getWorldPoint(
                    screenX,
                    screenY,
                );

        return new Phaser.Math.Vector2(
            Phaser.Math.Clamp(
                world.x,
                0,
                960,
            ),
            Phaser.Math.Clamp(
                world.y,
                0,
                540,
            ),
        );
    }

    private ensureVulcanRuntimeTimer(): void {
        if (
            this.vulcanRuntimeEvent &&
            !this.vulcanRuntimeEvent
                .hasDispatched
        ) {
            return;
        }

        this.vulcanRuntimeEvent =
            this.time.addEvent({
                delay:
                    16,
                loop:
                    true,
                callback:
                    () => {
                        if (
                            this.phase !==
                                'hunt'
                        ) {
                            return;
                        }

                        if (
                            !this.vulcanActive &&
                            !this.vulcanSpectatorViewActive
                        ) {
                            return;
                        }

                        this.updateVulcanAirSupport();
                    },
            });
    }

    private stopVulcanRuntimeTimer(): void {
        this.vulcanRuntimeEvent
            ?.remove(false);

        this.vulcanRuntimeEvent =
            undefined;
    }

    private installVulcanDomInputBridge(): void {
        if (
            this.vulcanDomPointerMoveHandler
        ) {
            this.ensureVulcanRuntimeTimer();
            return;
        }

        this.ensureVulcanRuntimeTimer();

        this.vulcanDomPointerMoveHandler =
            (
                event:
                    PointerEvent,
            ): void => {
                if (
                    !this.vulcanActive ||
                    this.phase !==
                        'hunt' ||
                    this.vulcanCinematicActive
                ) {
                    return;
                }

                const world =
                    this.getVulcanWorldPointFromClient(
                        event.clientX,
                        event.clientY,
                    );

                if (!world) {
                    return;
                }

                this.vulcanTargetX =
                    world.x;

                this.vulcanTargetY =
                    world.y;

                const now =
                    performance.now();

                if (
                    now -
                        this.vulcanDomLastAimSentAt >=
                        66 &&
                    this.practiceMode !==
                        'hunter'
                ) {
                    this.vulcanDomLastAimSentAt =
                        now;

                    multiplayerClient
                        .sendVulcanAim(
                            world.x,
                            world.y,
                        );
                }
            };

        this.vulcanDomPointerDownHandler =
            (
                event:
                    PointerEvent,
            ): void => {
                if (
                    event.button !==
                        0 ||
                    !this.vulcanActive ||
                    this.phase !==
                        'hunt' ||
                    this.vulcanCinematicActive
                ) {
                    return;
                }

                const world =
                    this.getVulcanWorldPointFromClient(
                        event.clientX,
                        event.clientY,
                    );

                if (!world) {
                    return;
                }

                const now =
                    Date.now();

                /*
                 * One source of truth:
                 * - partial heat never blocks
                 * - only visible overheat blocks
                 * - if bar reached zero, stale readyAt is cleared here too
                 */
                if (
                    this.vulcanHeat <=
                        0.001 &&
                    !this.vulcanOverheated
                ) {
                    this.vulcanHeat =
                        0;

                    this.vulcanReadyAt =
                        0;
                }

                if (
                    this.vulcanFiring ||
                    this.vulcanOverheated ||
                    this.vulcanHeat >=
                        0.999
                ) {
                    return;
                }

                this.vulcanTargetX =
                    world.x;

                this.vulcanTargetY =
                    world.y;

                this.vulcanPointerHeld =
                    true;

                this.vulcanFiring =
                    true;

                this.vulcanFireStartedAt =
                    now;

                this.vulcanLastMuzzleFxAt =
                    0;


                this.playVulcanGunPulse();

                if (
                    this.practiceMode !==
                    'hunter'
                ) {
                    multiplayerClient
                        .sendVulcanAim(
                            world.x,
                            world.y,
                        );

                    multiplayerClient
                        .sendVulcanFireStart();
                }

                event.preventDefault();
            };

        const stopFire =
            (
                event:
                    PointerEvent,
            ): void => {
                if (
                    !this.vulcanActive ||
                    !this.vulcanFiring
                ) {
                    return;
                }

                const now =
                    Date.now();

                const heldMs =
                    Math.max(
                        80,
                        Math.min(
                            3000,
                            now -
                                this.vulcanFireStartedAt,
                        ),
                    );

                this.vulcanPointerHeld =
                    false;

                this.vulcanFiring =
                    false;

                this.vulcanHeat =
                    Phaser.Math.Clamp(
                        heldMs /
                            3000,
                        0,
                        1,
                    );


                this.vulcanCoolingDurationMs =
                    heldMs *
                    2;

                this.vulcanReadyAt =
                    now +
                    this.vulcanCoolingDurationMs;

                if (
                    this.practiceMode !==
                    'hunter'
                ) {
                    multiplayerClient
                        .sendVulcanFireStop();
                }

                if (
                    event.cancelable
                ) {
                    event.preventDefault();
                }
            };

        this.vulcanDomPointerUpHandler =
            stopFire;

        this.vulcanDomPointerCancelHandler =
            stopFire;

        window.addEventListener(
            'pointermove',
            this.vulcanDomPointerMoveHandler,
            true,
        );

        window.addEventListener(
            'pointerdown',
            this.vulcanDomPointerDownHandler,
            true,
        );

        window.addEventListener(
            'pointerup',
            this.vulcanDomPointerUpHandler,
            true,
        );

        window.addEventListener(
            'pointercancel',
            this.vulcanDomPointerCancelHandler,
            true,
        );
    }

    private removeVulcanDomInputBridge(): void {
        if (
            this.vulcanDomPointerMoveHandler
        ) {
            window.removeEventListener(
                'pointermove',
                this.vulcanDomPointerMoveHandler,
                true,
            );
        }

        if (
            this.vulcanDomPointerDownHandler
        ) {
            window.removeEventListener(
                'pointerdown',
                this.vulcanDomPointerDownHandler,
                true,
            );
        }

        if (
            this.vulcanDomPointerUpHandler
        ) {
            window.removeEventListener(
                'pointerup',
                this.vulcanDomPointerUpHandler,
                true,
            );
        }

        if (
            this.vulcanDomPointerCancelHandler
        ) {
            window.removeEventListener(
                'pointercancel',
                this.vulcanDomPointerCancelHandler,
                true,
            );
        }

        this.vulcanDomPointerMoveHandler =
            undefined;

        this.vulcanDomPointerDownHandler =
            undefined;

        this.vulcanDomPointerUpHandler =
            undefined;

        this.vulcanDomPointerCancelHandler =
            undefined;
    }



    private spawnVulcanPresentationImpact(
        x: number,
        y: number,
        withSound: boolean,
    ): void {
        if (
            withSound
        ) {
            this.playVulcanGunPulse();
        }

        const px =
            Phaser.Math.Clamp(
                x +
                    Phaser.Math.Between(
                        -26,
                        26,
                    ),
                0,
                960,
            );

        const py =
            Phaser.Math.Clamp(
                y +
                    Phaser.Math.Between(
                        -18,
                        18,
                    ),
                0,
                540,
            );

        const flash =
            this.add.circle(
                px,
                py,
                Phaser.Math.Between(
                    5,
                    9,
                ),
                0xffa126,
                0.98,
            )
                .setDepth(
                    25009,
                );

        const ring =
            this.add.circle(
                px,
                py,
                5,
            )
                .setStrokeStyle(
                    2,
                    0xfff0a0,
                    0.96,
                )
                .setDepth(
                    25008,
                );

        const tracer =
            this.add.rectangle(
                px -
                    18,
                py -
                    8,
                Phaser.Math.Between(
                    18,
                    34,
                ),
                2,
                0xffcf54,
                0.92,
            )
                .setAngle(
                    Phaser.Math.Between(
                        -24,
                        24,
                    ),
                )
                .setDepth(
                    25008,
                );

        this.vulcanImpactFx
            .add(
                flash,
            );

        this.vulcanImpactFx
            .add(
                ring,
            );

        this.vulcanImpactFx
            .add(
                tracer,
            );

        this.tweens.add({
            targets:
                flash,
            alpha:
                0,
            scale:
                2.2,
            duration:
                130,
            onComplete:
                () => {
                    this.vulcanImpactFx
                        .delete(
                            flash,
                        );

                    flash.destroy();
                },
        });

        this.tweens.add({
            targets:
                ring,
            alpha:
                0,
            scale:
                2.8,
            duration:
                180,
            onComplete:
                () => {
                    this.vulcanImpactFx
                        .delete(
                            ring,
                        );

                    ring.destroy();
                },
        });

        this.tweens.add({
            targets:
                tracer,
            alpha:
                0,
            x:
                tracer.x +
                24,
            duration:
                95,
            onComplete:
                () => {
                    this.vulcanImpactFx
                        .delete(
                            tracer,
                        );

                    tracer.destroy();
                },
        });

        this.cameras.main.shake(
            34,
            0.0012,
        );
    }




    private forceTacticalTopHud(): void {
        if (
            this.phase !==
                'hunt' ||
            (
                !this.sniperActive &&
                !this.sniperCinematicActive &&
                !this.vulcanActive &&
                !this.vulcanCinematicActive &&
                !this.vulcanSpectatorViewActive
            )
        ) {
            return;
        }

        /*
         * Tactical scopes/lamps live around depth 25k.
         * Keep the actual round clock/role strip decisively above them.
         */
        this.survivalHudGraphics
            ?.setDepth(
                100060,
            )
            .setScrollFactor(
                0,
            );

        this.survivalHudText
            ?.setDepth(
                100061,
            )
            .setScrollFactor(
                0,
            )
            .setVisible(
                true,
            );

        this.survivalHiderLabelText
            ?.setDepth(
                100062,
            )
            .setScrollFactor(
                0,
            );

        this.survivalHunterLabelText
            ?.setDepth(
                100062,
            )
            .setScrollFactor(
                0,
            );

        this.phaseText
            ?.setDepth(
                100063,
            )
            .setScrollFactor(
                0,
            );

        /*
         * Legacy timerText may be the active clock in some HUD branches.
         * Never force empty text visible, but if it is currently in use,
         * give it the same top-most tactical priority.
         */
        if (
            this.timerText &&
            this.timerText.text
        ) {
            this.timerText
                .setDepth(
                    100064,
                )
                .setScrollFactor(
                    0,
                )
                .setVisible(
                    true,
                );
        }
    }


    private updateVulcanAirSupport(): void {
        /*
         * Result/lobby hard cleanup even if phase still transiently reports Hunt.
         */
        const authoritativeWinner =
            multiplayerClient.getRoom()
                ?.state.winner;


        const resultKnown =
            this.phase !==
                'hunt' ||
            this.roundResultWinner !==
                null ||
            Boolean(
                authoritativeWinner,
            );

        if (
            resultKnown
        ) {
            this.sniperButton
                ?.disableInteractive()
                .setVisible(false);

            this.vulcanButton
                ?.disableInteractive()
                .setVisible(false);

            /*
             * IMPORTANT:
             * WIN/LOSE frame itself must already be clean.
             * No dark layer, lamp, HEAT bar, orbit, recoil or tactical zoom
             * may survive behind the result text/card.
             */
            if (
                this.vulcanActive ||
                this.vulcanCinematicActive ||
                this.vulcanSpectatorViewActive ||
                Boolean(
                    this.vulcanDarkness
                        ?.visible,
                ) ||
                Boolean(
                    this.vulcanSpotlight
                        ?.visible,
                )
            ) {
                this.clearVulcanForResultCapture();
            }

            return;
        }

        this.forceTacticalTopHud();
        this.applyTacticalSupportInputLock();

        const watchedSessionId =
            this.spectatorSessionId ??
            '';

        const watchingRemoteVulcan =
            Boolean(
                watchedSessionId,
            ) &&
            this.remoteVulcanActiveSessionIds
                .has(
                    watchedSessionId,
                );

        if (
            watchingRemoteVulcan
        ) {
            if (
                !this.vulcanSpectatorViewActive ||
                this.vulcanSpectatorSessionId !==
                    watchedSessionId
            ) {
                this.exitVulcanSpectatorView();

                this.enterVulcanSpectatorView(
                    watchedSessionId,
                );
            }

            const remoteAim =
                this.remoteVulcanAimBySessionId
                    .get(
                        watchedSessionId,
                    );

            if (
                remoteAim
            ) {
                this.vulcanTargetX =
                    remoteAim.x;

                this.vulcanTargetY =
                    remoteAim.y;
            }
        } else if (
            this.vulcanSpectatorViewActive
        ) {
            this.exitVulcanSpectatorView();
        }

        const ownerActive =
            this.vulcanActive;

        if (
            !ownerActive &&
            !this.vulcanSpectatorViewActive
        ) {
            return;
        }

        if (
            ownerActive &&
            this.vulcanCinematicActive
        ) {
            return;
        }

        const camera =
            this.cameras.main;

        this.vulcanDisplayX =
            Phaser.Math.Linear(
                this.vulcanDisplayX,
                this.vulcanTargetX,
                0.22,
            );

        this.vulcanDisplayY =
            Phaser.Math.Linear(
                this.vulcanDisplayY,
                this.vulcanTargetY,
                0.22,
            );

        const elapsed =
            Math.max(
                0,
                this.time.now -
                    this.vulcanOrbitStartedAt,
            );

        const orbit =
            elapsed *
            0.00048;

        camera
            .setZoom(
                1.34,
            )
            .centerOn(
                480 +
                    Math.cos(
                        orbit,
                    ) *
                        24,
                270 +
                    Math.sin(
                        orbit,
                    ) *
                        16,
            )
            .setRotation(
                Math.sin(
                    orbit *
                        0.92,
                ) *
                    0.015,
            );

        this.vulcanSpotlight
            ?.setVisible(
                true,
            );

        this.drawVulcanSpotlight(
            this.vulcanDisplayX,
            this.vulcanDisplayY,
        );

        const now =
            Date.now();

        /*
         * V520B HEAT/INPUT ATOMIC READY SYNC:
         * when the visible 3-second overheat reaches its final frame,
         * clear visual heat AND the actual fire lock together.
         */
        if (
            this.vulcanOverheated &&
            this.vulcanReadyAt >
                0 &&
            this.vulcanReadyAt -
                now <=
                35
        ) {
            this.vulcanOverheated =
                false;

            this.vulcanHeat =
                0;

            this.vulcanReadyAt =
                0;

            this.vulcanHeatUpdatedAt =
                now;
        }

        /*
         * Shotgun-style continuous HEAT.
         *
         * FIRE: +100% over 3 seconds.
         * REST: -100% over 3 seconds.
         * Partial heat does NOT lock firing.
         * Only reaching 100% creates a real 3-second overheat lock.
         */
        if (
            ownerActive
        ) {
            if (
                this.vulcanHeatUpdatedAt <=
                    0
            ) {
                this.vulcanHeatUpdatedAt =
                    now;
            }

            const heatDeltaMs =
                Math.max(
                    0,
                    Math.min(
                        100,
                        now -
                            this.vulcanHeatUpdatedAt,
                    ),
                );

            this.vulcanHeatUpdatedAt =
                now;

            if (
                this.vulcanOverheated
            ) {
                const remaining =
                    Math.max(
                        0,
                        this.vulcanReadyAt -
                            now,
                    );

                this.vulcanHeat =
                    Phaser.Math.Clamp(
                        remaining /
                            3000,
                        0,
                        1,
                    );

                if (
                    remaining <=
                    0
                ) {
                    this.vulcanOverheated =
                        false;

                    this.vulcanHeat =
                        0;
        this.vulcanHeatUpdatedAt = 0;
        this.vulcanOverheated = false;
                }
            } else if (
                this.vulcanFiring
            ) {
                if (
                    this.practiceMode ===
                        'hunter'
                ) {
                    this.vulcanHeat =
                        Phaser.Math.Clamp(
                            this.vulcanHeat +
                                heatDeltaMs /
                                    3000,
                            0,
                            1,
                        );
                }

                /*
                 * Multiplayer HEAT comes from the server stream every ~90ms.
                 * Do not double-integrate it locally.
                 */

                if (
                    this.practiceMode ===
                        'hunter' &&
                    this.vulcanHeat >=
                        0.999
                ) {
                    this.vulcanHeat =
                        1;

                    this.vulcanPointerHeld =
                        false;

                    this.vulcanFiring =
                        false;

                    this.vulcanOverheated =
                        true;

                    this.vulcanReadyAt =
                        now +
                        3000;
                }
            } else {
                this.vulcanHeat =
                    Phaser.Math.Clamp(
                        this.vulcanHeat -
                            heatDeltaMs /
                                3000,
                        0,
                        1,
                    );
            }
        }

        /*
         * Owner and spectating Hider share the same firing presentation.
         */
        const spectatorFiring =
            this.vulcanSpectatorViewActive &&
            Boolean(
                this.vulcanSpectatorSessionId,
            ) &&
            this.remoteVulcanFiringSessionIds
                .has(
                    this.vulcanSpectatorSessionId,
                );

        const visualFiring =
            (
                ownerActive &&
                this.vulcanFiring
            ) ||
            spectatorFiring;

        if (
            visualFiring &&
            now -
                this.vulcanLastMuzzleFxAt >=
                58
        ) {
            this.vulcanLastMuzzleFxAt =
                now;

            this.spawnVulcanPresentationImpact(
                this.vulcanDisplayX,
                this.vulcanDisplayY,
                true,
            );

            /*
             * Extra BRRRT recoil.
             * Noticeable, but small enough not to sabotage aiming.
             */
            camera.shake(
                70,
                0.0030,
            );
        }

        if (
            ownerActive
        ) {
            this.vulcanCooldownGraphics
                ?.setVisible(
                    true,
                );

            this.drawVulcanCooldownGauge(
                this.vulcanDisplayX,
                this.vulcanDisplayY,
            );
        } else {
            this.vulcanCooldownGraphics
                ?.clear()
                .setVisible(
                    false,
                );
        }
    }


    private drawVulcanSpotlight(
        x: number,
        y: number,
    ): void {
        const light =
            this.vulcanSpotlight;

        const darkness =
            this.vulcanDarkness;

        if (
            !light ||
            !darkness
        ) {
            return;
        }

        const dx =
            x -
            480;

        const dy =
            y -
            270;

        const t =
            Phaser.Math.Clamp(
                Math.hypot(
                    dx,
                    dy,
                ) /
                    Math.hypot(
                        480,
                        270,
                    ),
                0,
                1,
            );

        const angle =
            Math.atan2(
                dy,
                dx,
            );

        const major =
            Phaser.Math.Linear(
                144,
                350,
                t,
            );

        const minor =
            Phaser.Math.Linear(
                144,
                86,
                t,
            );

        /*
         * IMPORTANT:
         * Darkness stays world-aligned at rotation=0.
         * Only the clear ellipse is mathematically rotated.
         *
         * This removes the unpleasant "dark layer tilted against the map"
         * edge/corner artifact during the helicopter orbit.
         */
        darkness
            .clear()
            .setDepth(
                24993,
            )
            .setPosition(
                0,
                0,
            )
            .setRotation(
                0,
            )
            .setBlendMode(
                Phaser.BlendModes.NORMAL,
            )
            .setVisible(
                true,
            );

        darkness.fillStyle(
            0x000103,
            0.56,
        );

        const rx =
            major *
            0.59;

        const ry =
            minor *
            0.59;

        const c =
            Math.cos(
                angle,
            );

        const sn =
            Math.sin(
                angle,
            );

        const invRx2 =
            1 /
            Math.max(
                1,
                rx *
                    rx,
            );

        const invRy2 =
            1 /
            Math.max(
                1,
                ry *
                    ry,
            );

        /*
         * Rotated ellipse:
         * A*x² + B*x*y + C*y² = 1
         * solved for x on each horizontal world scanline.
         */
        const A =
            c *
                c *
                invRx2 +
            sn *
                sn *
                invRy2;

        const B =
            2 *
            c *
            sn *
            (
                invRx2 -
                invRy2
            );

        const C =
            sn *
                sn *
                invRx2 +
            c *
                c *
                invRy2;

        const bandHeight =
            4;

        const fieldLeft =
            -120;

        const fieldRight =
            1080;

        const fieldTop =
            -120;

        const fieldBottom =
            660;

        for (
            let worldY =
                fieldTop;
            worldY <
                fieldBottom;
            worldY +=
                bandHeight
        ) {
            const relativeY =
                worldY +
                bandHeight *
                    0.5 -
                y;

            const qa =
                A;

            const qb =
                B *
                relativeY;

            const qc =
                C *
                    relativeY *
                    relativeY -
                1;

            const discriminant =
                qb *
                    qb -
                4 *
                    qa *
                    qc;

            if (
                discriminant <=
                0
            ) {
                darkness.fillRect(
                    fieldLeft,
                    worldY,
                    fieldRight -
                        fieldLeft,
                    bandHeight +
                        1,
                );

                continue;
            }

            const root =
                Math.sqrt(
                    discriminant,
                );

            const localX1 =
                (
                    -qb -
                    root
                ) /
                (
                    2 *
                    qa
                );

            const localX2 =
                (
                    -qb +
                    root
                ) /
                (
                    2 *
                    qa
                );

            const clearLeft =
                Phaser.Math.Clamp(
                    x +
                        Math.min(
                            localX1,
                            localX2,
                        ),
                    fieldLeft,
                    fieldRight,
                );

            const clearRight =
                Phaser.Math.Clamp(
                    x +
                        Math.max(
                            localX1,
                            localX2,
                        ),
                    fieldLeft,
                    fieldRight,
                );

            if (
                clearLeft >
                fieldLeft
            ) {
                darkness.fillRect(
                    fieldLeft,
                    worldY,
                    clearLeft -
                        fieldLeft,
                    bandHeight +
                        1,
                );
            }

            if (
                clearRight <
                fieldRight
            ) {
                darkness.fillRect(
                    clearRight,
                    worldY,
                    fieldRight -
                        clearRight,
                    bandHeight +
                        1,
                );
            }
        }

        /*
         * Light graphic may rotate; the GLOBAL darkness layer never does.
         */
        light
            .clear()
            .setDepth(
                25003,
            )
            .setPosition(
                x,
                y,
            )
            .setRotation(
                angle,
            )
            .setBlendMode(
                Phaser.BlendModes.ADD,
            )
            .setVisible(
                true,
            );

        light.fillStyle(
            0xffb830,
            0.035,
        );

        light.fillEllipse(
            0,
            0,
            major *
                1.34,
            minor *
                1.34,
        );

        light.fillStyle(
            0xffdf7a,
            0.040,
        );

        light.fillEllipse(
            0,
            0,
            major *
                1.08,
            minor *
                1.08,
        );

        /*
         * Tiny directional contrast lip:
         * enough to notice camouflage depth/shadow manually,
         * never a direct Hider marker.
         */
        light.fillStyle(
            0x3a2100,
            0.032,
        );

        light.fillEllipse(
            6,
            4,
            major *
                0.94,
            minor *
                0.94,
        );

        light.lineStyle(
            2,
            0xffefaa,
            0.72,
        );

        light.strokeEllipse(
            0,
            0,
            major,
            minor,
        );
    }



    private drawVulcanCooldownGauge(
        x: number,
        y: number,
    ): void {
        const g =
            this.vulcanCooldownGraphics;

        if (!g) {
            return;
        }

        g.clear();

        if (
            !this.vulcanActive ||
            this.phase !==
                'hunt' ||
            this.roundResultWinner !==
                null
        ) {
            g
                .setPosition(
                    0,
                    0,
                )
                .setVisible(
                    false,
                );

            return;
        }

        const t =
            Phaser.Math.Clamp(
                Math.hypot(
                    x -
                        480,
                    y -
                        270,
                ) /
                    Math.hypot(
                        480,
                        270,
                    ),
                0,
                1,
            );

        /*
         * Spotlight itself is now 2x.
         */
        const minor =
            Phaser.Math.Linear(
                144,
                86,
                t,
            );

        const width =
            112;

        const height =
            6;

        const barX =
            Phaser.Math.Clamp(
                x -
                    width /
                        2,
                10,
                950 -
                    width,
            );

        const barY =
            Phaser.Math.Clamp(
                y +
                    minor *
                        0.60 +
                    13,
                12,
                520,
            );

        /*
         * SAME value controls BOTH visual bar and actual fire eligibility.
         */
        const heat =
            Phaser.Math.Clamp(
                this.vulcanHeat,
                0,
                1,
            );

        /*
         * BRRRT vibration: shake the entire bar 1~2 px with each runtime frame.
         * Rest/cooling immediately returns it to the exact anchor.
         */
        if (
            this.vulcanFiring
        ) {
            g.setPosition(
                Phaser.Math.Between(
                    -2,
                    2,
                ),
                Phaser.Math.Between(
                    -2,
                    2,
                ),
            );
        } else {
            g.setPosition(
                0,
                0,
            );
        }

        g.setVisible(
            true,
        );

        g.fillStyle(
            0x050709,
            0.92,
        );

        g.fillRoundedRect(
            barX -
                3,
            barY -
                3,
            width +
                6,
            height +
                6,
            4,
        );

        const color =
            this.vulcanOverheated
                ? 0xff2822
                : heat >
                    0.72
                    ? 0xff6c26
                    : heat >
                        0.38
                        ? 0xffc52e
                        : 0x7ee06b;

        if (
            heat >
            0.001
        ) {
            g.fillStyle(
                color,
                0.99,
            );

            g.fillRoundedRect(
                barX,
                barY,
                width *
                    heat,
                height,
                2,
            );
        }

        g.lineStyle(
            this.vulcanOverheated
                ? 2
                : 1,
            this.vulcanOverheated
                ? 0xff5248
                : 0xffedb0,
            0.94,
        );

        g.strokeRoundedRect(
            barX,
            barY,
            width,
            height,
            2,
        );

        /*
         * Tiny hot marker at the exact maximum.
         */
        if (
            heat >=
                0.995
        ) {
            g.fillStyle(
                0xffffff,
                0.92,
            );

            g.fillCircle(
                barX +
                    width,
                barY +
                    height /
                        2,
                2.4,
            );
        }
    }

    private playVulcanSearchlightPop(): void {
        if (!this.audioUnlocked || !this.bgmEnabled) return;

        try {
            const manager =
                this.sound as unknown as {
                    context?: AudioContext;
                };

            const context =
                manager.context;

            if (!context) return;

            const now =
                context.currentTime;

            const master =
                context.createGain();

            master.gain
                .setValueAtTime(
                    0.0001,
                    now,
                );

            master.gain
                .exponentialRampToValueAtTime(
                    0.58,
                    now + 0.004,
                );

            master.gain
                .exponentialRampToValueAtTime(
                    0.0001,
                    now + 0.24,
                );

            master.connect(
                context.destination,
            );

            const click =
                context.createOscillator();

            click.type =
                'square';

            click.frequency
                .setValueAtTime(
                    1380,
                    now,
                );

            click.frequency
                .exponentialRampToValueAtTime(
                    190,
                    now + 0.11,
                );

            click.connect(
                master,
            );

            click.start(
                now,
            );

            click.stop(
                now + 0.13,
            );

            const boom =
                context.createOscillator();

            boom.type =
                'sine';

            boom.frequency
                .setValueAtTime(
                    150,
                    now,
                );

            boom.frequency
                .exponentialRampToValueAtTime(
                    55,
                    now + 0.19,
                );

            boom.connect(
                master,
            );

            boom.start(
                now,
            );

            boom.stop(
                now + 0.21,
            );
        } catch {
            // Searchlight ignition sound is optional.
        }
    }

    private playVulcanTransitionWhoosh(): void {
        if (!this.audioUnlocked || !this.bgmEnabled) return;
        try {
            const manager = this.sound as unknown as { context?: AudioContext };
            const context = manager.context;
            if (!context) return;
            const now = context.currentTime;
            const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.75), context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i=0;i<data.length;i+=1) data[i] = (Math.random()*2-1) * Math.sin(Math.PI * i/data.length);
            const src = context.createBufferSource(); src.buffer = buffer;
            const filter = context.createBiquadFilter(); filter.type='bandpass'; filter.Q.value=0.7;
            filter.frequency.setValueAtTime(240,now); filter.frequency.exponentialRampToValueAtTime(1550,now+0.62);
            const gain = context.createGain(); gain.gain.setValueAtTime(0.0001,now); gain.gain.linearRampToValueAtTime(0.34,now+0.18); gain.gain.exponentialRampToValueAtTime(0.0001,now+0.74);
            src.connect(filter); filter.connect(gain); gain.connect(context.destination); src.start(now); src.stop(now+0.75);
        } catch {}
    }


    private playVulcanGunPulse(): void {
        if (
            !this.audioUnlocked
        ) {
            return;
        }

        try {
            const manager =
                this.sound as unknown as {
                    context?: AudioContext;
                };

            const context =
                manager.context;

            if (!context) {
                return;
            }

            const now =
                context.currentTime;

            /*
             * Short hard mechanical transient.
             */
            const gain =
                context.createGain();

            gain.gain
                .setValueAtTime(
                    0.0001,
                    now,
                );

            gain.gain
                .exponentialRampToValueAtTime(
                    0.34,
                    now +
                        0.002,
                );

            gain.gain
                .exponentialRampToValueAtTime(
                    0.0001,
                    now +
                        0.075,
                );

            gain.connect(
                context.destination,
            );

            const oscillator =
                context.createOscillator();

            oscillator.type =
                'square';

            oscillator.frequency
                .setValueAtTime(
                    128,
                    now,
                );

            oscillator.frequency
                .exponentialRampToValueAtTime(
                    72,
                    now +
                        0.065,
                );

            oscillator.connect(
                gain,
            );

            oscillator.start(
                now,
            );

            oscillator.stop(
                now +
                    0.078,
            );

            /*
             * Metallic/noisy "dadada" body.
             */
            const length =
                Math.max(
                    1,
                    Math.floor(
                        context.sampleRate *
                            0.07,
                    ),
                );

            const buffer =
                context.createBuffer(
                    1,
                    length,
                    context.sampleRate,
                );

            const channel =
                buffer.getChannelData(
                    0,
                );

            for (
                let index = 0;
                index <
                channel.length;
                index += 1
            ) {
                const envelope =
                    1 -
                    index /
                        channel.length;

                channel[
                    index
                ] =
                    (
                        Math.random() *
                            2 -
                        1
                    ) *
                    envelope;
            }

            const noise =
                context.createBufferSource();

            noise.buffer =
                buffer;

            const filter =
                context.createBiquadFilter();

            filter.type =
                'bandpass';

            filter.frequency.value =
                980;

            filter.Q.value =
                0.72;

            const noiseGain =
                context.createGain();

            noiseGain.gain
                .setValueAtTime(
                    0.20,
                    now,
                );

            noiseGain.gain
                .exponentialRampToValueAtTime(
                    0.0001,
                    now +
                        0.07,
                );

            noise.connect(
                filter,
            );

            filter.connect(
                noiseGain,
            );

            noiseGain.connect(
                context.destination,
            );

            noise.start(
                now,
            );

            noise.stop(
                now +
                    0.072,
            );
        } catch {
            // Procedural weapon SFX is non-critical.
        }
    }

    private enterVulcanSpectatorView(
        sessionId: string,
    ): void {
        this.ensureVulcanRuntimeTimer();

        if (
            this.phase !==
            'hunt'
        ) {
            return;
        }

        this.vulcanSpectatorViewActive =
            true;

        this.vulcanSpectatorSessionId =
            sessionId;


        this.vulcanOrbitStartedAt =
            this.time.now;

        const remoteAim =
            this.remoteVulcanAimBySessionId
                .get(
                    sessionId,
                );

        this.vulcanTargetX =
            remoteAim?.x ??
            480;

        this.vulcanTargetY =
            remoteAim?.y ??
            270;

        this.vulcanDisplayX =
            this.vulcanTargetX;

        this.vulcanDisplayY =
            this.vulcanTargetY;

        /*
         * IMPORTANT:
         * Hider spectator must see the Hunter's AIR SUPPORT view,
         * not the Hunter character's frozen body camera.
         */
        const camera =
            this.cameras.main;

        camera
            .stopFollow()
            .removeBounds()
            .setSize(
                this.gameWidth,
                this.gameHeight,
            )
            .setZoom(
                1.34,
            )
            .centerOn(
                480,
                270,
            )
            .setRotation(
                0,
            );

        this.hiderVisionGraphics
            ?.clear()
            .setVisible(false);

        this.hiderVisionOverlays
            .forEach(
                (overlay) =>
                    overlay
                        .setVisible(false),
            );

        this.vulcanDarkness
            ?.setVisible(
                true,
            );

        this.vulcanSpotlight
            ?.setVisible(
                true,
            );

        this.drawVulcanSpotlight(
            this.vulcanDisplayX,
            this.vulcanDisplayY,
        );

        /*
         * Hider only watches the shared lamp; no firing/HEAT controls.
         */
        this.vulcanCooldownGraphics
            ?.clear()
            .setVisible(false);
    }

    private exitVulcanSpectatorView(): void {
        if (!this.vulcanSpectatorViewActive) return;

        this.vulcanSpectatorViewActive = false;
        this.vulcanSpectatorSessionId = '';
        this.vulcanSpotlight?.clear().setVisible(false);
        this.vulcanDarkness?.clear().setVisible(false);
        this.vulcanCooldownGraphics?.clear().setVisible(false);
        this.cameras.main.setRotation(0);

        if (!this.vulcanActive) {
            this.cameras.main.setZoom(this.vulcanSavedCameraZoom);
            this.ensureGameplayCameraFollow();
        }
    }

    private exitVulcanCinematic(): void {




        this.remoteVulcanFiringSessionIds
            .clear();


        this.removeVulcanDomInputBridge();

        if (
            !this.vulcanSpectatorViewActive
        ) {
            this.stopVulcanRuntimeTimer();
        }

        this.vulcanCinematicActive = false;
        this.vulcanDarkness?.clear().setVisible(false);
        this.vulcanSpotlight?.clear().setVisible(false);
        this.vulcanCooldownGraphics?.clear().setVisible(false);
        this.vulcanCinematicShade?.setVisible(false).setAlpha(0);
        this.vulcanImpactFx.forEach((fx) => fx.destroy());
        this.vulcanImpactFx.clear();
        this.vulcanFiring = false;
        this.vulcanPointerHeld = false;
        this.vulcanHelicopterRotorTween?.stop();
        this.vulcanHelicopterRotorTween = undefined;
        this.vulcanHelicopter?.destroy(true);
        this.vulcanHelicopter = undefined;
        this.sniperHelicopterSound?.stop();
        this.cameras.main.setRotation(this.vulcanSavedCameraRotation);
        this.cameras.main.setZoom(this.vulcanSavedCameraZoom);
        this.ensureGameplayCameraFollow();
        if (this.phase === 'hunt') {
            const localRole = multiplayerClient.getLocalPlayer()?.role ?? this.networkPlayerManager?.getLocalRole?.();
            if (localRole === 'hunter' || this.practiceMode === 'hunter') {
                this.hunterWeaponHudContainer?.setVisible(true);
            }
        }
    }

    private refreshSniperSupportUi(): void {
        /*
         * V521 TACTICAL_CHOICE_LATCH:
         * one press = both support choices are gone until the next Hunt.
         */
        if (
            this.tacticalSupportChosenThisHunt
        ) {
            this.sniperButton
                ?.disableInteractive()
                .setVisible(false);

            this.vulcanButton
                ?.disableInteractive()
                .setVisible(false);

            return;
        }


        /*
         * V518: tactical choice UI belongs ONLY to Hunt.
         * Prevent stale Vulcan button from surviving into result/lobby.
         */
        if (
            this.phase !==
                'hunt' ||
            this.roundResultWinner !==
                null ||
            Boolean(
                multiplayerClient.getRoom()
                    ?.state.winner,
            )
        ) {
            this.sniperButton
                ?.disableInteractive()
                .setVisible(false);

            this.vulcanButton
                ?.disableInteractive()
                .setVisible(false);

            return;
        }


        this.applyTacticalSupportInputLock();

        if (
            this.phase === 'hunt' &&
            (
                !this.sniperButton ||
                !this.sniperRadioText
            )
        ) {
            this.ensureSniperSupportUi();
        }

        if (
            !this.sniperButton ||
            !this.sniperButtonText ||
            !this.sniperButtonBg ||
            !this.sniperRadioText
        ) {
            return;
        }

        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        const managerLocalRole =
            this.networkPlayerManager
                ?.getLocalRole?.();

        /*
         * V1010492B_PRACTICE_SNIPER_ELIGIBLE
         */
        const hunter =
            this.phase === 'hunt' &&
            (
                this.practiceMode ===
                    'hunter' ||
                localRole ===
                    'hunter' ||
                managerLocalRole ===
                    'hunter'
            );

        const remainingMs =
            Math.max(
                0,
                this.phaseEndTime -
                    this.time.now,
            );

        this.sniperAvailable =
            hunter &&
            remainingMs <= 30000;

        let hudX =
            this.gameWidth / 2;

        let hudY =
            this.gameHeight / 2 + 58;

        const localPosition =
            this.networkPlayerManager
                ?.getLocalPlayerPosition?.();

        if (localPosition) {
            const camera =
                this.cameras.main;

            const topLeft =
                camera.getWorldPoint(
                    0,
                    0,
                );

            hudX =
                (
                    localPosition.x -
                    topLeft.x
                ) *
                camera.zoom;

            hudY =
                (
                    localPosition.y -
                    topLeft.y
                ) *
                camera.zoom +
                (
                    this.mobileControlsEnabled
                        ? 58
                        : 52
                );
        }

        const warning =
            hunter &&
            remainingMs <= 35000 &&
            remainingMs > 30000;

        if (warning) {
            const seconds =
                Math.max(
                    1,
                    Math.ceil(
                        (
                            remainingMs -
                            30000
                        ) /
                        1000,
                    ),
                );

            if (
                seconds !==
                this.sniperRadioLastSecond
            ) {
                this.sniperRadioLastSecond =
                    seconds;

                this.tweens
                    .killTweensOf(
                        this.sniperRadioText,
                    );

                this.sniperRadioText
                    .setScale(1)
                    .setAlpha(1)
                    .setText(
                        this.getSniperRadioMessage(
                            seconds,
                        ),
                    );
            }

            const halfText =
                Math.max(
                    70,
                    this.sniperRadioText
                        .width / 2,
                );

            this.sniperRadioText
                .setPosition(
                    Phaser.Math.Clamp(
                        hudX,
                        halfText + 8,
                        this.gameWidth -
                            halfText -
                            8,
                    ),
                    Phaser.Math.Clamp(
                        hudY,
                        20,
                        this.gameHeight - 20,
                    ),
                )
                .setVisible(true);

            this.sniperButton
                .disableInteractive()
                .setVisible(false);
            this.vulcanButton?.disableInteractive().setVisible(false);

            return;
        }

        this.sniperRadioText
            .setVisible(false);

        if (
            !this.sniperAvailable ||
            this.sniperActive ||
            this.vulcanActive ||
            this.vulcanSupportCommitted
        ) {
            this.sniperButton
                .disableInteractive()
                .setVisible(false);
            this.vulcanButton?.disableInteractive().setVisible(false);
        } else {
            const halfW =
                176 / 2;
            const halfH =
                44 / 2;

            this.sniperButton
                .setPosition(
                    Phaser.Math.Clamp(
                        hudX,
                        halfW + 10,
                        this.gameWidth -
                            halfW -
                            10,
                    ),
                    Phaser.Math.Clamp(
                        hudY + 2,
                        halfH + 10,
                        this.gameHeight -
                            halfH -
                            10,
                    ),
                );

            const language =
                getLanguage();

            this.sniperButtonText
                .setText(
                    language === 'ja'
                        ? '🎯 狙撃モード切替'
                        : language === 'en'
                            ? '🎯 SNIPER MODE'
                            : language === 'zh'
                                ? '🎯 狙击模式'
                                : '🎯 저격 모드 전환',
                );

            this.sniperButtonBg
                .setFillStyle(
                    0x183428,
                    0.98,
                );

            /*
             * V1010490_SUPPORT_INPUT_LIFECYCLE
             */
            if (this.sniperButton.input) {
                this.sniperButton.input.enabled =
                    true;
            } else {
                this.sniperButton.setInteractive({
                    useHandCursor:
                        true,
                });
            }

            const wasHidden =
                !this.sniperButton.visible;

            this.sniperButton
                .setDepth(25020)
                .setVisible(true);

            this.vulcanButtonText?.setText(
                language === 'ja' ? '🚁 バルカン航空支援'
                    : language === 'en' ? '🚁 VULCAN AIR SUPPORT'
                    : language === 'zh' ? '🚁 火神空中支援'
                    : '🚁 발칸 공중지원',
            );
            this.vulcanButton
                ?.setPosition(
                    this.sniperButton.x,
                    this.sniperButton.y + 46,
                )
                .setDepth(25020)
                .setVisible(!this.vulcanSupportCommitted);

            if (this.vulcanButton?.visible) {
                const sniperBounds = this.sniperButton.getBounds();
                const vulcanBounds = this.vulcanButton.getBounds();
                const exactTop = sniperBounds.bottom + 2;
                this.vulcanButton.y += exactTop - vulcanBounds.top;
            }
            if (this.vulcanButton?.input) this.vulcanButton.input.enabled = !this.vulcanSupportCommitted;

            if (wasHidden) {
                window.setTimeout(() => {
                    if (!this.sniperButton?.visible) return;

                    let blink = 0;
                    const timer = window.setInterval(() => {
                        if (!this.sniperButton?.visible || blink >= 8) {
                            window.clearInterval(timer);
                            this.sniperButton?.setVisible(false);
                            return;
                        }

                        this.sniperButton.setAlpha(
                            blink % 2 === 0 ? 0.25 : 1
                        );
                        blink++;
                    },150);
                },10000);

                if (!this.sniperDiscoveryBubbleShown) {
                    this.sniperDiscoveryBubbleShown = true;
                    this.showFeatureDiscoveryBubble('sniper');
                }
            }
        }

        this.sniperScope
            ?.setVisible(
                this.sniperActive,
            );
    }

    private fireShotgun(
        aimAngleOverride?: number,
        explicitMobileFire =
            false,
    ): void {
        /*
         * V1010457_SNIPER_FINAL_FLOW_REWORK
         * Phaser may deliver the same pointerdown to world shooting after a UI
         * Container handler. A support-button press may NEVER cost shotgun ammo.
         */
        if (
            Date.now() <
            this.sniperButtonPressBlockUntil
        ) {
            return;
        }

        if (this.vulcanActive) return;

        if (this.sniperActive) {
            if (explicitMobileFire) {
                this.fireSniperAtCurrentAim();
            }
            return;
        }

        /*
         * Mobile contract is strict:
         * only the red FIRE button may create a shot. Any accidental Phaser
         * world pointerdown / synthetic mouse event / stale touch is ignored.
         */
        if (
            this.mobileControlsEnabled &&
            !explicitMobileFire
        ) {
            return;
        }

        /*
         * POINTER_DOWN 이외의 경로/phase 전환 직후 이벤트가 들어와도
         * Hider는 절대로 shotgun SFX/발사 로직에 진입하지 않습니다.
         */
        if (
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (
            this.isMultiplayerSession() &&
            this.phase === 'hunt' &&
            this.phaseEndTime > 0 &&
            this.time.now >=
                this.phaseEndTime
        ) {
            this.canShoot = false;
            this.clearAllAimingVisuals();
            return;
        }

        if (
            this.isMultiplayerSession() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        if (
            multiplayerClient.isConnected() &&
            !this.networkPlayerManager
                .canLocalControlHunter()
        ) {
            return;
        }

        if (!this.canShoot) {
            return;
        }

if (
            multiplayerClient.isConnected() ||
            this.practiceMode ===
                'hunter'
        ) {
            if (
                Date.now() <
                this.weaponOverheatedUntil
            ) {
                this.showStatus(
                    `⚠ ${tr('샷건 과열! 잠시 식힌 후 발사하세요')}`,
                );
                return;
            }

            if (
                this.practiceMode ===
                    'hunter'
            ) {
                const now =
                    Date.now();

                const cooledHeat =
                    Phaser.Math.Clamp(
                        this.weaponHeat -
                            Math.max(
                                0,
                                now -
                                    this.weaponHeatUpdatedAt,
                            ) *
                            this.practiceHeatCooldownPerMs,
                        0,
                        100,
                    );

                /*
                 * V1010464_UNLIMITED_AMMO_HUD_VICTORY_CAMERA_FIX: unlimited shells; HEAT remains the shotgun limiter.
                 */
this.weaponHeat =
                    Math.min(
                        100,
                        cooledHeat +
                            this.practiceHeatPerShot,
                    );

                if (
                    this.weaponHeat >=
                    100
                ) {
                    this.weaponOverheatedUntil =
                        now +
                        this.practiceOverheatDurationMs;
                }

                this.weaponHeatUpdatedAt =
                    now;

                this.updateWeaponHeatHud();
            }
        } else {
            if (this.isReloading) {
                this.showStatus(
                    tr('재장전 중입니다'),
                );
                return;
            }

            if (this.ammo <= 0) {
                this.showStatus(
                    tr('탄약이 없습니다. R 버튼을 눌러서 장전하세요'),
                );
                return;
            }

            this.ammo -= 1;
            this.updateAmmoText();
        }

        this.canShoot = false;

        if (
            !multiplayerClient.isConnected()
        ) {
            this.sound.play(
                'shotgun-blast',
                {
                    volume: 1.0,
                },
            );
        }

        const pointer =
            this.input.activePointer;

        const origin =
            multiplayerClient.isConnected()
                ? this.networkPlayerManager
                    .getLocalPlayerPosition()
                : new Phaser.Math.Vector2(
                    this.player.x,
                    this.player.y,
                );

        if (!origin) {
            return;
        }

        const aimAngle =
            aimAngleOverride ??
            (
                this.mobileControlsEnabled &&
                (
                    this.practiceMode ===
                        'hunter' ||
                    this.networkPlayerManager
                        .canLocalControlHunter()
                ) &&
                this.mobileAimHasDirection
                    ? this.mobileAimAngle
                    : (
                        !this.mobileControlsEnabled
                            ? (() => {
                                const desktopAimWorld =
                                    this.getPointerWorldPoint(
                                        pointer,
                                    );

                                return Phaser.Math.Angle.Between(
                                    origin.x,
                                    origin.y,
                                    desktopAimWorld.x,
                                    desktopAimWorld.y,
                                );
                            })()
                            : Phaser.Math.Angle.Between(
                                origin.x,
                                origin.y,
                                pointer.worldX,
                                pointer.worldY,
                            )
                    )
            );

        const muzzleDistance = 28;

        const muzzleX =
            origin.x +
            Math.cos(aimAngle) * muzzleDistance;

        const muzzleY =
            origin.y +
            Math.sin(aimAngle) * muzzleDistance;

        if (
            multiplayerClient.isConnected()
        ) {
            multiplayerClient.sendFireShot(
                aimAngle,
            );
        } else {
            this.createMuzzleFlash(
                muzzleX,
                muzzleY,
            );

            const hitHiders =
                this.createPellets(
                    muzzleX,
                    muzzleY,
                    aimAngle,
                );

            if (
                hitHiders.size >
                    0 &&
                this.practiceMode !==
                    'hunter'
            ) {
                this.showHitMarker();
            }

            hitHiders.forEach(
                (hider) => {
                    this.hitHider(
                        hider,
                    );
                },
            );

            if (
                this.getAliveHiderCount() ===
                0
            ) {
                this.showHunterVictory();
                return;
            }

}

        this.cameras.main.shake(
            90,
            0.004,
        );

        if (
            !multiplayerClient.isConnected() &&
            this.practiceMode !==
                'hunter' &&
            this.ammo === 0
        ) {
            this.showStatus(
                tr('탄약 소진! R 키로 재장전'),
            );
        }

        this.time.delayedCall(
            this.shotCooldown,
            () => {
                if (
                    this.phase === 'hunt' &&
                    !this.isReloading
                ) {
                    this.canShoot = true;
                }
            },
        );
    }

    private applyNetworkShot(
        shot: NetworkShotFired,
    ): void {
        /*
         * Preserve authoritative reserve bookkeeping below, but queued visual
         * events from a hidden tab must not explode after focus returns.
         */
        const suppressShotFeedback =
            this.shouldSuppressOneShotAudio();

        if (
            shot.shooterId ===
                multiplayerClient.getSessionId() &&
            shot.precisionReward > 0
        ) {
            /*
             * Precision 숫자 표시는 직관적이지 않아 UI에서 제거했습니다.
             * 서버가 지급한 reserve 보상만 반영합니다.
             */
        }

        if (
            suppressShotFeedback
        ) {
            return;
        }

        if (
            this.shotgunSound &&
            !this.shotgunSound.isPlaying
        ) {
            this.shotgunSound.play();
        } else {
            this.sound.play(
                'shotgun-blast',
                {
                    volume: 1.0,
                },
            );
        }
        this.createMuzzleFlash(
            shot.startX,
            shot.startY,
        );

        shot.pellets.forEach(
            (pellet) => {
                this.createPelletTrail(
                    new Phaser.Geom.Line(
                        shot.startX,
                        shot.startY,
                        pellet.endX,
                        pellet.endY,
                    ),
                );
            },
        );

        if (
            shot.hitIds.length > 0 &&
            shot.shooterId ===
                multiplayerClient
                    .getSessionId()
        ) {
            this.showHitMarker();

            if (
                multiplayerClient
                    .getLocalPlayer()
                    ?.role === 'hunter'
            ) {
                this.hunterHitConfirmSound?.play();
            }
        }

        if (
            shot.hitIds.includes(
                multiplayerClient.getSessionId() ?? '',
            ) &&
            multiplayerClient.getLocalPlayer()?.role === 'hider'
        ) {
            this.hitSound?.play();
        }

        this.cameras.main.shake(
            70,
            0.003,
        );
    }

    private createPellets(
        startX: number,
        startY: number,
        aimAngle: number,
    ): Set<Hider> {
        const hitHiders = new Set<Hider>();

        for (
            let index = 0;
            index < this.pelletCount;
            index += 1
        ) {
            const ratio =
                index / (this.pelletCount - 1);

            const spreadOffset = Phaser.Math.Linear(
                -this.pelletSpread / 2,
                this.pelletSpread / 2,
                ratio,
            );

            const randomOffset =
                Phaser.Math.FloatBetween(
                    -0.025,
                    0.025,
                );

            const pelletAngle =
                aimAngle +
                spreadOffset +
                randomOffset;

            const range = Phaser.Math.Between(
                Math.floor(
                    this.pelletRange * 0.82,
                ),
                this.pelletRange,
            );

            const originalEndX =
                startX +
                Math.cos(pelletAngle) * range;

            const originalEndY =
                startY +
                Math.sin(pelletAngle) * range;

            const blockedEnd =
                this.getBlockedPelletEnd(
                    startX,
                    startY,
                    originalEndX,
                    originalEndY,
                );

            const pelletLine = new Phaser.Geom.Line(
                startX,
                startY,
                blockedEnd.x,
                blockedEnd.y,
            );

            this.createPelletTrail(pelletLine);

            this.hiders.forEach((hider) => {
                if (
                    !hider.alive ||
                    hitHiders.has(hider)
                ) {
                    return;
                }

                const wasHit =
                    this.getAllPartObjects(hider).some(
                        (part) =>
                            Phaser.Geom.Intersects.LineToRectangle(
                                pelletLine,
                                part.getBounds(),
                            ),
                    );

                if (wasHit) {
                    hitHiders.add(hider);
                }
            });
        }

        return hitHiders;
    }

    private getBlockedPelletEnd(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): Phaser.Math.Vector2 {
        const distance =
            Phaser.Math.Distance.Between(
                startX,
                startY,
                endX,
                endY,
            );

        const stepSize = 4;

        const stepCount = Math.ceil(
            distance / stepSize,
        );

        for (
            let step = 1;
            step <= stepCount;
            step += 1
        ) {
            const ratio = step / stepCount;

            const currentX = Phaser.Math.Linear(
                startX,
                endX,
                ratio,
            );

            const currentY = Phaser.Math.Linear(
                startY,
                endY,
                ratio,
            );

            const blocked = this.obstacles.some(
                (obstacle) =>
                    Phaser.Geom.Rectangle.Contains(
                        obstacle.bounds,
                        currentX,
                        currentY,
                    ),
            );

            if (blocked) {
                return new Phaser.Math.Vector2(
                    currentX,
                    currentY,
                );
            }
        }

        return new Phaser.Math.Vector2(
            endX,
            endY,
        );
    }

    private createPelletTrail(
        line: Phaser.Geom.Line,
    ): void {
        const trail =
            this.trackTransientGameplayVfx(
                this.add.graphics(),
            );

        trail.setDepth(50);
        trail.lineStyle(2, 0xfff4c2, 0.85);

        trail.lineBetween(
            line.x1,
            line.y1,
            line.x2,
            line.y2,
        );

        this.tweens.add({
            targets: trail,
            alpha: 0,
            duration: 130,
            onComplete: () => {
                trail.destroy();
            },
        });
    }

    private createMuzzleFlash(
        x: number,
        y: number,
    ): void {
        const flash =
            this.trackTransientGameplayVfx(
                this.add.circle(
                    x,
                    y,
                    12,
                    0xffd54f,
                    0.9,
                ),
            );

        flash.setDepth(60);

        this.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 100,
            onComplete: () => {
                flash.destroy();
            },
        });
    }

    private showPracticeHunterHitEffect(
        hider:
            Hider,
    ): void {
        /*
         * Reuse the real-match Hunter confirmation sound.
         * Practice has no server shot event, so applyNetworkShot() never
         * reaches this branch unless we explicitly mirror it here.
         */
        this.hunterHitConfirmSound
            ?.play();

        /*
         * The victim-side hit sound is also useful in solo training and
         * gives the shot a stronger, game-identical impact layer.
         */
        this.hitSound
            ?.play();

        const x =
            hider.centerX;
        const y =
            hider.centerY;

        /*
         * Mobile activePointer is often the FIRE button, so the normal
         * showHitMarker() can appear near the UI instead of the victim.
         * Draw the same X-style hit marker at the actual bot coordinate.
         */
        const marker =
            this.add.graphics()
                .setDepth(
                    1800,
                );

        const inner =
            7;
        const outer =
            18;

        marker.lineStyle(
            4,
            0xffffff,
            1,
        );

        marker.lineBetween(
            x -
                outer,
            y -
                outer,
            x -
                inner,
            y -
                inner,
        );
        marker.lineBetween(
            x +
                inner,
            y +
                inner,
            x +
                outer,
            y +
                outer,
        );
        marker.lineBetween(
            x +
                outer,
            y -
                outer,
            x +
                inner,
            y -
                inner,
        );
        marker.lineBetween(
            x -
                inner,
            y +
                inner,
            x -
                outer,
            y +
                outer,
        );

        /*
         * Short red/white impact pulse around the production Hider.
         */
        const impact =
            this.add.circle(
                x,
                y,
                24,
                0xff5b57,
                0.28,
            )
                .setStrokeStyle(
                    4,
                    0xffffff,
                    0.95,
                )
                .setDepth(
                    1799,
                );

        this.tweens.add({
            targets:
                marker,
            alpha:
                0,
            scale:
                1.3,
            duration:
                190,
            ease:
                'Quad.easeOut',
            onComplete:
                () => {
                    marker.destroy();
                },
        });

        this.tweens.add({
            targets:
                impact,
            alpha:
                0,
            scale:
                1.65,
            duration:
                220,
            ease:
                'Quad.easeOut',
            onComplete:
                () => {
                    impact.destroy();
                },
        });

        /*
         * Small pixel fragments make the camouflage "pop" when discovered
         * without changing any hit/gameplay logic.
         */
        for (
            let index = 0;
            index <
            8;
            index += 1
        ) {
            const angle =
                (
                    Math.PI *
                    2 *
                    index
                ) /
                8 +
                Phaser.Math.FloatBetween(
                    -0.18,
                    0.18,
                );

            const distance =
                Phaser.Math.Between(
                    22,
                    42,
                );

            const particle =
                this.add.rectangle(
                    x,
                    y,
                    Phaser.Math.Between(
                        3,
                        6,
                    ),
                    Phaser.Math.Between(
                        3,
                        6,
                    ),
                    index %
                        2 ===
                        0
                        ? 0xffffff
                        : 0xff6b64,
                    0.95,
                )
                    .setDepth(
                        1801,
                    );

            this.tweens.add({
                targets:
                    particle,
                x:
                    x +
                    Math.cos(
                        angle,
                    ) *
                    distance,
                y:
                    y +
                    Math.sin(
                        angle,
                    ) *
                    distance,
                alpha:
                    0,
                scale:
                    0.4,
                duration:
                    Phaser.Math.Between(
                        180,
                        260,
                    ),
                ease:
                    'Quad.easeOut',
                onComplete:
                    () => {
                        particle.destroy();
                    },
            });
        }

        /*
         * Real network shots shake the camera on impact as well.
         */
        this.cameras.main.shake(
            90,
            0.0055,
        );
    }

    private hitHider(hider: Hider): void {
        if (!hider.alive) {
            return;
        }

        hider.alive = false;

        if (
            this.practiceMode ===
                'hunter'
        ) {
            this.showPracticeHunterHitEffect(
                hider,
            );

            const index =
                this.hiders.indexOf(
                    hider,
                );

            if (
                index >=
                0
            ) {
                this.networkPlayerManager
                    .setPracticePlayerAlive(
                        this.getPracticeBotSessionId(
                            index,
                        ),
                        false,
                    );
            }
        }

        const targets: Phaser.GameObjects.GameObject[] = [
            ...this.getAllPartObjects(hider),
            hider.paintTexture,
            hider.label,
        ];

        hider.label
            .setText(tr('FOUND!'))
            .setColor('#ff6b6b');

        this.tweens.add({
            targets,
            alpha: 0,
            scale: 1.18,
            duration: 350,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.getAllPartObjects(hider).forEach(
                    (object) => {
                        object.setVisible(false);
                    },
                );

                hider.paintTexture.setVisible(false);
                hider.label.setVisible(false);
            },
        });

        this.updateTargetText();

        if (
            this.practiceMode ===
                'hunter'
        ) {
            this.updateSurvivalHud();
        }
    }

    private reload(): void {
        if (this.phase !== 'hunt') {
            return;
        }

        if (this.isReloading) {
            this.showStatus(
                tr('이미 재장전 중입니다'),
            );

            return;
        }

        if (this.ammo === this.maxAmmo) {
            this.showStatus(
                tr('탄약이 이미 가득합니다'),
            );

            return;
        }

        this.isReloading = true;
        this.canShoot = false;

        this.updateAmmoText();
        this.showStatus(tr('재장전 중...'));

        this.time.delayedCall(
            this.reloadDuration,
            () => {
                if (this.phase !== 'hunt') {
                    this.isReloading = false;
                    return;
                }

                this.ammo = this.maxAmmo;
                this.isReloading = false;
                this.canShoot = true;

                this.updateAmmoText();
                this.showStatus(tr('재장전 완료!'));
            },
        );
    }

    /*
     * Hit marker
     */

    private createHitMarker(): void {
        this.hitMarker = this.add.graphics();

        this.hitMarker.setDepth(150);
        this.hitMarker.setVisible(false);
    }

    private showHitMarker(): void {
        const pointer =
            this.input.activePointer;

        const centerX = pointer.worldX;
        const centerY = pointer.worldY;

        const innerDistance = 6;
        const outerDistance = 15;

        this.hitMarker.clear();
        this.hitMarker.lineStyle(
            3,
            0xffffff,
            1,
        );

        this.hitMarker.lineBetween(
            centerX - outerDistance,
            centerY - outerDistance,
            centerX - innerDistance,
            centerY - innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX + outerDistance,
            centerY - outerDistance,
            centerX + innerDistance,
            centerY - innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX - outerDistance,
            centerY + outerDistance,
            centerX - innerDistance,
            centerY + innerDistance,
        );

        this.hitMarker.lineBetween(
            centerX + outerDistance,
            centerY + outerDistance,
            centerX + innerDistance,
            centerY + innerDistance,
        );

        this.hitMarker.setVisible(true);
        this.hitMarker.setAlpha(1);
        this.hitMarker.setScale(1);

        this.tweens.killTweensOf(
            this.hitMarker,
        );

        this.tweens.add({
            targets: this.hitMarker,
            alpha: 0,
            scale: 1.35,
            duration: 180,
            onComplete: () => {
                this.hitMarker.setVisible(false);
            },
        });
    }

    /*
     * Keyboard
     */

    private createKeyboardControls(): void {
        const keyboard = this.input.keyboard;

        if (!keyboard) {
            throw new Error(
                tr('Keyboard input is unavailable.'),
            );
        }

        this.cursors =
            keyboard.createCursorKeys();

        this.moveUpKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.W,
        );

        this.moveDownKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.S,
        );

        this.moveLeftKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.A,
        );

        this.moveRightKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.D,
        );

        this.reloadKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.R,
        );
        this.brushPlusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.PLUS,
        );

        this.brushMinusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.MINUS,
        );

        this.brushNumpadPlusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD,
        );

        this.brushNumpadMinusKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT,
        );

        this.brushShapeKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.B,
        );

        this.spectatorKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.TAB,
        );

        this.undoPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.Z,
        );

        this.redoPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.Y,
        );

        this.shiftPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT,
        );

        this.fartKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE,
        );

        this.controlPaintKey = keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.CTRL,
        );

        keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.TAB,
            Phaser.Input.Keyboard.KeyCodes.Z,
            Phaser.Input.Keyboard.KeyCodes.Y,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);
    }

    /*
     * HUD
     */

    private createHud(): void {
        this.phaseText = this.add
            .text(
                this.gameWidth / 2,
                14,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 16,
                        y: 8,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(920);

        this.timerText = this.add
            .text(
                this.gameWidth / 2,
                108,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '22px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 14,
                        y: 7,
                    },
                },
            )
            .setOrigin(0.5, 0)
            .setDepth(3200);

        this.guideText = this.add
            .text(
                18,
                192,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 12,
                        y: 7,
                    },
                },
            )
            .setOrigin(0, 0)
            .setDepth(300);

        this.statusText = this.add
            .text(
                this.gameWidth / 2,
                150,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 10,
                        y: 6,
                    },
                },
            )
            .setOrigin(0.5)
            .setDepth(300)
            .setVisible(false);

        /*
         * 기존 ammoText는 오프라인 테스트 호환용으로만 남기고
         * Multiplayer Hunt에서는 보이지 않게 합니다.
         */
        this.ammoText = this.add
            .text(
                18,
                76,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                },
            )
            .setOrigin(0, 0)
            .setDepth(5000)
            .setScrollFactor(0)
            .setVisible(false);

        this.hunterAmmoGraphics =
            this.add.graphics();

        this.hunterHeatGraphics =
            this.add.graphics();

        this.hunterHeatLabel =
            this.add.text(
                0,
                18,
                tr('HEAT'),
                {
                    fontFamily:
                        'monospace',
                    fontSize: '13px',
                    fontStyle: 'bold',
                    color: '#17211c',
                    stroke: '#ffffff',
                    strokeThickness: 3,
                },
            )
                .setOrigin(0, 0.5);

        this.hunterOverheatLabel =
            this.add.text(
                220,
                18,
                '',
                {
                    fontFamily:
                        'monospace',
                    fontSize: '12px',
                    fontStyle: 'bold',
                    color: '#d32f2f',
                    stroke: '#ffffff',
                    strokeThickness: 4,
                },
            )
                .setOrigin(1, 0.5);

        const weaponHudBackground =
            this.add.rectangle(
                110,
                17,
                230,
                42,
                0xfff8e8,
                0.985,
            )
                .setOrigin(0.5)
                .setStrokeStyle(
                    3,
                    0xffffff,
                    1,
                );

        this.hunterWeaponHudContainer =
            this.add.container(
                18,
                18,
                [
                    weaponHudBackground,
                    this.hunterAmmoGraphics,
                    this.hunterHeatGraphics,
                    this.hunterHeatLabel,
                    this.hunterOverheatLabel,
                ],
            )
                /*
                 * v0.10.10.184:
                 * Keep weapon feedback above every darkness / vision layer.
                 */
                .setDepth(25000)
                .setScrollFactor(0)
                .setVisible(false);

        this.fartGaugeGraphics = this.add.graphics();
        this.fartGaugeLabel = this.add.text(
            0,
            13,
            '💨 GAS',
            {
                fontFamily: 'monospace',
                fontSize: '12px',
                fontStyle: 'bold',
                color: '#17211c',
                stroke: '#ffffff',
                strokeThickness: 3,
            },
        ).setOrigin(0, 0.5);

        /*
         * Same 230px card width as weapon HUD. The actual GAS bar below uses
         * the exact HEAT x/width/height for visual rhythm.
         */
        const fartBg = this.add.rectangle(
            110,
            17,
            230,
            36,
            0xfff8e8,
            0.975,
        )
            .setOrigin(0.5)
            .setStrokeStyle(
                2,
                0xffffff,
                1,
            );
        this.fartHudContainer = this.add.container(18, 68, [
            fartBg, this.fartGaugeGraphics, this.fartGaugeLabel,
        ]).setDepth(25001).setScrollFactor(0).setVisible(false);
        this.updateFartHud();

        this.targetText = this.add
            .text(
                this.gameWidth - 20,
                82,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setOrigin(1, 0)
            .setDepth(300);

        this.paintColorText = this.add
            .text(
                20,
                20,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setDepth(300);

        this.brushSizeText = this.add
            .text(
                20,
                61,
                '',
                {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontStyle: 'bold',
                    color: '#5b4636',
                    backgroundColor: 'rgba(255, 244, 214, 0.86)',
                    padding: {
                        x: 10,
                        y: 7,
                    },
                },
            )
            .setDepth(300);

        this.updateAmmoText();
        this.updateTargetText();
        this.updatePaintHud();
    }

    private updateAmmoText(): void {
        if (
            this.isMultiplayerSession()
        ) {
            this.ammoText
                .setText('')
                .setVisible(false);

            this.updateWeaponHeatHud();
            return;
        }

        if (this.isReloading) {
            this.ammoText.setText(
                tr('RELOADING...'),
            );

            this.ammoText.setColor('#ffdf70');
            return;
        }

        const loaded =
            '●'.repeat(this.ammo);

        const empty =
            '○'.repeat(
                this.maxAmmo -
                this.ammo,
            );

        /*
         * 오프라인 테스트 모드에서도 숫자식  대신
         * 탄환 아이콘만 표시합니다.
         */
        this.ammoText.setText(
            tr(`SHELLS ${loaded}${empty}`),
        );

        this.ammoText.setColor(
            '#26352b',
        );
    }


    /* V1010242_HUNTER_FART_SKILL */
    private isTacticalSupportInputLocked(): boolean {
        return Boolean(
            this.sniperActive ||
            this.sniperCinematicActive ||
            this.vulcanActive ||
            this.vulcanCinematicActive
        );
    }

    private applyTacticalSupportInputLock(): void {
        const locked =
            this.isTacticalSupportInputLocked();

        if (!locked) {
            return;
        }

        this.fartHudContainer
            ?.setVisible(false);

        this.mobileFartButton
            ?.disableInteractive()
            .setVisible(false);

        this.mobileFartLabel
            ?.setVisible(false);
    }


    private updateFartHud(): void {
        if (!this.fartHudContainer || !this.fartGaugeGraphics || !this.fartGaugeLabel) return;
        const localRole =
            multiplayerClient
                .getLocalPlayer()
                ?.role;

        /*
         * V1010450X_HIDER_GAS_HARD_HIDE
         * Hider Practice owns no Hunter GAS UI, even if a stale multiplayer
         * Hunter role survives for a frame while switching modes.
         */
        const visible =
            !this.isTacticalSupportInputLocked() &&
            this.practiceMode !== 'hider' &&
            this.phase === 'hunt' &&
            !this.sniperActive &&
            (
                this.practiceMode ===
                    'hunter' ||
                this.networkPlayerManager
                    ?.isLocalHunter() ||
                localRole === 'hunter'
            );

        /*
         * V1010261_GAS_THIRD_FART_FOCUS_FIX: position/scale are owned exclusively by fixedHudBaseTransforms.
         * Base = (18,88), directly below Ammo/HEAT.
         */
        this.fartHudContainer
            .setScrollFactor(0)
            .setDepth(25001)
            .setVisible(Boolean(visible));


        this.fartGaugeGraphics.clear();

        const pct =
            Phaser.Math.Clamp(
                this.fartGauge / 100,
                0,
                1,
            );

        /* Exact HEAT geometry. */
        const barX = 42;
        const barY = 19;
        const barWidth = 168;
        const barHeight = 12;

        this.fartGaugeGraphics
            .fillStyle(
                0x252d29,
                0.22,
            )
            .fillRoundedRect(
                barX,
                barY,
                barWidth,
                barHeight,
                3,
            );

        /*
         * Pressure grows safe -> warning -> danger, like HEAT.
         */
        let gasColor =
            0x55a95d;

        if (this.fartGauge >= 72) {
            gasColor = 0xd83a34;
        } else if (
            this.fartGauge >= 36
        ) {
            gasColor = 0xf1c84b;
        }

        if (pct > 0) {
            this.fartGaugeGraphics
                .fillStyle(
                    gasColor,
                    1,
                )
                .fillRoundedRect(
                    barX,
                    barY,
                    Math.max(
                        2,
                        barWidth * pct,
                    ),
                    barHeight,
                    3,
                );
        }

        const pooped =
            (
                this.practiceMode === 'hunter'
                    ? (
                        this.practicePoopRemainingMs >
                            0
                            ? Date.now() +
                                this.practicePoopRemainingMs
                            : 0
                    )
                    : this.localPoopUntil
            ) >
            Date.now();

        this.fartGaugeLabel.setText(
            pooped
                ? '💩 GAS ' +
                    Math.round(
                        this.fartGauge,
                    ) +
                    '% · SPEED -60%'
                : '💨 GAS ' +
                    Math.round(
                        this.fartGauge,
                    ) +
                    '%  [SPACE]',
        );
    }

    /* V1010252_AUDIO_FART_HUD_FINAL_POLISH */
    /* V1010262_POOP_LABEL_BRIGHT_FART_VFX_FLUSH */
    private trackTransientGameplayVfx<T extends Phaser.GameObjects.GameObject>(
        object: T,
    ): T {
        this.transientGameplayVfx.add(
            object,
        );

        object.once(
            Phaser.GameObjects.Events.DESTROY,
            () => {
                this.transientGameplayVfx.delete(
                    object,
                );
            },
        );

        return object;
    }

    private clearTransientGameplayVfx(): void {
        this.transientGameplayVfx.forEach(
            (
                object,
            ) => {
                this.tweens.killTweensOf(
                    object,
                );

                if (
                    object.active
                ) {
                    object.destroy();
                }
            },
        );

        this.transientGameplayVfx.clear();

        this.recentHunterDetectionText =
            undefined;

    }

    private installVisibilityAudioGuard(): void {
        if (
            typeof document === 'undefined' ||
            this.audioVisibilityHandler
        ) {
            return;
        }

        this.audioVisibilityHandler =
            (): void => {
                if (
                    document.hidden
                ) {
                    /*
                     * Ignore duplicate hidden events. Previously a second event
                     * could save "true" as the previous mute state and make BGM
                     * remain muted forever after return.
                     */
                    if (
                        this.audioGuardHidden
                    ) {
                        return;
                    }

                    this.audioGuardHidden =
                        true;

                    this.audioGuardPreviousMute =
                        this.sound.mute;

                    this.sound.mute =
                        true;

                    this.shotgunSound?.stop();
                    this.hitSound?.stop();
                    this.hunterHitConfirmSound?.stop();
                    this.countdownBeepSound?.stop();
                    this.countdownStartSound?.stop();
                    this.victorySound?.stop();
                    this.paintSound?.stop();
                    this.heartbeatSound?.stop();

                    this.suppressEffectsUntil =
                        Number.POSITIVE_INFINITY;

                    if (
                        this.audioGuardRestoreTimer !==
                        undefined
                    ) {
                        window.clearTimeout(
                            this.audioGuardRestoreTimer,
                        );

                        this.audioGuardRestoreTimer =
                            undefined;
                    }

                    this.clearTransientGameplayVfx();

                    if (
                        this.comedyAudioContext &&
                        this.comedyAudioContext.state ===
                            'running'
                    ) {
                        void this.comedyAudioContext
                            .suspend();
                    }

                    return;
                }

                if (
                    !this.audioGuardHidden
                ) {
                    return;
                }

                this.audioGuardHidden =
                    false;

                /*
                 * Restore BGM/master audio IMMEDIATELY.
                 * The 2.2s grace now suppresses only one-shot SFX/VFX, not BGM.
                 */
                this.sound.mute =
                    this.audioGuardPreviousMute;

                this.suppressEffectsUntil =
                    Date.now() +
                    2200;

                /*
                 * Browser audio backends can report the loop as stopped after a
                 * long background pause. Re-sync the correct phase BGM now.
                 */
                if (
                    !this.sound.mute
                ) {
                    this.syncPhaseMusic();
                }

                if (
                    this.audioGuardRestoreTimer !==
                    undefined
                ) {
                    window.clearTimeout(
                        this.audioGuardRestoreTimer,
                    );
                }

                this.audioGuardRestoreTimer =
                    window.setTimeout(
                        () => {
                            this.audioGuardRestoreTimer =
                                undefined;

                            if (
                                document.hidden
                            ) {
                                return;
                            }

                            this.suppressEffectsUntil =
                                0;
                        },
                        2200,
                    );
            };

        document.addEventListener(
            'visibilitychange',
            this.audioVisibilityHandler,
            {
                passive:
                    true,
            },
        );

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                if (
                    this.audioVisibilityHandler
                ) {
                    document.removeEventListener(
                        'visibilitychange',
                        this.audioVisibilityHandler,
                    );

                    this.audioVisibilityHandler =
                        undefined;
                }

                if (
                    this.audioGuardRestoreTimer !==
                    undefined
                ) {
                    window.clearTimeout(
                        this.audioGuardRestoreTimer,
                    );

                    this.audioGuardRestoreTimer =
                        undefined;
                }

                /*
                 * Never leave the SoundManager muted because the scene shut down
                 * while the tab happened to be hidden.
                 */
                if (
                    this.audioGuardHidden
                ) {
                    this.sound.mute =
                        this.audioGuardPreviousMute;

                    this.audioGuardHidden =
                        false;
                }
            },
        );
    }

    private shouldSuppressOneShotAudio(): boolean {
        return (
            (
                typeof document !==
                    'undefined' &&
                document.hidden
            ) ||
            Date.now() <
                this.suppressEffectsUntil
        );
    }

    private getComedyAudioContext(): AudioContext | undefined {
        try {
            if (!this.comedyAudioContext) this.comedyAudioContext = new AudioContext();
            if (this.comedyAudioContext.state === 'suspended') void this.comedyAudioContext.resume();
            return this.comedyAudioContext;
        } catch { return undefined; }
    }

    private playComedySound(kind: 'fart' | 'boing' | 'cough' | 'laugh' | 'cry', tier = 2): void {
        if (
            this.shouldSuppressOneShotAudio()
        ) {
            return;
        }

        const ctx = this.getComedyAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        const makeNoise = (
            duration: number,
            gainValue: number,
            lowpass: number,
            startAt = now,
        ): void => {
            const length = Math.max(
                1,
                Math.floor(ctx.sampleRate * duration),
            );
            const buffer = ctx.createBuffer(
                1,
                length,
                ctx.sampleRate,
            );
            const data = buffer.getChannelData(0);

            let last = 0;
            for (let i = 0; i < length; i++) {
                /*
                 * Brown-ish noise is much less "laser/beep" than raw white
                 * noise and gives breath/fart/cough sounds a physical texture.
                 */
                const white = Math.random() * 2 - 1;
                last = (last + 0.035 * white) / 1.035;
                const envelope =
                    Math.sin(Math.PI * (i / length));
                data[i] =
                    last * 3.2 * envelope;
            }

            const src = ctx.createBufferSource();
            src.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(
                lowpass,
                startAt,
            );

            const g = ctx.createGain();
            g.gain.setValueAtTime(
                0.0001,
                startAt,
            );
            g.gain.exponentialRampToValueAtTime(
                Math.max(0.001, gainValue),
                startAt + 0.015,
            );
            g.gain.exponentialRampToValueAtTime(
                0.0001,
                startAt + duration,
            );

            src.connect(filter);
            filter.connect(g);
            g.connect(ctx.destination);
            src.start(startAt);
        };

        if (kind === 'fart') {
            /*
             * V1010262_POOP_LABEL_BRIGHT_FART_VFX_FLUSH: brighter comedy fart bank.
             * Laptop/phone speakers reproduce 150~420Hz much better than the
             * old sub-bass-heavy 40~100Hz sounds.
             */
            const variant =
                Math.floor(
                    Math.random() *
                        3,
                );

            const tone = (
                startAt: number,
                duration: number,
                startHz: number,
                endHz: number,
                gainValue: number,
                type:
                    OscillatorType =
                    'triangle',
            ): void => {
                const osc =
                    ctx.createOscillator();

                const gain =
                    ctx.createGain();

                osc.type =
                    type;

                osc.frequency.setValueAtTime(
                    startHz,
                    startAt,
                );

                osc.frequency.exponentialRampToValueAtTime(
                    Math.max(
                        60,
                        endHz,
                    ),
                    startAt +
                        duration,
                );

                gain.gain.setValueAtTime(
                    0.0001,
                    startAt,
                );

                gain.gain.exponentialRampToValueAtTime(
                    gainValue,
                    startAt +
                        0.006,
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    startAt +
                        duration,
                );

                osc.connect(
                    gain,
                );

                gain.connect(
                    ctx.destination,
                );

                osc.start(
                    startAt,
                );

                osc.stop(
                    startAt +
                        duration,
                );
            };

            const comicPop = (
                startAt: number,
                pitch: number,
                gainValue = 0.24,
            ): void => {
                tone(
                    startAt,
                    0.07,
                    pitch,
                    pitch * 0.42,
                    gainValue,
                    'square',
                );
            };

            /*
             * Tier 1 — short/light:
             * 뽀옹 / 뿌웅 / 뿌욱
             */
            if (tier <= 1) {
                if (variant === 0) {
                    comicPop(
                        now,
                        880,
                        0.18,
                    );

                    tone(
                        now,
                        0.42,
                        280,
                        155,
                        0.33,
                        'sine',
                    );
                } else if (
                    variant === 1
                ) {
                    comicPop(
                        now,
                        720,
                        0.20,
                    );

                    tone(
                        now,
                        0.34,
                        235,
                        130,
                        0.36,
                        'triangle',
                    );
                } else {
                    comicPop(
                        now,
                        1020,
                        0.24,
                    );

                    tone(
                        now,
                        0.20,
                        330,
                        175,
                        0.38,
                        'triangle',
                    );
                }

                return;
            }

            /*
             * Tier 2 — longer and sillier.
             */
            if (tier === 2) {
                if (variant === 0) {
                    comicPop(
                        now,
                        940,
                        0.22,
                    );

                    tone(
                        now,
                        0.68,
                        300,
                        135,
                        0.40,
                        'triangle',
                    );

                    tone(
                        now + 0.21,
                        0.38,
                        360,
                        180,
                        0.18,
                        'sine',
                    );
                } else if (
                    variant === 1
                ) {
                    comicPop(
                        now,
                        820,
                        0.23,
                    );

                    tone(
                        now,
                        0.50,
                        260,
                        145,
                        0.42,
                        'triangle',
                    );

                    comicPop(
                        now + 0.34,
                        640,
                        0.14,
                    );
                } else {
                    comicPop(
                        now,
                        1100,
                        0.27,
                    );

                    tone(
                        now,
                        0.58,
                        320,
                        125,
                        0.44,
                        'triangle',
                    );
                }

                return;
            }

            /*
             * Tier 3 — unmistakably different and funniest.
             * Bright crack/pop train prevents it from getting buried in BGM.
             */
            if (variant === 0) {
                /* 뿌드득!! */
                [
                    0,
                    0.09,
                    0.18,
                ].forEach(
                    (
                        offset,
                        index,
                    ) => {
                        comicPop(
                            now +
                                offset,
                            1250 -
                                index *
                                    140,
                            0.30,
                        );

                        tone(
                            now +
                                offset,
                            0.14,
                            390 -
                                index *
                                    22,
                            170,
                            0.37,
                            'sawtooth',
                        );
                    },
                );
            } else if (
                variant === 1
            ) {
                /* 뿌르르르륵!! */
                comicPop(
                    now,
                    1180,
                    0.30,
                );

                [
                    0,
                    0.075,
                    0.15,
                    0.225,
                    0.30,
                ].forEach(
                    (
                        offset,
                        index,
                    ) => {
                        tone(
                            now +
                                offset,
                            0.105,
                            410 -
                                index *
                                    18,
                            185,
                            0.31,
                            index %
                                2 ===
                                0
                                ? 'triangle'
                                : 'square',
                        );
                    },
                );
            } else {
                /* 뿌부부부붇!! */
                [
                    0,
                    0.065,
                    0.13,
                    0.195,
                    0.26,
                    0.325,
                ].forEach(
                    (
                        offset,
                        index,
                    ) => {
                        comicPop(
                            now +
                                offset,
                            1320 -
                                index *
                                    115,
                            index ===
                                5
                                ? 0.33
                                : 0.25,
                        );
                    },
                );

                tone(
                    now,
                    0.43,
                    350,
                    150,
                    0.34,
                    'triangle',
                );
            }

            return;
        }

        if (kind === 'cough') {
            /*
             * Two dry breath/noise bursts: "콜-록".
             */
            makeNoise(0.13, 0.34, 1100, now);
            makeNoise(0.17, 0.39, 850, now + 0.16);

            [118, 92].forEach((freq, i) => {
                const osc =
                    ctx.createOscillator();
                const g =
                    ctx.createGain();
                const t =
                    now + i * 0.16;
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(
                    freq,
                    t,
                );
                osc.frequency.exponentialRampToValueAtTime(
                    freq * 0.72,
                    t + 0.13,
                );
                g.gain.setValueAtTime(
                    0.14,
                    t,
                );
                g.gain.exponentialRampToValueAtTime(
                    0.0001,
                    t + 0.14,
                );
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.15);
            });
            return;
        }

        if (kind === 'laugh') {
            /*
             * "꺄-하하하!" — breathy vowel-like bursts instead of square-wave
             * notes. A bandpass/formant pair gives a vaguely human voice body.
             */
            const bursts = [
                { t: 0.00, f: 520, d: 0.16, a: 0.25 },
                { t: 0.18, f: 390, d: 0.13, a: 0.29 },
                { t: 0.34, f: 430, d: 0.13, a: 0.29 },
                { t: 0.50, f: 405, d: 0.15, a: 0.27 },
                { t: 0.68, f: 455, d: 0.16, a: 0.24 },
            ];

            bursts.forEach(({ t, f, d, a }, index) => {
                const start =
                    now + t;

                const osc =
                    ctx.createOscillator();
                const formant =
                    ctx.createBiquadFilter();
                const g =
                    ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(
                    f,
                    start,
                );
                osc.frequency.exponentialRampToValueAtTime(
                    f * (index === 0 ? 0.82 : 0.9),
                    start + d,
                );

                formant.type = 'bandpass';
                formant.frequency.value =
                    index === 0 ? 1450 : 980;
                formant.Q.value = 3.2;

                g.gain.setValueAtTime(
                    0.0001,
                    start,
                );
                g.gain.exponentialRampToValueAtTime(
                    a,
                    start + 0.018,
                );
                g.gain.exponentialRampToValueAtTime(
                    0.0001,
                    start + d,
                );

                osc.connect(formant);
                formant.connect(g);
                g.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + d);

                makeNoise(
                    d,
                    index === 0 ? 0.14 : 0.10,
                    1800,
                    start,
                );
            });
            return;
        }

        if (kind === 'cry') {
            /*
             * Embarrassed comic whimper rather than arcade bleeps.
             */
            [0, 0.19, 0.39].forEach((offset, i) => {
                const osc =
                    ctx.createOscillator();
                const g =
                    ctx.createGain();
                const t =
                    now + offset;
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(
                    330 - i * 38,
                    t,
                );
                osc.frequency.linearRampToValueAtTime(
                    245 - i * 28,
                    t + 0.18,
                );
                g.gain.setValueAtTime(
                    0.0001,
                    t,
                );
                g.gain.exponentialRampToValueAtTime(
                    0.20,
                    t + 0.025,
                );
                g.gain.exponentialRampToValueAtTime(
                    0.0001,
                    t + 0.18,
                );
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.19);
            });
            makeNoise(0.58, 0.08, 1500, now);
            return;
        }

        /*
         * Cartoon detection "띠용!" stays intentionally comic, but with a
         * short spring swoop rather than a toy-like series of beeps.
         */
        const osc =
            ctx.createOscillator();
        const g =
            ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(
            210,
            now,
        );
        osc.frequency.exponentialRampToValueAtTime(
            760,
            now + 0.10,
        );
        osc.frequency.exponentialRampToValueAtTime(
            390,
            now + 0.30,
        );
        g.gain.setValueAtTime(
            0.0001,
            now,
        );
        g.gain.exponentialRampToValueAtTime(
            0.30,
            now + 0.015,
        );
        g.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.34,
        );
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    }

    private showFartBurst(event: NetworkFartBurst): void {
        if (this.shouldSuppressOneShotAudio()) {
            return;
        }

        this.playComedySound('fart', event.soundTier);

        const fartWords = {
            ko: [
                '뿡!',
                '뿌웅~',
                '뿌지직!!',
            ],
            ja: [
                'プッ!',
                'プゥ〜ン',
                'ブリッ!!',
            ],
            en: [
                'PFFT!',
                'PRAAAP~',
                'PRRRT!!',
            ],
            zh: [
                '噗!',
                '噗——!',
                '噗噗噗!!',
            ],
        } as const;

        const language =
            getLanguage();

        const fartTier =
            Phaser.Math.Clamp(
                Math.round(
                    event.soundTier,
                ),
                1,
                3,
            );

        const fartWord =
            fartWords[language][
                fartTier - 1
            ];

        const fartText =
            this.trackTransientGameplayVfx(
                this.add.text(
                    event.x,
                    event.y - 10,
                    fartWord,
                    {
                        fontFamily:
                            'monospace',
                        fontSize:
                            fartTier === 3
                                ? '24px'
                                : '20px',
                        fontStyle:
                            'bold',
                        color:
                            '#f9ffd8',
                        stroke:
                            '#40552b',
                        strokeThickness:
                            5,
                    },
                ),
            )
                .setOrigin(0.5)
                .setDepth(18010)
                .setScale(0.35);

        this.tweens.add({
            targets:
                fartText,
            y:
                event.y - 46,
            scale:
                fartTier === 3
                    ? 1.32
                    : 1.1,
            angle:
                fartTier === 3
                    ? {
                        from: -7,
                        to: 7,
                    }
                    : 0,
            alpha:
                0,
            duration:
                fartTier === 3
                    ? 1800
                    : 1500,
            hold:
                fartTier === 3
                    ? 260
                    : 180,
            ease:
                'Back.Out',
            onComplete:
                () =>
                    fartText.destroy(),
        });

        const g =
            this.trackTransientGameplayVfx(
                this.add.graphics(),
            ).setDepth(18000);
        g.lineStyle(5, 0x9bc56b, 0.8).strokeCircle(0, 0, event.radius);
        g.fillStyle(0xb7d87e, 0.12).fillCircle(0, 0, event.radius);
        g.setPosition(event.x, event.y).setScale(0.15).setAlpha(0.9);
        this.tweens.add({ targets: g, scaleX: 1, scaleY: 1, alpha: 0, duration: 850, ease: 'Cubic.Out', onComplete: () => g.destroy() });
        for (let i = 0; i < 12; i++) {
            const a = Math.PI * 2 * i / 12 + Math.random() * 0.3;
            const puff =
                this.trackTransientGameplayVfx(
                    this.add.circle(
                        event.x,
                        event.y,
                        5 + Math.random() * 5,
                        0xa9cf73,
                        0.5,
                    ),
                ).setDepth(17999);
            this.tweens.add({ targets: puff, x: event.x + Math.cos(a) * event.radius, y: event.y + Math.sin(a) * event.radius, alpha: 0, scale: 1.8, duration: 700 + Math.random() * 250, onComplete: () => puff.destroy() });
        }
    }

    /* V1010451M3G_FART_DETECT_SCREEN_EDGE_FLASH_ROBUST
     * Successful fart detection gets one unmistakable GREEN screen-edge pulse.
     * DOM overlay intentionally sits above Phaser canvas and runs before audio guards.
     */
    private flashFartDetectionScreenEdge(): void {
        if (typeof document === 'undefined') {
            return;
        }

        document
            .querySelector(
                '.colorhunt-fart-detect-success-flash',
            )
            ?.remove();

        const flash =
            document.createElement(
                'div',
            );

        flash.className =
            'colorhunt-fart-detect-success-flash';

        Object.assign(
            flash.style,
            {
                position: 'fixed',
                left:
                    `${this.game.canvas.getBoundingClientRect().left}px`,
                top:
                    `${this.game.canvas.getBoundingClientRect().top}px`,
                width:
                    `${this.game.canvas.getBoundingClientRect().width}px`,
                height:
                    `${this.game.canvas.getBoundingClientRect().height}px`,
                zIndex: '2147483646',
                overflow: 'hidden',
                pointerEvents: 'none',
                boxSizing: 'border-box',
                border: '18px solid rgba(55,255,115,0.98)',
                boxShadow:
                    'inset 0 0 42px 16px rgba(55,255,115,0.72), 0 0 28px rgba(55,255,115,0.88)',
                background:
                    'rgba(55,255,115,0.11)',
                opacity: '0',
            },
        );

        document.body.appendChild(
            flash,
        );

        const animation =
            flash.animate(
                [
                    {
                        opacity: 0,
                        transform:
                            'scale(1.012)',
                    },
                    {
                        opacity: 1,
                        offset: 0.20,
                        transform:
                            'scale(1)',
                    },
                    {
                        opacity: 0.92,
                        offset: 0.52,
                        transform:
                            'scale(1)',
                    },
                    {
                        opacity: 0,
                        transform:
                            'scale(1.006)',
                    },
                ],
                {
                    duration: 420,
                    easing:
                        'cubic-bezier(.18,.8,.2,1)',
                    fill: 'forwards',
                },
            );

        animation.onfinish =
            () => flash.remove();

        window.setTimeout(
            () => flash.remove(),
            700,
        );
    }


    private showHunterDetectionAlert(
        _reaction: 'cough',
    ): void {
        // Visual first: mute/suspended audio must never suppress detection feedback.
        this.flashFartDetectionScreenEdge();
        if (
            this.shouldSuppressOneShotAudio()
        ) {
            return;
        }

        this.playComedySound(
            'boing',
        );

        const p =
            this.networkPlayerManager
                ?.getLocalPlayerPosition();

        if (!p) {
            return;
        }

        this.recentHunterDetectionText
            ?.destroy();

        const text =
            this.trackTransientGameplayVfx(
                this.add.text(
                    p.x,
                    p.y - 58,
                    (
                        getLanguage() === 'ja'
                            ? '🤢 うわっ、くさっ！！'
                            : getLanguage() === 'en'
                                ? '🤢 UGH, IT STINKS!!'
                                : getLanguage() === 'zh'
                                    ? '🤢 呃，好臭！！'
                                    : '🤢 으악, 구려!!'
                    ),
                    {
                        fontSize:
                            '22px',
                        fontStyle:
                            'bold',
                        color:
                            '#ffe45c',
                        stroke:
                            '#111820',
                        strokeThickness:
                            7,
                        backgroundColor:
                            'rgba(17,24,32,0.42)',
                        padding: {
                            x: 7,
                            y: 3,
                        },
},
                ),
            )
                .setOrigin(
                    0.5,
                )
                .setDepth(
                    22000,
                )
                .setScale(
                    0.2,
                );

        this.recentHunterDetectionText =
            text;

        this.tweens.add({
            targets:
                text,
            scale:
                1.35,
            duration:
                180,
            yoyo:
                true,
            hold:
                220,
            ease:
                'Back.Out',
            onUpdate:
                () => {
                    const current =
                        this.networkPlayerManager
                            ?.getLocalPlayerPosition();

                    if (
                        current &&
                        text.active
                    ) {
                        text.setPosition(
                            current.x,
                            current.y - 72,
                        );
                    }
                },
            onComplete:
                () => {
                    if (
                        this.recentHunterDetectionText ===
                        text
                    ) {
                        this.recentHunterDetectionText =
                            undefined;
                    }

                    text.destroy();
                },
        });
    }

    private showHiderReaction(
        _event: NetworkHiderReaction,
        _kind: 'cough',
    ): void {
        if (
            this.shouldSuppressOneShotAudio()
        ) {
            return;
        }

        /*
         * V1010295_CLIENT_UI_PHASE_RECOVERY: Fart detection must not reveal the Hider's exact position
         * with floating COUGH text. Keep only the non-positional comedy sound.
         */
        this.playComedySound('cough');
    }

    private showPoopBurst(
        event: NetworkPoopBurst,
    ): void {
        const localUntil =
            Date.now() +
            Math.max(
                0,
                event.poopUntil -
                    event.serverNow,
            );

        this.poopedHuntersUntil.set(
            event.hunterId,
            localUntil,
        );

        const localSessionId =
            multiplayerClient.getSessionId();

        const isPracticeHunter =
            this.practiceMode === 'hunter' &&
            event.hunterId ===
                this.practiceHunterSessionId;

        const isLocalHunter =
            event.hunterId ===
                localSessionId ||
            isPracticeHunter;

        if (isLocalHunter) {
            this.localPoopUntil =
                localUntil;

            if (
                Number.isFinite(
                    event.targetGauge,
                )
            ) {
                this.multiplayerPoopGasTarget =
                    Phaser.Math.Clamp(
                        Number(
                            event.targetGauge,
                        ),
                        0,
                        100,
                    );
            }

            if (
                this.practiceMode !== 'hunter'
            ) {
                this.fartGauge = 100;
                this.updateFartHud();
            }

            this.networkPlayerManager
                ?.setLocalHunterSpeedMultiplier(
                    0.4,
                );
        }

        if (
            this.shouldSuppressOneShotAudio()
        ) {
            this.updateFartHud();
            return;
        }

        const getHunterPosition =
            (): {
                x: number;
                y: number;
            } => {
                return (
                    this.networkPlayerManager
                        ?.getPlayerPosition(
                            event.hunterId,
                        ) ?? {
                        x:
                            event.x,
                        y:
                            event.y,
                    }
                );
            };

        /*
         * Keep a text object attached to the Hunter for its ENTIRE lifetime.
         * Tween onUpdate does not reliably run through long hold sections,
         * so use a 50ms scene timer instead.
         */
        const followForLifetime = (
            text:
                Phaser.GameObjects.Text,
            offsetY:
                number,
            lifetimeMs:
                number,
        ): void => {
            const place =
                (): void => {
                    if (
                        !text.active
                    ) {
                        return;
                    }

                    const p =
                        getHunterPosition();

                    text.setPosition(
                        p.x,
                        p.y +
                            offsetY,
                    );
                };

            place();

            const eventTimer =
                this.time.addEvent({
                    delay:
                        50,
                    loop:
                        true,
                    callback:
                        place,
                });

            window.setTimeout(
                () => {
                    eventTimer.remove(
                        false,
                    );
                },
                lifetimeMs,
            );
        };

        /*
         * Server is authoritative: if the third fart detected at least one
         * Hider, poop_burst carries detected=true.
         */
        const detectedWhilePooping =
            isLocalHunter &&
            event.detected ===
                true;

        if (
            detectedWhilePooping
        ) {
            /*
             * Remove any ordinary ! that may have arrived first.
             */
            this.recentHunterDetectionText
                ?.destroy();

            this.recentHunterDetectionText =
                undefined;

            const comboLabels = {
                ko:
                    '💩🤢 으악!! 이건 방귀가 아니잖아!!',
                ja:
                    '💩🤢 うわっ！！これ、オナラじゃないだろ！！',
                en:
                    '💩🤢 UGH!! THAT\'S NOT A FART!!',
                zh:
                    '💩🤢 呃！！这根本不是屁吧！！',
            } as const;

            const p =
                getHunterPosition();

            const combo =
                this.trackTransientGameplayVfx(
                    this.add.text(
                        p.x,
                        p.y - 66,
                        comboLabels[
                            getLanguage()
                        ],
                        {
                            fontFamily:
                                'monospace',
                            fontSize:
                                this.mobileControlsEnabled
                                    ? '16px'
                                    : '22px',
                            fontStyle:
                                'bold',
                            color:
                                '#fff5c8',
                            backgroundColor:
                                'rgba(92,54,25,0.58)',
                            stroke:
                                '#5a3421',
                            strokeThickness:
                                5,
                            padding: {
                                x:
                                    9,
                                y:
                                    5,
                            },
                            align:
                                'center',
                        },
                    ),
                )
                    .setOrigin(
                        0.5,
                    )
                    .setDepth(
                        23500,
                    )
                    .setScale(
                        0.45,
                    )
                    .setAlpha(
                        0.2,
                    );

            followForLifetime(
                combo,
                -66,
                3100,
            );

            this.tweens.add({
                targets:
                    combo,
                scale:
                    1.08,
                alpha:
                    1,
                duration:
                    260,
                ease:
                    'Back.Out',
                hold:
                    2200,
                yoyo:
                    true,
                onComplete:
                    () =>
                        combo.destroy(),
            });
        } else {
            const poopLabels = {
                ko:
                    '💩 똥 지렸다!!',
                ja:
                    '💩 も…漏らした!!',
                en:
                    '💩 I POOPED MYSELF!!',
                zh:
                    '💩 拉裤子了!!',
            } as const;

            const p =
                getHunterPosition();

            const poopText =
                this.trackTransientGameplayVfx(
                    this.add.text(
                        p.x,
                        p.y - 58,
                        poopLabels[
                            getLanguage()
                        ],
                        {
                            fontFamily:
                                'monospace',
                            fontSize:
                                '20px',
                            fontStyle:
                                'bold',
                            color:
                                '#fff2c6',
                            stroke:
                                '#5a3421',
                            strokeThickness:
                                5,
                        },
                    ),
                )
                    .setOrigin(
                        0.5,
                    )
                    .setDepth(
                        23000,
                    )
                    .setScale(
                        0.45,
                    )
                    .setAlpha(
                        0.35,
                    );

            followForLifetime(
                poopText,
                -58,
                3200,
            );

            this.tweens.add({
                targets:
                    poopText,
                scale:
                    1.05,
                alpha:
                    1,
                duration:
                    260,
                ease:
                    'Back.Out',
                hold:
                    2300,
                yoyo:
                    true,
                onComplete:
                    () =>
                        poopText.destroy(),
            });
        }

        /*
         * V1010362_POOP_DEBUFF_5S_GAUGE: compact poop-debuff countdown directly under the Hunter.
         * Everyone who receives the poop burst can see the remaining penalty,
         * and it follows the Hunter while shrinking from full -> empty.
         */
        {
            const gaugeWidth =
                46;
            const gaugeHeight =
                5;

            const gauge =
                this.trackTransientGameplayVfx(
                    this.add.graphics()
                        .setDepth(
                            23010,
                        ),
                );

            const secondsText =
                this.trackTransientGameplayVfx(
                    this.add.text(
                        0,
                        0,
                        '',
                        {
                            fontFamily:
                                'monospace',
                            fontSize:
                                this.mobileControlsEnabled
                                    ? '8px'
                                    : '9px',
                            fontStyle:
                                'bold',
                            color:
                                '#fff7df',
                            stroke:
                                '#3b2418',
                            strokeThickness:
                                2,
                        },
                    )
                        .setOrigin(
                            0.5,
                            0,
                        )
                        .setDepth(
                            23011,
                        ),
                );

            const redrawDebuffGauge =
                (): void => {
                    if (
                        !gauge.active ||
                        !secondsText.active
                    ) {
                        return;
                    }

                    const p =
                        getHunterPosition();

                    const remainingMs =
                        Math.max(
                            0,
                            localUntil -
                                Date.now(),
                        );

                    const ratio =
                        Phaser.Math.Clamp(
                            remainingMs /
                                5_000,
                            0,
                            1,
                        );

                    const x =
                        p.x -
                        gaugeWidth /
                            2;
                    const y =
                        p.y +
                        23;

                    gauge.clear();

                    gauge
                        .fillStyle(
                            0x251a14,
                            0.72,
                        )
                        .fillRoundedRect(
                            x,
                            y,
                            gaugeWidth,
                            gaugeHeight,
                            2,
                        );

                    if (ratio > 0) {
                        gauge
                            .fillStyle(
                                0xf1c84b,
                                0.95,
                            )
                            .fillRoundedRect(
                                x + 1,
                                y + 1,
                                Math.max(
                                    1,
                                    (
                                        gaugeWidth -
                                        2
                                    ) *
                                        ratio,
                                ),
                                gaugeHeight -
                                    2,
                                1,
                            );
                    }

                    gauge
                        .lineStyle(
                            1,
                            0xfff0cf,
                            0.9,
                        )
                        .strokeRoundedRect(
                            x,
                            y,
                            gaugeWidth,
                            gaugeHeight,
                            2,
                        );

                    secondsText
                        .setPosition(
                            p.x,
                            y + 6,
                        )
                        .setText(
                            (
                                remainingMs /
                                1000
                            ).toFixed(
                                1,
                            ) +
                                's',
                        );
                };

            redrawDebuffGauge();

            const gaugeTimer =
                this.time.addEvent({
                    delay:
                        50,
                    loop:
                        true,
                    callback:
                        () => {
                            redrawDebuffGauge();

                            if (
                                Date.now() >=
                                localUntil
                            ) {
                                gaugeTimer.remove(
                                    false,
                                );
                                gauge.destroy();
                                secondsText.destroy();
                            }
                        },
                });
        }

        /*
         * Slowdown explanation only for the affected Hunter.
         * Follow continuously below the character for the whole display time.
         */
        if (
            isLocalHunter
        ) {
            const slowLabels = {
                ko:
                    '💩 똥을 지렸습니다 · 5초 동안 이동속도 -60%',
                ja:
                    '💩 漏らしました · 5秒間 移動速度 -60%',
                en:
                    '💩 You pooped yourself · Move speed -60% for 5s',
                zh:
                    '💩 拉裤子了 · 5秒内移速 -60%',
            } as const;

            const p =
                getHunterPosition();

            const slowText =
                this.trackTransientGameplayVfx(
                    this.add.text(
                        p.x,
                        p.y + 52,
                        slowLabels[
                            getLanguage()
                        ],
                        {
                            fontFamily:
                                'monospace',
                            fontSize:
                                this.mobileControlsEnabled
                                    ? '10px'
                                    : '12px',
                            fontStyle:
                                'bold',
                            color:
                                '#fff8df',
                            backgroundColor:
                                'rgba(69,45,30,0.58)',
                            stroke:
                                '#3b2418',
                            strokeThickness:
                                2,
                            align:
                                'center',
                            padding: {
                                x:
                                    8,
                                y:
                                    5,
                            },
                        },
                    ),
                )
                    .setOrigin(
                        0.5,
                    )
                    .setDepth(
                        22999,
                    )
                    .setAlpha(
                        0,
                    );

            followForLifetime(
                slowText,
                52,
                5000,
            );

            this.tweens.add({
                targets:
                    slowText,
                alpha:
                    0.88,
                duration:
                    180,
                hold:
                    4300,
                yoyo:
                    true,
                onComplete:
                    () =>
                        slowText.destroy(),
            });
        }

        this.playComedySound(
            'cry',
        );

        this.updateFartHud();
    }

    private updatePoopComedyEffects(): void {
        /*
         * V1010277_GAS_10S_LINEAR_DRAIN: multiplayer local Hunter mirrors Practice GAS animation.
         * localPoopUntil is converted from authoritative server time in
         * onFartState(). During the debuff, display a smooth 100 -> 0 drain.
         */
        if (
            this.practiceMode !== 'hunter' &&
            this.localPoopUntil > 0
        ) {
            const now =
                Date.now();

            const localPoopRemainingMs =
                Math.max(
                    0,
                    this.localPoopUntil -
                        now,
                );

            const target =
                Phaser.Math.Clamp(
                    this.multiplayerPoopGasTarget,
                    0,
                    100,
                );

            if (
                localPoopRemainingMs >
                0
            ) {
                /*
                 * V1010492B_MULTIPLAYER_GAS_DRAIN
                 * Display-only interpolation. Server still owns the debuff.
                 */
                this.fartGauge =
                    Phaser.Math.Clamp(
                        (
                            localPoopRemainingMs /
                            5_000
                        ) * 100,
                        0,
                        100,
                    );

                this.updateFartHud();
            } else {
                this.fartGauge =
                    target;

                this.updateFartHud();
            }
        }

        const now = Date.now();
        this.poopedHuntersUntil.forEach((until, hunterId) => {
            if (until <= now) {
                this.poopedHuntersUntil.delete(hunterId); this.lastPoopTrailAt.delete(hunterId); this.lastPoopTearAt.delete(hunterId);
                if (
                    hunterId ===
                        multiplayerClient.getSessionId() ||
                    (
                        this.practiceMode === 'hunter' &&
                        hunterId ===
                            this.practiceHunterSessionId
                    )
                ) {
                    if (
                        this.practiceMode === 'hunter'
                    ) {
                        this.practicePoopUntil = 0;

                        /*
                         * V1010310C_CURRENT_SOURCE_HARDFIX_RECOVER: preserve the progression floor after the
                         * 8-second debuff instead of resetting to zero.
                         * #1 => 36, #2 => 72, #3 => 100.
                         */
                        this.fartGauge =
                            this.practicePoopGasTarget;
                    }

                    this.localPoopUntil = 0;
                    this.networkPlayerManager?.setLocalHunterSpeedMultiplier(1);
                    this.updateFartHud();
                }
                return;
            }
            const p = this.networkPlayerManager?.getPlayerPosition(hunterId); if (!p) return;
            const lastTrail = this.lastPoopTrailAt.get(hunterId) ?? 0;
            if (now - lastTrail > 230) {
                this.lastPoopTrailAt.set(hunterId, now);
                const footprint = this.add.ellipse(p.x, p.y + 15, 10, 6, 0x8b5a2b, 0.5).setDepth(120);
                this.tweens.add({ targets: footprint, alpha: 0, scale: 0.6, duration: 1600, onComplete: () => footprint.destroy() });
            }
            const lastTear = this.lastPoopTearAt.get(hunterId) ?? 0;
            if (now - lastTear > 340) {
                this.lastPoopTearAt.set(hunterId, now);
                [-1, 1].forEach((side) => { const tear = this.add.circle(p.x + side * 8, p.y - 18, 3, 0x6ec8ff, 0.9).setDepth(22001); this.tweens.add({ targets: tear, x: tear.x + side * 10, y: tear.y + 24, alpha: 0, duration: 520, onComplete: () => tear.destroy() }); });
            }
        });
    }

    private updateTargetText(): void {
        if (
            this.isMultiplayerSession() ||
            this.practiceMode !==
                null
        ) {
            this.targetText
                .setText('')
                .setVisible(false);
            return;
        }

        this.targetText
            .setText(
                tr(`HIDERS ${this.getAliveHiderCount()} / ${this.hiders.length}`),
            )
            .setVisible(true);
    }

    private updatePaintHud(): void {
        if (
            !this.paintColorText ||
            !this.brushSizeText
        ) {
            return;
        }

        this.paintColorText
            .setText('')
            .setVisible(false);

        this.brushSizeText
            .setText('')
            .setVisible(false);

        this.updatePaintControlHelp();
    }

    private showHunterEyedropperDisabledNotice(): void {
        const message =
            (
                {
                    ko: '🚫 헌터는 색칠 시간에 스포이드를 사용할 수 없습니다.',
                    ja: '🚫 ハンターはペイント時間中にスポイトを使用できません。',
                    en: "🚫 Hunters can't use the eyedropper during paint time.",
                    zh: '🚫 猎人在涂色时间无法使用吸管。',
                } as const
            )[getLanguage()];

        /*
         * Hunter Paint can have blackout/camera overlays above Phaser status
         * text. Use a short DOM toast so both the eyedropper button and PC
         * right-click always give unmistakable feedback.
         */
        document
            .querySelectorAll(
                '.colorhunt-hunter-eyedropper-notice',
            )
            .forEach(
                (element) =>
                    element.remove(),
            );

        const notice =
            document.createElement(
                'div',
            );

        notice.className =
            'colorhunt-hunter-eyedropper-notice';

        notice.textContent =
            message;

        Object.assign(
            notice.style,
            {
                position: 'fixed',
                left: '50%',
                /*
                 * v0.10.10.235.1:
                 * Keep the warning away from the top survival/timer HUD.
                 * Place it around the character-head area instead.
                 */
                top: '42%',
                transform:
                    'translate(-50%, -50%)',
                zIndex: '100000',
                maxWidth:
                    'min(88vw, 560px)',
                padding:
                    '12px 18px',
                borderRadius:
                    '14px',
                border:
                    '2px solid rgba(255,255,255,.9)',
                background:
                    'rgba(35, 40, 38, .94)',
                color: '#fffdf3',
                fontFamily:
                    'Arial, sans-serif',
                fontSize:
                    this.mobileControlsEnabled
                        ? '15px'
                        : '16px',
                fontWeight:
                    '800',
                textAlign:
                    'center',
                lineHeight:
                    '1.35',
                boxShadow:
                    '0 6px 24px rgba(0,0,0,.30)',
                pointerEvents:
                    'none',
            },
        );

        document.body.appendChild(
            notice,
        );

        window.setTimeout(
            () => notice.remove(),
            1700,
        );
    }

    private showStatus(message: string): void {
        this.statusText
            .setText(message)
            .setVisible(true)
            .setAlpha(1);

        this.time.delayedCall(1400, () => {
            if (
                this.statusText.text === message
            ) {
                this.statusText.setVisible(false);
            }
        });
    }

    /*
     * Timer and phase
     */

    private updateRoundTimer(): void {
        if (
            this.practiceMode ===
                'hider' &&
            this.phase ===
                'paint'
        ) {
            return;
        }

        if (
            this.phase !== 'paint' &&
            this.phase !== 'hunt' &&
            this.phase !== 'finished'
        ) {
            return;
        }

        if (this.phase === 'finished') {
            return;
        }

        const remainingMilliseconds =
            this.phaseEndTime - this.time.now;

        const remainingSeconds = Math.max(
            0,
            Math.ceil(remainingMilliseconds / 1000),
        );

        if (this.phase === 'paint') {
            /*
             * v0.10.10.103:
             * Multiplayer Paint has ONE countdown only:
             * the compact "위장하세요 · ⌛ n" bar.
             * Never resurrect the legacy numeric timer box for Hider.
             */
            if (
                this.isMultiplayerSession()
            ) {
                this.timerText
                    .setText('')
                    .setVisible(false);
            } else {
                this.timerText
                    .setVisible(true)
                    .setText(
                        tr(`PAINT ${remainingSeconds}`),
                    );
            }
        } else {
            /*
             * v0.10.10.236.1:
             * Hunt already has the compact translated "찾는 중! · ⏱ Ns"
             * survival HUD. The old centered "TIME N" box is redundant and
             * must never be shown in Hunt.
             */
            this.timerText
                .setText('')
                .setVisible(false);

            if (
                this.practiceMode ===
                    'hunter'
            ) {
                /*
                 * v0.10.10.190:
                 * Hunter Practice now uses ONLY the compact survival timer
                 * badge (⏱ 76s). The legacy TIME 76 box was a duplicate and
                 * cluttered the center of the screen.
                 */
                this.timerText
                    .setText('')
                    .setVisible(false);
            }
        }

        this.timerText.setColor(
            remainingSeconds <= 5
                ? '#c62828'
                : '#1f2937',
        );

        if (
            this.isMultiplayerSession()
        ) {
            if (
                remainingMilliseconds <= 0 &&
                this.time.now -
                    this.lastPhaseRecoveryAt >
                    350
            ) {
                this.lastPhaseRecoveryAt =
                    this.time.now;

                const serverPhase =
                    multiplayerClient
                        .getPhase();

                const serverEndsAt =
                    multiplayerClient
                        .getPhaseEndsAt();

                /*
                 * Schema callback can occasionally be missed/delayed in an
                 * online tab.  Re-apply authoritative server phase instead
                 * of leaving the UI frozen at PAINT 0 / TIME 0.
                 */
                /*
                 * V1010295_CLIENT_UI_PHASE_RECOVERY: reconnection may return to the SAME phase with a fresh
                 * authoritative deadline. Re-apply it too; otherwise Hunt can
                 * remain frozen forever at TIME 0.
                 */
                const authoritativeDeadlineIsLive =
                    Number.isFinite(
                        serverEndsAt,
                    ) &&
                    serverEndsAt >
                        Date.now();

                if (
                    serverPhase !==
                        this.phase ||
                    authoritativeDeadlineIsLive
                ) {
                    this.applyNetworkPhase(
                        serverPhase,
                        serverEndsAt,
                    );

                    if (
                        serverPhase !==
                            this.phase
                    ) {
                        return;
                    }
                }

                multiplayerClient
                    .requestLobbySnapshot();

                multiplayerClient
                    .requestPaintReadyState();

                multiplayerClient
                    .requestRoundPaintState();

                /*
                 * A client that lost connectivity during Paint can otherwise
                 * stare at PAINT 0 forever because it can no longer receive
                 * the server's Hunt/Lobby transition. Give synchronization a
                 * short grace period, then fail safely back to the main menu.
                 */
                if (
                    this.phase === 'paint' ||
                    this.phase === 'hunt' ||
                    this.phase === 'finished'
                ) {
                    if (
                        this.phaseExpiredSince <= 0
                    ) {
                        this.phaseExpiredSince =
                            this.time.now;
                    }

                    if (
                        this.time.now -
                            this.phaseExpiredSince >
                        1200
                    ) {
                        /*
                         * v0.10.10.72 HOTFIX:
                         * Never self-disconnect at Paint 0.
                         * requestLobbySnapshot() now carries authoritative
                         * phase/deadline/READY state and will heal a missed
                         * phase_changed packet.
                         */
                        this.phaseExpiredSince =
                            this.time.now;

                        multiplayerClient
                            .requestLobbySnapshot();
                    }
                }
            } else if (
                remainingMilliseconds > 0
            ) {
                this.phaseExpiredSince = 0;
            }

            if (
                remainingMilliseconds <= 0 &&
                this.phase === 'hunt'
            ) {
                /*
                 * 서버 결과가 도착하기 전의 짧은 네트워크 지연 구간에도
                 * 추가 사격/조준은 절대 허용하지 않습니다.
                 */
                this.timerText
                    .setText(tr('TIME 0'));

                this.canShoot = false;
                this.clearAllAimingVisuals();
                this.networkPlayerManager
                    .clearHunterAimLines();

                this.statusText
                    .setText('')
                    .setVisible(false);
            }

            return;
        }

        if (
            remainingMilliseconds > 0
        ) {
            return;
        }

        if (this.phase === 'paint') {
            this.startHunt();
            return;
        }

        if (this.phase === 'hunt') {
            this.showHiderVictory();
        }
    }

    private enterPaintPhase(): void {
        this.time.delayedCall(
            0,
            () => {
                this.updateControlsHelpPosition();
                this.updateMobilePaintDockPosition();
            },
        );

        this.time.delayedCall(
            0,
            () => {
                this.updateChatKeyboardOffset();
            },
        );

        this.localPaintHistory = [];
        this.redoPaintHistory = [];
        this.currentStrokeHistoryPoints = [];
        this.clearMobilePendingPaint();
        this.straightLineStart = undefined;
        this.straightLineStartWorld =
            undefined;
        this.straightLineModeActive =
            false;
        this.clearStraightLinePreview();
        this.phase = 'paint';
        this.paintCameraOffsetScreenX = 0;
        this.paintCameraOffsetScreenY = 0;
        this.mobilePaintCameraPanX = 0;
        this.mobilePaintCameraPanY = 0;

        /*
         * V1010452I5_HIDER_SKILL_IMMEDIATE_CONTROLS
         * Skill selection is gameplay UI, not tutorial UI.
         * Create it immediately, then retry once after the authoritative role
         * snapshot has had one frame to settle.
         */
        this.createHiderSkillPicker();
        this.time.delayedCall(80, () => this.createHiderSkillPicker());

        this.time.delayedCall(260, () => {
            if (this.phase === 'paint') this.showFirstRoleGuide();
        });

        /*
         * V1010450ZC_RECREATE_MOBILE_PAINT_DOCK
         *
         * v450zb correctly destroys stale Hider paint/eyedropper DOM when
         * returning to Lobby. But createMobilePaintDock() used to run only once
         * during Scene.create(), so the next real Paint phase had nothing to
         * show. This was especially obvious for a Hunter: the color palette /
         * paint controls were simply gone.
         *
         * Rebuild the dock on every Paint entry when Lobby cleanup removed it.
         * At this point NetworkPlayerManager already exists, so the Hider-only
         * Paint Help role check is also safe and correct:
         *   Hider  -> normal dock + Paint Help
         *   Hunter -> normal dock, NO Paint Help
         */
        /*
         * V1010450ZE_MOBILE_HUNTER_PALETTE_REBUILD
         *
         * Mobile Hunter could inherit a stale/hidden Paint dock from the Lobby
         * transition. Rebuild the mobile dock from the authoritative Paint role
         * every round. Hunter still gets NO Paint Help, only normal paint tools.
         */
        if (this.mobileControlsEnabled) {
            this.destroyMobilePaintDock();
            this.createMobilePaintDock();
        } else if (!this.mobilePaintDock) {
            this.createMobilePaintDock();
        }

        this.setMobilePaintDockVisible(
            true,
        );

        this.time.delayedCall(
            0,
            () => {
                this.setMobilePaintDockVisible(
                    true,
                );
                this.updateMobilePaintDockPosition();
            },
        );

        if (
            this.isMultiplayerSession()
        ) {
            this.paintDuration =
                Math.round(
                    multiplayerClient
                        .getPaintDurationMs() /
                    1000,
                );
        }
        this.syncPhaseMusic();
        this.hidePoints = 0;
        this.nextHeartbeatAt = 0;
        this.hideHuntTensionUi();

        /*
         * v0.10.10.96:
         * Multiplayer Paint uses the same compact top bar for both roles.
         * Hide the old timer box so it never covers the character.
         */
        this.timerText.setVisible(
            !this.isMultiplayerSession(),
        );

        this.applyPaintOnlyScreenLayout();

        /*
         * 숨는 시간도 Hunt와 같은 기본 확대 배율을 사용합니다.
         */
        if (
            this.isMultiplayerSession()
        ) {
            /*
             * v0.10.10.78:
             * Hider painting is the core customization interaction.
             * Make the character as large as practical while fixed HUD/palette
             * remain screen-space UI. Hunter customization still applies its
             * dedicated 1.05 camera override later.
             */
            this.paintWorldZoom =
                3.75;

            this.cameras.main
                .stopFollow()
                .removeBounds()
                .setZoom(
                    this.paintWorldZoom,
                );

            this.applyFixedHudForZoom(
                this.paintWorldZoom,
            );

            this.centerPaintCameraOnLocalPlayer();
            this.networkPlayerManager
                .showOnlyLocalPlayer();

            const localPosition =
                this.networkPlayerManager
                    .getLocalPlayerPosition();

            if (localPosition) {
            }
        }

        this.phaseEndTime =
            this.time.now +
            this.paintDuration * 1000;

        this.selectedHiderIndex = 0;
        this.isPainting = false;
        this.paintColor =
            this.defaultPaintColor;

        if (
            this.isMultiplayerSession()
        ) {
            this.refreshHunterCamoPalette();
            this.applyRolePaintPalette(
                this.networkPlayerManager
                    .isLocalHunter(),
            );
            this.setHunterCamoPaletteVisible(
                false,
            );
        }

        this.createBrushTexture();

        this.phaseText
            .setText('')
            .setVisible(false);

        /*
         * v0.10.10.96:
         * Multiplayer Paint uses the same compact top bar for both roles.
         * Hide the old timer box so it never covers the character.
         */
        this.timerText.setVisible(
            !this.isMultiplayerSession(),
        );

        /*
         * v0.10.10.84:
         * Paint counter is the only top-center Hider text. The old generic
         * guide consumed the same vertical space as the enlarged character.
         */
        this.guideText
            .setText('')
            .setVisible(false);

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.networkPlayerManager
            ?.clearHunterAimLines();

        this.selectionRing.setVisible(true);
        this.paintPreview.setVisible(false);

        /*
         * v0.10.10.100:
         * Remove legacy top-left paint info (COLOR / BRUSH).
         * Palette itself remains available.
         */
        this.paintColorText
            .setText('')
            .setVisible(false);
        this.brushSizeText
            .setText('')
            .setVisible(false);
        this.setPaintPaletteVisible(true);
        this.highlightPaletteColor(
            this.paintColor,
        );

        this.ammoText.setVisible(false);
        this.targetText.setVisible(false);

        if (
            this.isMultiplayerSession()
        ) {
            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        false,
                    );

                    hider.label.setVisible(
                        false,
                    );
                },
            );

            this.selectionRing.setVisible(
                false,
            );
        } else {
            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        true,
                    );

                    hider.label.setVisible(
                        true,
                    );
                },
            );

            this.selectHider(0);
        }
        this.updatePaintHud();

        this.clearStatus();

        this.input.setDefaultCursor('crosshair');
    }

    private startHunt(): void {
        this.clearHiderSkillRoundFx();
        this.destroyHiderSkillPicker();
        this.hideAllHidersReadyBubble();

        this.time.delayedCall(
            0,
            () => {
                this.updateControlsHelpPosition();
                this.updateMobilePaintDockPosition();
            },
        );

        this.time.delayedCall(
            0,
            () => {
                this.updateChatKeyboardOffset();
            },
        );

        this.restoreGameplayTimerPosition();
        this.hideMobilePaintPrecisionGuide();

        if (
            this.isMultiplayerSession()
        ) {
            this.huntDuration =
                Math.round(
                    multiplayerClient
                        .getHuntDurationMs() /
                    1000,
                );
        }

        this.spectatorSessionId = '';
        this.spectatorCycleIndex = -1;

        if (
            this.isMultiplayerSession()
        ) {
            this.networkPlayerManager
                .normalizeLocalPlayerForGameplay();
        }

        if (
            this.phase !== 'paint' &&
            !this.isMultiplayerSession()
        ) {
            return;
        }

        this.phase = 'hunt';
        this.syncPhaseMusic();

        this.tacticalSupportChosenThisHunt =
            false;

        /*
         * V1010474B_STANDALONE_MOBILE_PAINT_UX / HUNT_PIPETTE_CLEANUP
         * Paint-only pipette state must not survive onto the map.
         */
        this.stopMobileNativeEyedropperDrag();
        this.hideEyedropperMagnifier();
        this.eyedropperArmed = false;
        this.eyedropperPointerId = -1;
        this.mobilePendingPaintPointerId = -1;
        this.mobilePendingPaintStartScreen = undefined;
        this.mobilePendingPaintStartWorld = undefined;
        this.paintPreview?.setVisible(false);
        this.hideMobilePaintPrecisionGuide();
        this.updateEyedropperButtonUi();

        this.sniperActive = false;
        this.vulcanActive = false;
        this.vulcanSupportCommitted = false;
        this.vulcanFiring = false;
        this.vulcanPointerHeld = false;
        this.vulcanSpectatorViewActive = false;
        this.vulcanSpectatorSessionId = '';
        this.remoteVulcanActiveSessionIds.clear();
        this.remoteVulcanAimBySessionId.clear();
        this.vulcanHeat = 0;
        this.vulcanHeatUpdatedAt = 0;
        this.vulcanOverheated = false;
        this.vulcanCoolingDurationMs = 0;
        this.vulcanCinematicActive = false;
        this.vulcanReadyAt = 0;
        this.vulcanDarkness?.clear().setVisible(false);
        this.vulcanSpotlight?.clear().setVisible(false);
        this.vulcanCooldownGraphics?.clear().setVisible(false);
        this.vulcanCinematicShade?.setVisible(false).setAlpha(0);
        this.sniperAvailable = false;
        this.sniperReadyAt = 0;
        this.ensureSniperSupportUi();
        this.refreshSniperSupportUi();



        /*
         * V1010450V_PRACTICE_GAS_VISIBLE_FROM_ZERO
         * Practice initializes GAS while phase='paint', so the old update hid
         * the card and no later update occurred until the first fart. Refresh
         * immediately after Hunt becomes authoritative so GAS 0% is visible.
         */
        this.updateFartHud();

        if (this.isMultiplayerSession()) {
            /*
             * V1010432B_RESTORE_V369_PRE_HUNT_VISUAL_ORDER / START_HUNT_NO_REVEAL
             * Reveal is completed BEFORE startHunt(), matching v369.
             */
            this.hideLegacySinglePlayerActors();

            this.hiders.forEach(
                (hider) => {
                    this.setHiderVisible(
                        hider,
                        false,
                    );
                    hider.label.setVisible(
                        false,
                    );
                },
            );
        }

        this.timerText.setVisible(true);
        this.aimLine.setVisible(true);
        this.crosshair.setVisible(true);

        this.phaseEndTime =
            this.time.now +
            this.huntDuration * 1000;

        this.ammo = this.maxAmmo;
        this.canShoot = true;
        this.isReloading = false;
        this.isPainting = false;

        this.phaseText
            .setText('')
            .setVisible(false);

        if (
            this.isMultiplayerSession()
        ) {
            /*
             * Main match HUD no longer shows the large mid-left keyboard help.
             * Controls are already available from the help UI and this text
             * obscures gameplay on both Hunter and Hider.
             */
            this.guideText
                .setText('')
                .setVisible(false);
        } else {
            this.guideText.setText(
                tr('WASD 이동 · 마우스 조준 · 좌클릭 발사'),
            );
        }

        if (
            this.isMultiplayerSession()
        ) {
            this.hideLegacySinglePlayerActors();

            this.targetText
                .setText('')
                .setVisible(false);
        } else {
            this.player.setPosition(
                100,
                this.gameHeight / 2,
            );

            this.updateHunterObjects();

            this.player
                .setActive(true)
                .setVisible(true);

            this.gun
                .setActive(true)
                .setVisible(true);

            this.hunterLabel
                .setActive(true)
                .setVisible(true);

            this.hunterVisuals.forEach(
                ({ object }) => object.setVisible(true),
            );
        }

        this.selectionRing.setVisible(false);
        this.paintPreview.setVisible(false);

        this.paintColorText.setVisible(false);
        this.brushSizeText.setVisible(false);

        const localIsHunter =
            !this.isMultiplayerSession() ||
            this.networkPlayerManager
                .canLocalControlHunter() ||
            multiplayerClient
                .getLocalPlayer()
                ?.role === 'hunter';

        if (
            this.isMultiplayerSession()
        ) {
            /*
             * V1010450Z_MAIN_HUNT_TEXT_INTRO
             * Replace old transient Hunt guidance with the same clean,
             * text-only intro style used by Hider Practice.
             */
            this.clearStatus();
            this.showMainMatchHuntIntroText(
                localIsHunter,
            );
            this.time.delayedCall(320, () => {
                if (this.phase === 'hunt') this.showFirstHuntControlGuide();
            });
        }

        if (
            this.isMultiplayerSession() &&
            localIsHunter
        ) {
            this.createHunterControlsBottomHint();
        } else {
            this.destroyHunterControlsBottomHint();
        }

        if (localIsHunter) {
            this.sniperDiscoveryBubbleShown = false;
            this.hideFeatureDiscoveryBubble('sniper');
            this.scheduleHunterFartHintBubble();
        } else {
            this.hideFeatureDiscoveryBubble('sniper');
            this.destroyHunterFartHintBubble();
        }

        this.ammoText.setVisible(
            localIsHunter,
        );

        this.targetText.setVisible(
            !this.isMultiplayerSession() &&
            this.practiceMode ===
                null &&
            localIsHunter,
        );

        this.hiders.forEach((hider) => {
            hider.label.setVisible(false);
        });

        this.updateAmmoText();
        this.updateTargetText();

        /*
         * v0.10.10.236:
         * The top HUD already communicates Hunt state + remaining time.
         * Do not flash the redundant "N초 안에 하이더를 찾으세요" toast
         * to either Hunter or Hider when Hunt begins.
         */
        this.input.setDefaultCursor('none');
    }

    private getPracticeRankingPosition(
        elapsedMs:
            number,
    ): number | null {
        const records =
            this.getPracticeRankings(
                this.practiceHuntDuration,
            );

        const index =
            records.findIndex(
                (
                    record,
                ) =>
                    Math.abs(
                        record.elapsedMs -
                            elapsedMs,
                    ) <=
                        1 &&
                    record.botCount ===
                        this.practiceBotCount &&
                    record.precision ===
                        this.practiceBotPrecision,
            );

        return index >=
            0
            ? index +
                1
            : null;
    }

    private async createHunterPracticeShareBlob(
        elapsedMs:
            number,
    ): Promise<Blob | null> {
        const width =
            1080;
        const height =
            1350;

        const canvas =
            document.createElement(
                'canvas',
            );

        canvas.width =
            width;
        canvas.height =
            height;

        const context =
            canvas.getContext(
                '2d',
            );

        if (!context) {
            return null;
        }

        context.imageSmoothingEnabled =
            true;
        context.imageSmoothingQuality =
            'high';

        /*
         * Build the REAL selected map at the same 960x540 logical size used
         * in-game. We then reconstruct every bot with the same paint
         * silhouette, hide coordinate and five-step difficulty formula used by Practice.
         */
        const mapTextureKey =
            this.getBackgroundTextureKey(
                this.practiceMap,
            );

        const mapTexture =
            this.textures.get(
                mapTextureKey,
            );

        const mapSource =
            mapTexture.getSourceImage() as
                CanvasImageSource;

        const mapCanvas =
            document.createElement(
                'canvas',
            );

        mapCanvas.width =
            this.gameWidth;
        mapCanvas.height =
            this.gameHeight;

        const mapContext =
            mapCanvas.getContext(
                '2d',
                {
                    willReadFrequently:
                        true,
                },
            );

        if (!mapContext) {
            return null;
        }

        mapContext.imageSmoothingEnabled =
            true;

        mapContext.drawImage(
            mapSource,
            0,
            0,
            this.gameWidth,
            this.gameHeight,
        );

        const mapPixels =
            mapContext.getImageData(
                0,
                0,
                this.gameWidth,
                this.gameHeight,
            );

        const sampleMapColor =
            (
                worldX:
                    number,
                worldY:
                    number,
            ): {
                r:
                    number;
                g:
                    number;
                b:
                    number;
            } => {
                const x =
                    Phaser.Math.Clamp(
                        Math.round(
                            worldX,
                        ),
                        0,
                        this.gameWidth -
                            1,
                    );

                const y =
                    Phaser.Math.Clamp(
                        Math.round(
                            worldY,
                        ),
                        0,
                        this.gameHeight -
                            1,
                    );

                const offset =
                    (
                        y *
                            this.gameWidth +
                        x
                    ) *
                    4;

                return {
                    r:
                        mapPixels.data[
                            offset
                        ],
                    g:
                        mapPixels.data[
                            offset +
                                1
                        ],
                    b:
                        mapPixels.data[
                            offset +
                                2
                        ],
                };
            };

        const isPaintPixelInsideCharacter =
            (
                textureX:
                    number,
                textureY:
                    number,
            ): boolean => {
                const x =
                    Math.round(
                        textureX,
                    );
                const y =
                    Math.round(
                        textureY,
                    );

                const headDx =
                    x -
                    40;
                const headDy =
                    y -
                    48;

                const insideHead =
                    headDx *
                        headDx +
                    headDy *
                        headDy <=
                    12 *
                        12;

                const insideBody =
                    x >=
                        31 &&
                    x <=
                        48 &&
                    y >=
                        55 &&
                    y <=
                        78;

                const insideLeftArm =
                    x >=
                        24 &&
                    x <=
                        31 &&
                    y >=
                        57 &&
                    y <=
                        74;

                const insideRightArm =
                    x >=
                        48 &&
                    x <=
                        55 &&
                    y >=
                        57 &&
                    y <=
                        74;

                const insideLeftLeg =
                    x >=
                        31 &&
                    x <=
                        38 &&
                    y >=
                        75 &&
                    y <=
                        88;

                const insideRightLeg =
                    x >=
                        41 &&
                    x <=
                        48 &&
                    y >=
                        75 &&
                    y <=
                        88;

                return (
                    insideHead ||
                    insideBody ||
                    insideLeftArm ||
                    insideRightArm ||
                    insideLeftLeg ||
                    insideRightLeg
                );
            };

        /*
         * Dark frame + huge, brag-worthy clear time.
         */
        const background =
            context.createLinearGradient(
                0,
                0,
                width,
                height,
            );

        background.addColorStop(
            0,
            '#0d1c14',
        );
        background.addColorStop(
            0.55,
            '#173423',
        );
        background.addColorStop(
            1,
            '#08110d',
        );

        context.fillStyle =
            background;
        context.fillRect(
            0,
            0,
            width,
            height,
        );

        context.fillStyle =
            '#a8cfad';
        context.font =
            '900 24px Arial, sans-serif';
        context.fillText(
            'COLOR HUNT · HUNTER CHALLENGE',
            60,
            58,
        );

        context.fillStyle =
            '#ffffff';
        context.font =
            '900 52px Arial, sans-serif';
        context.fillText(
            tr('헌터 연습 성공!'),
            60,
            124,
        );

        const timeText =
            this.formatPracticeTime(
                elapsedMs,
            );

        context.fillStyle =
            '#ffffff';
        context.font =
            '900 196px Arial, sans-serif';
        context.fillText(
            timeText,
            52,
            300,
        );

        const rank =
            this.getPracticeRankingPosition(
                elapsedMs,
            );

        if (rank) {
            context.fillStyle =
                '#ffdf70';
            context.font =
                '900 58px Arial, sans-serif';
            context.fillText(
                `#${rank}`,
                62,
                350,
            );
        }

        if (
            this.practiceBotPrecision >=
                50
        ) {
            const extreme =
                this.practiceBotPrecision >=
                60;

            context.fillStyle =
                extreme
                    ? '#9f1f25'
                    : '#d94a43';
            context.beginPath();
            context.roundRect(
                width -
                    350,
                300,
                286,
                60,
                30,
            );
            context.fill();

            context.fillStyle =
                '#ffffff';
            context.font =
                '900 24px Arial, sans-serif';
            context.fillText(
                `${extreme ? '😈🔥' : '🔥'} ${this.getPracticeDifficultyLabel(this.practiceBotPrecision)}`,
                width -
                    326,
                340,
            );
        }

        /*
         * The actual map is the hero of the card.
         */
        const frameX =
            60;
        const frameY =
            390;
        const frameW =
            960;
        const frameH =
            540;

        context.save();

        context.beginPath();
        context.roundRect(
            frameX,
            frameY,
            frameW,
            frameH,
            28,
        );
        context.clip();

        context.drawImage(
            mapCanvas,
            0,
            0,
            this.gameWidth,
            this.gameHeight,
            frameX,
            frameY,
            frameW,
            frameH,
        );

        /*
         * Recreate every hidden bot exactly from its final hide coordinate.
         * The same pixel/dot camouflage algorithm used in Practice is rebuilt here.
         */
        this.hiders.forEach(
            (
                hider,
                botIndex,
            ) => {
                const botCanvas =
                    document.createElement(
                        'canvas',
                    );

                botCanvas.width =
                    80;
                botCanvas.height =
                    120;

                const botContext =
                    botCanvas.getContext(
                        '2d',
                    );

                if (!botContext) {
                    return;
                }

                const image =
                    botContext.createImageData(
                        80,
                        120,
                    );

                const difficultyRatio =
                    Phaser.Math.Clamp(
                        (
                            this.practiceBotPrecision -
                            20
                        ) /
                            40,
                        0,
                        1,
                    );

                const dabSize =
                    Math.round(
                        Phaser.Math.Linear(
                            9,
                            5,
                            difficultyRatio,
                        ),
                    );

                const maxError =
                    Phaser.Math.Linear(
                        118,
                        20,
                        difficultyRatio,
                    );

                for (
                    let textureY = 0;
                    textureY <
                    120;
                    textureY += 1
                ) {
                    for (
                        let textureX = 0;
                        textureX <
                        80;
                        textureX += 1
                    ) {
                        if (
                            !isPaintPixelInsideCharacter(
                                textureX,
                                textureY,
                            )
                        ) {
                            continue;
                        }

                        const blockX =
                            Math.floor(
                                textureX /
                                dabSize,
                            );

                        const blockY =
                            Math.floor(
                                textureY /
                                dabSize,
                            );

                        const sampled =
                            sampleMapColor(
                                hider.centerX +
                                    (
                                        blockX *
                                            dabSize +
                                        dabSize *
                                            0.5 -
                                        40
                                    ),
                                hider.centerY +
                                    (
                                        blockY *
                                            dabSize +
                                        dabSize *
                                            0.5 -
                                        60
                                    ),
                            );

                        const seed =
                            (
                                (
                                    blockX *
                                    73856093
                                ) ^
                                (
                                    blockY *
                                    19349663
                                ) ^
                                (
                                    (
                                        botIndex +
                                        1
                                    ) *
                                    83492791
                                )
                            ) >>>
                            0;

                        const error =
                            (
                                (
                                    seed %
                                    1001
                                ) /
                                500 -
                                1
                            ) *
                            maxError;

                        const r =
                            Phaser.Math.Clamp(
                                Math.round(
                                    sampled.r +
                                    error,
                                ),
                                0,
                                255,
                            );

                        const green =
                            Phaser.Math.Clamp(
                                Math.round(
                                    sampled.g +
                                    error *
                                        0.82,
                                ),
                                0,
                                255,
                            );

                        const b =
                            Phaser.Math.Clamp(
                                Math.round(
                                    sampled.b +
                                    error *
                                        0.68,
                                ),
                                0,
                                255,
                            );

                        const index =
                            (
                                textureY *
                                    80 +
                                textureX
                            ) *
                            4;

                        image.data[
                            index
                        ] =
                            r;
                        image.data[
                            index +
                                1
                        ] =
                            green;
                        image.data[
                            index +
                                2
                        ] =
                            b;
                        image.data[
                            index +
                                3
                        ] =
                            255;
                    }
                }

                botContext.putImageData(
                    image,
                    0,
                    0,
                );

                const scaleX =
                    frameW /
                    this.gameWidth;
                const scaleY =
                    frameH /
                    this.gameHeight;

                const drawW =
                    80 *
                    scaleX;
                const drawH =
                    120 *
                    scaleY;

                const drawX =
                    frameX +
                    (
                        hider.centerX -
                        40
                    ) *
                    scaleX;

                const drawY =
                    frameY +
                    (
                        hider.centerY -
                        60
                    ) *
                    scaleY;

                context.imageSmoothingEnabled =
                    false;

                context.drawImage(
                    botCanvas,
                    drawX,
                    drawY,
                    drawW,
                    drawH,
                );

                /*
                 * Reveal where the player eventually found this bot.
                 */
                const markerX =
                    frameX +
                    hider.centerX *
                    scaleX;

                const markerY =
                    frameY +
                    hider.centerY *
                    scaleY;

                const markerRadius =
                    34;

                context.strokeStyle =
                    'rgba(255,255,255,.98)';
                context.lineWidth =
                    8;
                context.beginPath();
                context.arc(
                    markerX,
                    markerY,
                    markerRadius,
                    0,
                    Math.PI *
                        2,
                );
                context.stroke();

                context.strokeStyle =
                    'rgba(255,74,74,.96)';
                context.lineWidth =
                    4;
                context.beginPath();
                context.arc(
                    markerX,
                    markerY,
                    markerRadius -
                        7,
                    0,
                    Math.PI *
                        2,
                );
                context.stroke();

                context.fillStyle =
                    '#ff4a4a';
                context.font =
                    '900 18px Arial, sans-serif';
                context.textAlign =
                    'center';
                context.fillText(
                    String(
                        botIndex +
                            1,
                    ),
                    markerX,
                    markerY -
                        markerRadius -
                        10,
                );

                context.textAlign =
                    'left';
            },
        );

        context.restore();

        context.strokeStyle =
            'rgba(255,255,255,.74)';
        context.lineWidth =
            4;
        context.beginPath();
        context.roundRect(
            frameX,
            frameY,
            frameW,
            frameH,
            28,
        );
        context.stroke();

        /*
         * Large, readable summary under the image.
         */
        context.fillStyle =
            '#ffffff';
        context.font =
            '900 34px Arial, sans-serif';
        context.fillText(
            `${this.getMapDisplayName(this.practiceMap)} · ${this.practiceBotCount} BOT`,
            62,
            990,
        ); 



        context.fillStyle =
            '#ffef9c';
        context.font =
            '900 31px Arial, sans-serif';
        context.fillText(
            `🎭 ${this.getPracticeDifficultyTitle()} · ${this.getPracticeDifficultyLabel(this.practiceBotPrecision)}`,
            62,
            1032,
        );

        context.fillStyle =
            '#9fc4a6';
        context.font =
            '900 24px Arial, sans-serif';
        context.fillText(
            `🏆 ${this.practiceHuntDuration}s TOP 5`,
            62,
            1074,
        );

        const records =
            this.getPracticeRankings(
                this.practiceHuntDuration,
            );

        records
            .slice(
                0,
                5,
            )
            .forEach(
                (
                    record,
                    index,
                ) => {
                    const y =
                        1118 +
                        index *
                            36;

                    context.fillStyle =
                        index ===
                            0
                            ? '#ffdf70'
                            : '#ffffff';

                    context.font =
                        '900 21px Arial, sans-serif';

                    context.fillText(
                        `#${index + 1}  ${this.formatPracticeTime(record.elapsedMs)}`,
                        64,
                        y,
                    );

                    context.textAlign =
                        'right';
                    context.fillStyle =
                        '#95aa99';
                    context.font =
                        '800 17px Arial, sans-serif';

                    context.fillText(
                        `${record.botCount} BOT · ${this.getPracticeDifficultyLabel(record.precision)}`,
                        width -
                            64,
                        y,
                    );

                    context.textAlign =
                        'left';
                },
            );

        const shareUrl =
            this.getPracticeShareUrl();

        context.fillStyle =
            '#7be58c';
        context.font =
            '900 25px Arial, sans-serif';
        context.fillText(
            shareUrl,
            62,
            height -
                34,
        );

        return await new Promise<
            Blob | null
        >(
            (
                resolve,
            ) => {
                canvas.toBlob(
                    resolve,
                    'image/png',
                    1,
                );
            },
        );
    }

    private async shareHunterPracticeRecord(
        elapsedMs:
            number,
    ): Promise<void> {
        const blob =
            await this.createHunterPracticeShareBlob(
                elapsedMs,
            );

        if (!blob) {
            this.showStatus(
                tr('기록 이미지를 만들 수 없습니다.'),
            );
            return;
        }

        const shareUrl =
            this.getPracticeShareUrl();

        const file =
            new File(
                [
                    blob,
                ],
                `color-hunt-hunter-${Date.now()}.png`,
                {
                    type:
                        'image/png',
                },
            );

        const text =
            `${tr('내 헌터 기록을 깨봐! Color Hunt에서 도전하기 👇')}\n${shareUrl}`;

        const copied =
            await this.copyPracticeGameLink();

        try {
            if (
                navigator.share &&
                (
                    !navigator.canShare ||
                    navigator.canShare({
                        files: [
                            file,
                        ],
                    })
                )
            ) {
                try {
                    await navigator.share({
                        title:
                            'Color Hunt',
                        text,
                        url:
                            shareUrl,
                        files: [
                            file,
                        ],
                    });

                    if (copied) {
                        this.showStatus(
                            tr('공유 완료 · 게임 링크도 복사되어 있어요!'),
                        );
                    }

                    return;
                } catch (
                    richShareError
                ) {
                    if (
                        richShareError instanceof
                            DOMException &&
                        richShareError.name ===
                            'AbortError'
                    ) {
                        return;
                    }

                    await navigator.share({
                        title:
                            'Color Hunt',
                        text:
                            `${text}
${shareUrl}`,
                        files: [
                            file,
                        ],
                    });

                    return;
                }
            }

            if (navigator.share) {
                await navigator.share({
                    title:
                        'Color Hunt',
                    text:
                        tr('내 헌터 기록을 깨봐! Color Hunt에서 도전하기 👇'),
                    url:
                        shareUrl,
                });

                this.downloadHunterPracticeRecord(
                    blob,
                );

                return;
            }
        } catch (
            error
        ) {
            if (
                error instanceof
                    DOMException &&
                error.name ===
                    'AbortError'
            ) {
                return;
            }
        }

        this.downloadHunterPracticeRecord(
            blob,
        );

        this.showStatus(
            copied
                ? tr('이미지를 저장하고 게임 링크를 복사했습니다!')
                : tr('이미지를 저장했습니다.'),
        );
    }

    private downloadHunterPracticeRecord(
        blob:
            Blob,
    ): void {
        const url =
            URL.createObjectURL(
                blob,
            );

        const anchor =
            document.createElement(
                'a',
            );

        anchor.href =
            url;
        anchor.download =
            `color-hunt-hunter-${Date.now()}.png`;

        document.body.appendChild(
            anchor,
        );
        anchor.click();
        anchor.remove();

        window.setTimeout(
            () => {
                URL.revokeObjectURL(
                    url,
                );
            },
            1_000,
        );
    }

    private revealPracticeBotsBeforeResult(
        reason:
            'time' |
            'ammo' =
                'time',
    ): void {
        if (
            this.practiceMode !==
                'hunter'
        ) {
            return;
        }

        this.phase =
            'hiderVictory';

        /*
         * v0.10.10.215:
         * A timeout reveal is the actual end of the countdown. Force every
         * visible timer source to zero before the camera/result UI changes so
         * the last rendered frame can never remain stuck on 1s.
         */
        this.phaseEndTime = this.time.now;
        this.survivalHudText
            .setText('⏱ 0s');
        this.timerText
            .setText(tr('TIME 0'));

        this.canShoot = false;
        this.clearAllAimingVisuals();
        this.stopAllBgm();

        /*
         * v0.10.10.212:
         * Practice failure is a learning moment, not an auto-dismiss toast.
         * Pull the camera back to the complete 960x540 map, make every
         * surviving BOT flash red, and keep the reveal on screen until the
         * player explicitly confirms it.
         */
        this.resetGameplayCamera();
        this.cameras.main
            .stopFollow()
            .removeBounds()
            .setZoom(1)
            .setScroll(0, 0);

        this.networkPlayerManager
            .setNamesVisible(
                true,
            );

        this.clearPracticeRevealState();

        /* The player must be able to see/click the confirm button on desktop. */
        this.input.setDefaultCursor('default');
        this.game.canvas.style.cursor = 'default';
        this.destroyPracticeDesktopHint();

        this.hiders.forEach(
            (
                hider,
                index,
            ) => {
                if (!hider.alive) {
                    return;
                }

                const ring =
                    this.add.circle(
                        hider.centerX,
                        hider.centerY,
                        39,
                        0xff2b2b,
                        0.08,
                    )
                        .setStrokeStyle(
                            5,
                            0xff2b2b,
                            1,
                        )
                        .setDepth(
                            4998,
                        );

                this.practiceRevealMarkers.push(
                    ring,
                );

                this.practiceRevealTweens.push(
                    this.tweens.add({
                        targets: ring,
                        scale: 1.25,
                        alpha: {
                            from: 0.35,
                            to: 1,
                        },
                        duration: 420,
                        yoyo: true,
                        repeat: -1,
                    }),
                );

                this.getAllPartObjects(
                    hider,
                ).forEach(
                    (part) => {
                        const bounds =
                            part.getBounds();
                        const overlay =
                            part instanceof
                                Phaser.GameObjects.Arc
                                ? this.add.circle(
                                    bounds.centerX,
                                    bounds.centerY,
                                    Math.max(
                                        bounds.width,
                                        bounds.height,
                                    ) / 2,
                                    0xff2020,
                                    0.72,
                                )
                                : this.add.rectangle(
                                    bounds.centerX,
                                    bounds.centerY,
                                    bounds.width,
                                    bounds.height,
                                    0xff2020,
                                    0.72,
                                );

                        overlay.setDepth(
                            4997,
                        );
                        this.practiceRevealMarkers.push(
                            overlay,
                        );
                        this.practiceRevealTweens.push(
                            this.tweens.add({
                                targets: overlay,
                                alpha: {
                                    from: 0.18,
                                    to: 0.92,
                                },
                                duration: 360,
                                yoyo: true,
                                repeat: -1,
                            }),
                        );
                    },
                );

                const label =
                    this.add.text(
                        hider.centerX,
                        hider.centerY - 50,
                        `BOT ${index + 1}`,
                        {
                            fontFamily:
                                'Arial, sans-serif',
                            fontSize:
                                '15px',
                            fontStyle:
                                'bold',
                            color:
                                '#ffffff',
                            backgroundColor:
                                '#c91f1fe8',
                            padding: {
                                x: 8,
                                y: 4,
                            },
                        },
                    )
                        .setOrigin(
                            0.5,
                        )
                        .setDepth(
                            4999,
                        );

                this.practiceRevealMarkers.push(
                    label,
                );
            },
        );

        this.showStatus(
            reason ===
                'ammo'
                ? tr('탄약 소진! 남은 봇의 위치를 확인하세요.')
                : tr('시간 종료! 남은 봇의 위치를 확인하세요.'),
        );

        this.cameras.main.flash(
            180,
            255,
            80,
            80,
        );

        const confirmButton =
            document.createElement(
                'button',
            );
        confirmButton.type =
            'button';
        confirmButton.className =
            'colorhunt-practice-reveal-confirm';
        confirmButton.textContent =
            `✓ ${tr('위치 확인 완료')}`;
        document.body.appendChild(
            confirmButton,
        );
        this.practiceRevealConfirmButton = confirmButton;

        /* Force above Phaser canvas/HUD even on browsers with unusual stacks. */
        confirmButton.style.pointerEvents = 'auto';
        confirmButton.style.visibility = 'visible';
        confirmButton.style.display = 'block';

        /*
         * Keep the confirmation action INSIDE the visible game canvas.
         * A viewport-bottom fixed button could sit below letterboxed canvases
         * and looked as if it did not exist.
         */
        const placeConfirmInsideGame = (): void => {
            if (this.practiceRevealConfirmButton !== confirmButton) return;
            const rect = this.game.canvas.getBoundingClientRect();
            confirmButton.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
            confirmButton.style.top = `${Math.round(Math.max(rect.top + 12, rect.bottom - 76))}px`;
            confirmButton.style.bottom = 'auto';
        };
        placeConfirmInsideGame();
        requestAnimationFrame(placeConfirmInsideGame);
        window.setTimeout(placeConfirmInsideGame, 120);
        window.addEventListener('resize', placeConfirmInsideGame, { passive: true, once: true });

        this.input.setDefaultCursor('default');
        this.game.canvas.style.cursor = 'default';

        const finishReveal =
            (): void => {
                this.clearPracticeRevealState();

                if (
                    this.practiceMode ===
                        'hunter'
                ) {
                    this.showPracticeResult(
                        false,
                        reason,
                    );
                }
            };

        confirmButton.addEventListener(
            'click',
            finishReveal,
            {
                once: true,
            },
        );
    }

    private showPracticeResult(
        won:
            boolean,
        reason:
            'time' |
            'ammo' =
                'time',
    ): void {
        this.destroyPracticeHiderRecordBar();
        if (
            this.menuModalOverlay
                ?.classList.contains(
                    'colorhunt-practice-result-overlay',
                )
        ) {
            return;
        }

        this.phase =
            won
                ? 'hunterVictory'
                : 'hiderVictory';

        const elapsedMs =
            this.practiceStartedAt >
                0
                ? Math.max(
                    1,
                    Date.now() -
                        this.practiceStartedAt,
                )
                : 0;

        if (
            won &&
            elapsedMs >
                0
        ) {
            this.savePracticeRanking(
                elapsedMs,
            );
        }

        this.canShoot =
            false;
        this.clearAllAimingVisuals();
        this.stopAllBgm();
        if (
            this.practiceExitButton
        ) {
            this.practiceExitButton.hidden =
                true;
        }

        this.closeMenuModal();

        const overlay =
            document.createElement(
                'div',
            );
        overlay.className =
            'colorhunt-practice-result-overlay';

        const card =
            document.createElement(
                'div',
            );
        card.className =
            `colorhunt-practice-result-card ${
                won
                    ? 'is-win'
                    : reason === 'ammo'
                        ? 'is-ammo'
                        : 'is-timeup'
            }`;

        const records =
            this.getPracticeRankings(
                this.practiceHuntDuration,
            );

        const rankingHtml =
            records.length >
                0
                ? records
                    .map(
                        (
                            record,
                            index,
                        ) =>
                            `<div class="colorhunt-practice-result-rank"><b>${index + 1}</b><span>${this.formatPracticeTime(record.elapsedMs)}</span><small>🗺️ ${record.map ? this.getMapDisplayName(record.map) : tr('맵 미상')} · ${record.botCount} BOT · ${this.getPracticeDifficultyLabel(record.precision)}</small></div>`,
                    )
                    .join('')
                : `<div class="colorhunt-practice-result-empty">${tr('아직 기록이 없습니다.')}</div>`;

        card.innerHTML = `
            <div class="colorhunt-practice-result-kicker">
                ${tr('PRACTICE RESULT')}
            </div>
            <div class="colorhunt-practice-result-icon">
                ${won ? '🏆' : reason === 'ammo' ? '🔴' : '⏱️'}
            </div>
            <h2>
                ${
                    won
                        ? tr('헌터 연습 성공!')
                        : reason === 'ammo'
                            ? tr('탄약 소진! 연습 종료')
                            : tr('연습 시간 종료')
                }
            </h2>
            <p>
                ${
                    won
                        ? `${tr('모든 봇을 찾았습니다.')} · ${this.formatPracticeTime(elapsedMs)}`
                        : reason === 'ammo'
                            ? tr('모든 탄약을 사용했습니다. 다시 연습해서 탄약 관리와 과열 타이밍을 익혀보세요.')
                            : tr('시간 안에 모든 봇을 찾지 못했습니다.')
                }
            </p>

            <div class="colorhunt-practice-result-meta">
                <span>🗺️ ${this.getMapDisplayName(this.practiceMap)}</span>
                <span>${this.practiceHuntDuration}s</span>
                <span>${this.practiceBotCount} BOT</span>
                <span>🎭 ${this.getPracticeDifficultyTitle()} · ${this.getPracticeDifficultyLabel(this.practiceBotPrecision)}</span>
            </div>

            <div class="colorhunt-practice-result-ranking">
                <strong>🏆 ${this.practiceHuntDuration}s · ${tr('TOP 5')}</strong>
                ${rankingHtml}
            </div>

            ${
                won
                    ? `<button type="button" class="colorhunt-practice-result-share" data-practice-share>
                        📤 ${tr('헌터 기록 공유')}
                    </button>`
                    : ''
            }

            <button type="button" data-practice-return>
                🎯 ${tr('연습장으로 돌아가기')}
            </button>
        `;

        overlay.appendChild(
            card,
        );
        document.body.appendChild(
            overlay,
        );


        this.menuModalOverlay =
            overlay;
        this.input.enabled =
            false;

        card.querySelector(
            '[data-practice-share]',
        )?.addEventListener(
            'click',
            () => {
                void this.shareHunterPracticeRecord(
                    elapsedMs,
                );
            },
        );

        card.querySelector(
            '[data-practice-return]',
        )?.addEventListener(
            'click',
            () => {
                this.closeMenuModal();
                this.exitPracticeMode(
                    true,
                );
            },
        );
    }

    private clearVulcanForResultCapture(): void {
        this.sniperButton
            ?.disableInteractive()
            .setVisible(false);

        this.vulcanButton
            ?.disableInteractive()
            .setVisible(false);





        this.remoteVulcanFiringSessionIds
            .clear();


        this.removeVulcanDomInputBridge();
        this.stopVulcanRuntimeTimer();

        this.vulcanActive =
            false;

        this.vulcanCinematicActive =
            false;

        this.vulcanSpectatorViewActive =
            false;

        this.vulcanPointerHeld =
            false;

        this.vulcanFiring =
            false;


        this.vulcanSpotlight
            ?.clear()
            .setVisible(false);

        this.vulcanDarkness
            ?.clear()
            .setVisible(false);

        this.vulcanCinematicShade
            ?.setVisible(false)
            .setAlpha(0);

        this.vulcanCooldownGraphics
            ?.clear()
            .setVisible(false);

        this.vulcanImpactFx
            .forEach(
                (fx) =>
                    fx.destroy(),
            );

        this.vulcanImpactFx
            .clear();

        this.vulcanHelicopterRotorTween
            ?.stop();

        this.vulcanHelicopterRotorTween =
            undefined;

        this.vulcanHelicopter
            ?.destroy(true);

        this.vulcanHelicopter =
            undefined;

        /*
         * Vulcan intentionally reuses Sniper's helicopter ambience.
         */
        if (
            this.sniperHelicopterSound
                ?.isPlaying
        ) {
            this.sniperHelicopterSound
                .stop();
        }

        this.networkPlayerManager
            ?.setLocalMovementHardLocked(
                false,
            );

        const camera =
            this.cameras.main;

        this.tweens.killTweensOf(
            camera,
        );

        camera
            .resetFX()
            .setRotation(0)
            .setZoom(
                this.vulcanSavedCameraZoom ||
                    1.65,
            );

        this.applyFixedHudForZoom(
            camera.zoom,
        );

        /*
         * Tactical support music must not leak into WIN/LOSE/result.
         */
        this.stopSniperTacticalBgm(
            true,
        );
    }


    private showHunterVictory(): void {
        this.sniperButton
            ?.disableInteractive()
            .setVisible(false);

        this.vulcanButton
            ?.disableInteractive()
            .setVisible(false);

        this.clearVulcanForResultCapture();
        if (
            this.practiceMode ===
                'hunter'
        ) {
            this.phase =
                'hunterVictory';
            this.showPracticeResult(
                true,
            );
            return;
        }

        if (this.isMultiplayerSession()) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hunterVictory';
        this.stopAllBgm();
        this.victorySound?.play();

        this.phaseText.setText(
            tr('🏆 HUNTER VICTORY'),
        );

        this.timerText
            .setText(tr('HUNTER WIN'))
            .setColor('#ffdf70');

        this.guideText.setText(
            tr('모든 하이더를 발견했습니다 · 자동으로 대기실로 이동'),
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.showStatus(
            tr('모든 하이더를 찾았습니다!'),
        );

        this.cameras.main.flash(
            350,
            255,
            255,
            255,
        );

        this.input.setDefaultCursor('default');

    }

    private showHiderVictory(): void {
        this.sniperButton
            ?.disableInteractive()
            .setVisible(false);

        this.vulcanButton
            ?.disableInteractive()
            .setVisible(false);

        this.clearVulcanForResultCapture();
        if (
            this.practiceMode ===
                'hunter'
        ) {
            this.phase =
                'hiderVictory';
            this.revealPracticeBotsBeforeResult(
                'time',
            );
            return;
        }

        if (
            this.isMultiplayerSession()
        ) {
            return;
        }

        if (this.phase !== 'hunt') {
            return;
        }

        this.phase = 'hiderVictory';
        this.stopAllBgm();
        this.victorySound?.play();

        this.phaseText.setText(
            tr('🌿 HIDER VICTORY'),
        );

        this.timerText
            .setText(tr('HIDERS WIN'))
            .setColor('#8cff9b');

        this.guideText.setText(
            tr('시간 종료 · 자동으로 대기실로 이동'),
        );

        this.player.setVisible(false);
        this.hunterVisuals.forEach(({ object }) => object.setVisible(false));
        this.gun.setVisible(false);
        this.hunterLabel.setVisible(false);

        this.aimLine.clear();
        this.crosshair.clear();

        this.hiders.forEach((hider) => {
            if (!hider.alive) {
                return;
            }

            hider.label
                .setText(tr('SURVIVED'))
                .setColor('#8cff9b')
                .setVisible(true);

            const targets: Phaser.GameObjects.GameObject[] = [
                ...this.getAllPartObjects(hider),
                    hider.paintTexture,
            ];

            this.tweens.add({
                targets,
                scale: 1.18,
                duration: 220,
                yoyo: true,
                repeat: 2,
            });
        });

        this.cameras.main.flash(
            350,
            100,
            255,
            140,
        );

        this.input.setDefaultCursor('default');
    }


    private setHiderVisible(
        hider: Hider,
        visible: boolean,
    ): void {
        this.getAllPartObjects(hider).forEach(
            (object) => {
                object
                    .setVisible(visible)
                    .setAlpha(1)
                    .setScale(1);
            },
        );

        hider.paintTexture
            .setVisible(visible)
            .setAlpha(1)
            .setScale(1);
    }

    private getAliveHiderCount(): number {
        return this.hiders.filter(
            (hider) => hider.alive,
        ).length;
    }

    private getCurrentBrushTextureKey(): string {
        return [
            'paint-brush',
            this.brushShape,
            String(this.brushSize),
            this.paintColor
                .toString(16)
                .padStart(6, '0'),
        ].join('-');
    }

    private createBrushTexture(force = false): void {
        this.brushTextureKey =
            this.getCurrentBrushTextureKey();

        if (
            this.textures.exists(
                this.brushTextureKey,
            )
        ) {
            if (!force) {
                return;
            }

            this.textures.remove(
                this.brushTextureKey,
            );
        }

        if (this.brushSize === 1) {
            const graphics =
                this.add.graphics();

            graphics.fillStyle(
                this.paintColor,
                1,
            );
            graphics.fillRect(
                0,
                0,
                1,
                1,
            );
            graphics.generateTexture(
                this.brushTextureKey,
                1,
                1,
            );
            this.textures
                .get(this.brushTextureKey)
                .setFilter(
                    Phaser.Textures
                        .FilterMode.NEAREST,
                );
            graphics.destroy();
            return;
        }

        const diameter = Math.max(
            2,
            Math.round(this.brushSize),
        );
        const radius = diameter / 2;

        const graphics =
            this.add.graphics();

        graphics.fillStyle(
            this.paintColor,
            1,
        );

        if (
            this.brushShape ===
            'dotCircle'
        ) {
            for (
                let y = -radius;
                y <= radius;
                y += 1
            ) {
                const halfWidth =
                    Math.floor(
                        Math.sqrt(
                            Math.max(
                                0,
                                radius * radius -
                                y * y,
                            ),
                        ),
                    );

                graphics.fillRect(
                    radius - halfWidth,
                    radius + y,
                    halfWidth * 2 + 1,
                    1,
                );
            }
        } else if (
            this.brushShape ===
            'circle'
        ) {
            graphics.fillCircle(
                radius,
                radius,
                radius,
            );
        } else {
            graphics.fillRect(
                0,
                0,
                diameter,
                diameter,
            );
        }

        graphics.generateTexture(
            this.brushTextureKey,
            diameter,
            diameter,
        );

        this.textures
            .get(this.brushTextureKey)
            .setFilter(
                Phaser.Textures.FilterMode.NEAREST,
            );

        graphics.destroy();
    }

}

export default GameScene;