import { Capacitor } from '@capacitor/core';

export const isNativeIos = Capacitor.getPlatform() === 'ios';
