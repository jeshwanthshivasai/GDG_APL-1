/**
 * analytics.js — DAIY Analytics via Firebase Firestore
 * Tracks anonymous session metadata and usage patterns.
 * No PII is collected. Data is write-only from the client.
 */

import { getFirestore, collection, doc, setDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { app } from './firebase.js';
import { loadProfile } from './profile.js';

let db = null;
let sessionId = null;
let sessionDocRef = null;

/**
 * Initialize Firebase and create a session document in Firestore.
 * Call this once on app startup.
 */
export async function initAnalytics() {
  try {
    db = getFirestore(app);

    sessionId = crypto.randomUUID();
    sessionDocRef = doc(collection(db, 'sessions'), sessionId);

    const isDarkMode = !document.body.classList.contains('light-theme');

    // Fetch IP address (from CORS-enabled api.ipify.org API)
    let ipAddress = 'unknown';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        ipAddress = ipData.ip || 'unknown';
      }
    } catch (err) {
      console.warn('IP fetch failed (non-critical):', err.message);
    }

    const profile = loadProfile();

    const sessionData = {
      sessionId,
      ipAddress,
      userProfile: {
        name: profile.name,
        email: profile.email
      },
      timestamp: new Date().toISOString(),
      userAgent: (navigator.userAgent || '').substring(0, 500),
      language: navigator.language || 'unknown',
      screenSize: `${screen.width}x${screen.height}`,
      viewportSize: `${innerWidth}x${innerHeight}`,
      platform: (navigator.platform || navigator.userAgentData?.platform || 'unknown').substring(0, 50),
      referrer: (document.referrer || '').substring(0, 500),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      darkMode: isDarkMode,
      cameraUsed: false,
      queriesCount: 0,
      queries: [],
      location: null
    };

    await setDoc(sessionDocRef, sessionData);

    // Attempt geolocation (user will be prompted)
    requestGeolocation();

    console.log('📊 DAIY Analytics initialized — session:', sessionId);
  } catch (err) {
    // Analytics should never break the app
    console.warn('Analytics init failed (non-critical):', err.message);
  }
}

/**
 * Request geolocation and update the session document.
 * This will prompt the user for permission.
 */
function requestGeolocation() {
  if (!('geolocation' in navigator) || !sessionDocRef) return;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;

        // Reverse geocode using a free API to get city/country
        let city = 'unknown';
        let country = 'unknown';
        try {
          const res = await fetch(`https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const geo = await res.json();
            city = geo.address?.city || geo.address?.town || geo.address?.village || 'unknown';
            country = geo.address?.country || 'unknown';
          }
        } catch {
          // Reverse geocode failed — we still have lat/lng
        }

        await updateDoc(sessionDocRef, {
          location: {
            lat: Math.round(latitude * 100) / 100, // Round to ~1km precision for privacy
            lng: Math.round(longitude * 100) / 100,
            city: city.substring(0, 100),
            country: country.substring(0, 100)
          }
        });
      } catch (err) {
        console.warn('Geolocation update failed:', err.message);
      }
    },
    () => {
      // User denied — that's fine, we just skip it
      console.log('📊 Geolocation permission denied — skipping');
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

/**
 * Track a voice query event.
 * @param {string} transcript — User's voice input (truncated to 50 chars for privacy)
 * @param {boolean} usedCamera — Whether camera was active during the query
 */
export async function trackQuery(transcript, usedCamera) {
  if (!sessionDocRef) return;

  try {
    await updateDoc(sessionDocRef, {
      queriesCount: increment(1),
      cameraUsed: usedCamera || false,
      queries: arrayUnion({
        text: transcript || '', // Log full user query text to capture their exact purpose
        camera: !!usedCamera,
        time: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn('Analytics trackQuery failed:', err.message);
  }
}

/**
 * Track a general event.
 * @param {string} name — Event name
 * @param {object} data — Event metadata
 */
export async function trackEvent(name, data = {}) {
  if (!sessionDocRef) return;

  try {
    await updateDoc(sessionDocRef, {
      queries: arrayUnion({
        event: name,
        ...data,
        time: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn('Analytics trackEvent failed:', err.message);
  }
}

/**
 * Update the session document with current profile details.
 * @param {object} profile 
 */
export async function updateAnalyticsProfile(profile) {
  if (!sessionDocRef) return;

  try {
    await updateDoc(sessionDocRef, {
      userProfile: {
        name: profile.name || 'Guest User',
        email: profile.email || ''
      }
    });
  } catch (err) {
    console.warn('Analytics updateAnalyticsProfile failed:', err.message);
  }
}
