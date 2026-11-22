import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeIos } from './ios';

export const triggerHaptic = (pattern: number | number[] = 10) => {
    if (isNativeIos) {
        const feedback = Array.isArray(pattern)
            ? Haptics.notification({ type: pattern[0] >= 50 ? NotificationType.Error : NotificationType.Success })
            : Haptics.impact({ style: pattern >= 20 ? ImpactStyle.Heavy : pattern >= 10 ? ImpactStyle.Medium : ImpactStyle.Light });
        void feedback.catch(() => undefined);
        return;
    }
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
