// ======================== Определение платформы (web / ios / android) ========================

function cap() {
    return globalThis.__cap || null;
}

/**
 * Определяет окружение:
 * - Capacitor native (iOS / Android)
 * - веб (включая PWA)
 * - форс через ?platform=ios|android|web
 */
export function detectPlatform() {
    const params = new URLSearchParams(location.search);
    const forced = (params.get('platform') || '').toLowerCase();
    if (forced === 'ios' || forced === 'android' || forced === 'web') {
        return {
            name: forced,
            isNative: forced === 'ios' || forced === 'android',
            isWeb: forced === 'web',
        };
    }

    const Cap = cap()?.Capacitor || globalThis.Capacitor;
    if (Cap?.isNativePlatform?.()) {
        const name = (Cap.getPlatform?.() || 'android').toLowerCase();
        return { name, isNative: true, isWeb: false };
    }

    // Маркер из scripts/build-www.js
    if (document.body?.dataset?.build === 'native' || document.body?.classList?.contains('is-native')) {
        return { name: 'native', isNative: true, isWeb: false };
    }

    return { name: 'web', isNative: false, isWeb: true };
}

/**
 * Применяет CSS-классы и настраивает нативные плагины.
 */
export async function applyPlatform() {
    const platform = detectPlatform();
    const { body } = document;

    body.classList.toggle('is-web', platform.isWeb);
    body.classList.toggle('is-native', platform.isNative);
    body.classList.toggle('is-ios', platform.name === 'ios');
    body.classList.toggle('is-android', platform.name === 'android');

    const plugins = cap();
    if (platform.isNative && plugins) {
        try {
            const { StatusBar, Style, SplashScreen, App } = plugins;
            if (StatusBar) {
                await StatusBar.setStyle({ style: Style?.Dark || 'DARK' });
                await StatusBar.setBackgroundColor({ color: '#0a1a2e' });
                if (platform.name === 'android') {
                    await StatusBar.setOverlaysWebView({ overlay: false });
                }
            }
            if (SplashScreen) {
                await SplashScreen.hide();
            }
            if (App?.addListener) {
                App.addListener('backButton', ({ canGoBack }) => {
                    const open = document.querySelector('.modal-overlay.visible');
                    if (open) {
                        open.classList.remove('visible');
                        return;
                    }
                    if (!canGoBack) App.exitApp();
                });
            }
        } catch (_) {
            // Плагины могут быть недоступны в предпросмотре ?platform=
        }
    }

    return platform;
}

/** Лёгкая вибрация при слиянии плиток (только native). */
export async function hapticLight() {
    try {
        const plugins = cap();
        if (plugins?.Haptics) {
            await plugins.Haptics.impact({
                style: plugins.ImpactStyle?.Light || 'LIGHT',
            });
        }
    } catch (_) {}
}

/** Сильная вибрация при взрыве бомбы/молнии (только native). */
export async function hapticHeavy() {
    try {
        const plugins = cap();
        if (plugins?.Haptics) {
            await plugins.Haptics.impact({
                style: plugins.ImpactStyle?.Heavy || 'HEAVY',
            });
        }
    } catch (_) {}
}
