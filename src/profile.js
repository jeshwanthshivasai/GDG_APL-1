/**
 * profile.js — User profile management
 * Persists profile settings in localStorage and dispatches change events.
 */

const PROFILE_KEY = 'daiy_profile';

const DEFAULT_PROFILE = {
  name: 'Guest User',
  email: '',
  avatarColor: '#6366f1' // Solid Indigo default
};

/**
 * Load user profile from localStorage or return defaults
 * @returns {object}
 */
export function loadProfile() {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
  } catch (err) {
    console.warn('Failed to load profile from localStorage:', err);
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Save user profile to localStorage and dispatch custom event
 * @param {object} profileData 
 */
export function saveProfile(profileData) {
  try {
    const updated = { ...DEFAULT_PROFILE, ...profileData };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    
    // Dispatch update notification
    window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }));
    return true;
  } catch (err) {
    console.error('Failed to save profile to localStorage:', err);
    return false;
  }
}
