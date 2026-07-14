/**
 * Simple Haptic Feedback Utility
 * Wraps navigator.vibrate for compatible devices (Android/Some Browsers)
 * Note: iOS Safari does not support navigator.vibrate for haptics yet, 
 * but this setups the structure for when it does or for WebApp wrappers.
 * 
 * For true iOS Haptics in a PWA, we mostly rely on the "feel" of instant touch response
 * via CSS active states (-webkit-tap-highlight-color: transparent) which we added.
 */

export const triggerHaptic = (pattern: number | number[] = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Ignore errors if vibration is not supported/allowed
        }
    }
};

export const HapticPatterns = {
    Light: 5,
    Medium: 10,
    Heavy: 20,
    Success: [10, 30, 10],
    Error: [50, 30, 50]
};
