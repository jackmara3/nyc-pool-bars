(function () {
  'use strict';

  // Initialize Supabase client
  const supabase = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey
  );

  const RATING_KEYS = [
    'tableQuality',
    'competitionLevel',
    'atmosphere',
    'elbowRoom',
    'waitTime',
    'cueQuality',
    'drinkSelection',
    'crowdVibe',
  ];
  const RATING_LABELS = {
    tableQuality: 'Table Quality',
    competitionLevel: 'Competition',
    atmosphere: 'Atmosphere',
    elbowRoom: 'Elbow Room',
    waitTime: 'Wait Time',
    cueQuality: 'Cue Quality',
    drinkSelection: 'Drink Selection',
    crowdVibe: 'Crowd Vibe',
  };

  // Map database column names to frontend keys
  const DB_TO_FRONTEND = {
    table_quality: 'tableQuality',
    competition: 'competitionLevel',
    atmosphere: 'atmosphere',
    elbow_room: 'elbowRoom',
    wait_time: 'waitTime',
    cue_quality: 'cueQuality',
    drink_selection: 'drinkSelection',
    crowd_vibe: 'crowdVibe',
  };

  const FRONTEND_TO_DB = {
    tableQuality: 'table_quality',
    competitionLevel: 'competition',
    atmosphere: 'atmosphere',
    elbowRoom: 'elbow_room',
    waitTime: 'wait_time',
    cueQuality: 'cue_quality',
    drinkSelection: 'drink_selection',
    crowdVibe: 'crowd_vibe',
  };

  let bars = [];
  let map = null;
  let markers = {};
  let markerCluster = null;
  let infoWindow = null;
  let selectedId = null;
  let popupBarId = null; // Track which bar's popup is currently open
  let updatingIcons = false; // Flag to prevent popupclose from interfering during icon updates
  let currentSort = 'rating';
  let currentFilter = 'all';
  let userLocation = null; // { lat, lng } from geolocation
  let openNowFilter = false;
  let handlingPopState = false; // Flag to prevent pushState during popstate handling
  let currentUser = null; // { id, username, email } or null
  let allReviewsRaw = []; // Raw review rows from Supabase

  function overallScore(ratings) {
    const vals = RATING_KEYS.map((k) => ratings[k]).filter((n) => typeof n === 'number');
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  const BALL_COLORS = {
    1: { base: '#f1d73c', light: '#fff4b8', dark: '#c4a82a', darker: '#9a8420' },
    2: { base: '#2563eb', light: '#60a5fa', dark: '#1d4ed8', darker: '#1e40af' },
    3: { base: '#dc2626', light: '#f87171', dark: '#b91c1c', darker: '#991b1b' },
    4: { base: '#7c3aed', light: '#a78bfa', dark: '#6d28d9', darker: '#5b21b6' },
    5: { base: '#ea580c', light: '#fb923c', dark: '#c2410c', darker: '#9a3412' },
  };

  const PROGRESS_COLORS = {
    5: '#ea580c',
    4: '#7c3aed',
    3: '#dc2626',
    2: '#2563eb',
    1: '#f1d73c',
  };

  const RATING_ICONS = {
    tableQuality: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><rect x="4" y="7" width="16" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round"></rect><circle cx="5" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="5" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="7.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="16.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle></svg>',
    competitionLevel: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path></svg>',
    atmosphere: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path></svg>',
    elbowRoom: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path></svg>',
    waitTime: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    cueQuality: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><line x1="4" y1="20" x2="20" y2="4" stroke-width="2.2" stroke-linecap="round"></line><line x1="4" y1="20" x2="7" y2="17" stroke-width="3" stroke-linecap="round"></line></svg>',
    drinkSelection: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5.5 9h10v8.7a2.3 2.3 0 0 1-2.3 2.3H7.8a2.3 2.3 0 0 1-2.3-2.3V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.5 10.2h1.6a3 3 0 0 1 0 6h-1.6"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5.5 9c.6-1.4 2-1.8 3-.9 1-.9 2.1-.9 3.1 0 1.1-.9 2.4-.5 2.9.9"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.3 12.2v5.6M11 12.2v5.6M13.7 12.2v5.6"/></svg>',
    crowdVibe: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 5.5c-4.2 0-7 2.6-7 6s2.8 6 7 6h2.2L18 20v-2.6c1.8-1 3-2.9 3-5.9 0-3.4-2.8-6-7-6h-2z"/></svg>',
  };

  function ratingToBall(n) {
    const v = typeof n === 'number' ? Math.max(1, Math.min(5, Math.round(n))) : 1;
    return v;
  }

  function poolBallSvg(ball, id) {
    const c = BALL_COLORS[ball] || BALL_COLORS[1];
    const gid = 'ball-grad-' + id;
    return (
      '<svg class="pool-ball-svg" viewBox="0 0 24 24" role="img" aria-label="Rating ' + ball + '" title="' + ball + '">' +
      '<defs>' +
      '<radialGradient id="' + gid + '" fx="0.32" fy="0.28" cx="0.5" cy="0.5" r="0.5">' +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>' +
      '<stop offset="12%" stop-color="' + c.light + '"/>' +
      '<stop offset="45%" stop-color="' + c.base + '"/>' +
      '<stop offset="78%" stop-color="' + c.dark + '"/>' +
      '<stop offset="100%" stop-color="' + c.darker + '"/>' +
      '</radialGradient>' +
      '<radialGradient id="' + gid + '-gloss" fx="0.28" fy="0.24" cx="0.5" cy="0.5" r="0.5">' +
      '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/>' +
      '<stop offset="50%" stop-color="#ffffff" stop-opacity="0.15"/>' +
      '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<circle cx="12" cy="12" r="11" fill="url(#' + gid + ')"/>' +
      '<circle cx="12" cy="12" r="11" fill="url(#' + gid + '-gloss)"/>' +
      '<circle cx="12" cy="12" r="5" fill="white" stroke="rgba(0,0,0,0.08)" stroke-width="0.4"/>' +
      '<text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="#1a1a1a" font-size="6.5" font-weight="700" font-family="system-ui, sans-serif">' + ball + '</text>' +
      '</svg>'
    );
  }

  function renderRatingRow(key, value, uniqueId) {
    const ball = ratingToBall(value);
    const id = (uniqueId || key).replace(/[^a-z0-9-]/gi, '-');
    const progressColor = PROGRESS_COLORS[ball] || PROGRESS_COLORS[3];
    const progressWidth = (ball / 5) * 100;
    const icon = RATING_ICONS[key] || '';
    return (
      '<div class="rating-row">' +
      '<span class="rating-icon">' + icon + '</span>' +
      '<span class="label">' + escapeHtml(RATING_LABELS[key]) + '</span>' +
      '<div class="progress-bar-wrap">' +
      '<div class="progress-bar" style="width: ' + progressWidth + '%; background: ' + progressColor + ';"></div>' +
      '</div>' +
      '<span class="pool-ball-wrap">' + poolBallSvg(ball, id) + '</span>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderStars(score) {
    const maxStars = 5;
    const normalizedScore = score ? (score / 5) * maxStars : 0;
    const fullStars = Math.floor(normalizedScore);
    const hasHalf = normalizedScore % 1 >= 0.5;
    let html = '<div class="stars-wrap">';
    for (let i = 0; i < maxStars; i++) {
      if (i < fullStars) {
        html += '<span class="star filled">★</span>';
      } else if (i === fullStars && hasHalf) {
        html += '<span class="star half">★</span>';
      } else {
        html += '<span class="star empty">★</span>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderProgressRing(score, maxScore) {
    const percentage = score ? (score / maxScore) * 100 : 0;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percentage / 100) * circumference;
    return (
      '<div class="progress-ring-wrap">' +
      '<svg class="progress-ring" viewBox="0 0 100 100">' +
      '<circle class="progress-ring-bg" cx="50" cy="50" r="45"/>' +
      '<circle class="progress-ring-fill" cx="50" cy="50" r="45" ' +
      'stroke-dasharray="' + circumference + '" ' +
      'stroke-dashoffset="' + offset + '" ' +
      'style="--target-offset: ' + offset + '; --circumference: ' + circumference + '"/>' +
      '</svg>' +
      '<div class="progress-ring-content">' +
      '<div class="eight-ball">' +
      '<div class="eight-ball-inner">8</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  // ===== Google Places Hours Integration =====
  function isOpenNow(hoursData) {
    try {
      const data = typeof hoursData === 'string' ? JSON.parse(hoursData) : hoursData;
      if (!data || !data.periods) return null;

      // Get current time in Eastern Time (America/New_York)
      const now = new Date();
      const etOptions = { timeZone: 'America/New_York' };
      const etDay = parseInt(now.toLocaleString('en-US', { ...etOptions, weekday: 'narrow', hour12: false }), 10);
      // Get the actual day number (0=Sun, 1=Mon, ..., 6=Sat)
      const etDayNum = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
      const etHour = parseInt(now.toLocaleString('en-US', { ...etOptions, hour: 'numeric', hour12: false }), 10);
      const etMinute = parseInt(now.toLocaleString('en-US', { ...etOptions, minute: 'numeric' }), 10);
      const currentMinutes = etHour * 60 + etMinute;

      for (const period of data.periods) {
        const openDay = period.open && period.open.day;
        const closeDay = period.close && period.close.day;
        const openMin = period.open ? period.open.hour * 60 + period.open.minute : 0;
        const closeMin = period.close ? period.close.hour * 60 + period.close.minute : 0;

        if (openDay === etDayNum) {
          if (closeDay === etDayNum) {
            if (currentMinutes >= openMin && currentMinutes < closeMin) return true;
          } else {
            // Closes next day (e.g. open til 2am)
            if (currentMinutes >= openMin) return true;
          }
        } else if (closeDay === etDayNum) {
          // Opened yesterday, closes today
          if (currentMinutes < closeMin) return true;
        }
      }
      return false;
    } catch (e) {
      return null;
    }
  }

  function formatHoursForToday(hoursData) {
    try {
      const data = typeof hoursData === 'string' ? JSON.parse(hoursData) : hoursData;
      if (!data) return null;

      // Use weekdayDescriptions if available (e.g. "Monday: 11:00 AM – 2:00 AM")
      if (data.weekdayDescriptions && data.weekdayDescriptions.length > 0) {
        // Get current day in Eastern Time
        const now = new Date();
        const etDayNum = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
        // weekdayDescriptions is Mon-Sun (index 0 = Monday)
        const descIndex = etDayNum === 0 ? 6 : etDayNum - 1;
        const desc = data.weekdayDescriptions[descIndex];
        if (desc) {
          // Extract just the hours part after the colon
          const parts = desc.split(': ');
          return parts.length > 1 ? parts.slice(1).join(': ') : desc;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function formatAllWeekHours(hoursData) {
    try {
      const data = typeof hoursData === 'string' ? JSON.parse(hoursData) : hoursData;
      if (!data || !data.weekdayDescriptions || data.weekdayDescriptions.length === 0) return null;

      const now = new Date();
      const etDayNum = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
      // weekdayDescriptions is Mon(0)–Sun(6); JS getDay is Sun=0
      const todayDescIndex = etDayNum === 0 ? 6 : etDayNum - 1;

      return data.weekdayDescriptions.map((desc, i) => {
        const parts = desc.split(': ');
        const dayName = parts[0];
        const hours = parts.length > 1 ? parts.slice(1).join(': ') : desc;
        const isToday = i === todayDescIndex;
        return { dayName, hours, isToday };
      });
    } catch (e) {
      return null;
    }
  }

  async function fetchAndCacheHours(bar) {
    // Check if we have fresh cached data (less than 24 hours old)
    if (bar.hoursData && bar.hoursLastUpdated) {
      const lastUpdated = new Date(bar.hoursLastUpdated);
      const hoursSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return bar.hoursData;
      }
    }

    // No place ID means we can't fetch
    if (!bar.placeId) return bar.hoursData || null;

    try {
      const url = `https://places.googleapis.com/v1/places/${bar.placeId}?fields=regularOpeningHours&key=${GOOGLE_PLACES_CONFIG.apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) return bar.hoursData || null;

      const data = await resp.json();
      const hoursData = data.regularOpeningHours;

      if (hoursData) {
        const hoursJson = JSON.stringify(hoursData);

        // Cache to Supabase
        await supabase
          .from('bars')
          .update({ hours_data: hoursJson, hours_last_updated: new Date().toISOString() })
          .eq('id', bar.id);

        // Update local bar object
        bar.hoursData = hoursJson;
        bar.hoursLastUpdated = new Date().toISOString();

        return hoursJson;
      }
    } catch (e) {
      console.error('Error fetching hours for', bar.name, e);
    }

    return bar.hoursData || null;
  }

  function renderDetail(bar) {
    const score = overallScore(bar.ratings);
    const displayScore = score ? score.toFixed(1) : '0';
    const maxScore = 5;
    const reviewCount = bar.reviewCount || 0;
    const reviewText = reviewCount === 0
      ? 'No reviews yet'
      : reviewCount === 1 ? 'Based on 1 review' : `Based on ${reviewCount} reviews`;

    // Determine open/closed status from cached hours
    const openStatus = bar.hoursData ? isOpenNow(bar.hoursData) : null;
    const todayHours = bar.hoursData ? formatHoursForToday(bar.hoursData) : null;

    let html = '<div class="modal-split">';

    // Left Panel
    html += '<div class="modal-left">';
    html += '<div class="left-content">';
    html += '<div class="venue-label">NYC / POOL BARS</div>';
    html += '<h2 class="venue-name">' + escapeHtml(bar.name) + '</h2>';
    html += '<div class="venue-location-row">';
    html += '<div class="venue-left">';
    html += '<svg class="location-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 8-8z"/></svg>';
    html += '<span class="venue-neighborhood">' + escapeHtml(bar.neighborhood) + '</span>';
    html += '</div>';
    if (openStatus === true) {
      html += '<span class="venue-status" id="detail-open-status"><span class="status-indicator"></span>Open Now</span>';
    } else if (openStatus === false) {
      html += '<span class="venue-status venue-closed" id="detail-open-status"><span class="status-indicator closed"></span>Closed</span>';
    } else {
      html += '<span class="venue-status" id="detail-open-status" style="display:none;"></span>';
    }
    html += '</div>';
    html += '<div class="venue-divider"></div>';

    html += '<div class="info-cards">';

    // Tables card
    const tableDisplay = bar.tableCount != null ? escapeHtml(String(bar.tableCount)) + (bar.tableCount === 1 ? ' Table Available' : ' Tables Available') : 'Tables available';
    const tableInfoLink = bar.tableCount == null ? '<span class="info-submit-link" data-info-type="tables" data-bar-id="' + bar.id + '" data-bar-name="' + escapeHtml(bar.name) + '">Know how many tables? Let us know \u2192</span>' : '';
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#d4af37" class="hours-svg"><rect x="4" y="7" width="16" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round"></rect><circle cx="5" cy="8" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="19" cy="8" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="5" cy="16" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="19" cy="16" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="12" cy="7.5" r="0.8" fill="#d4af37" stroke="none"></circle><circle cx="12" cy="16.5" r="0.8" fill="#d4af37" stroke="none"></circle></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">TABLES</span><span class="info-card-value">' + tableDisplay + '</span>' + tableInfoLink + '</div></div>';

    // Price card
    const priceDisplay = bar.price ? escapeHtml(bar.price) : 'Price not listed';
    const priceInfoLink = !bar.price ? '<span class="info-submit-link" data-info-type="price" data-bar-id="' + bar.id + '" data-bar-name="' + escapeHtml(bar.name) + '">Know the price? Let us know \u2192</span>' : '';
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="#d4af37" class="hours-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">PRICE</span><span class="info-card-value">' + priceDisplay + '</span>' + priceInfoLink + '</div></div>';

    // Location card
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d4af37" class="icon-svg"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">LOCATION</span><span class="info-card-value">' + escapeHtml(bar.address) + '</span><span class="info-card-sub link">GET DIRECTIONS</span></div></div>';

    // Hours card
    const hoursDisplay = todayHours || 'Loading hours...';
    const allWeekHours = formatAllWeekHours(bar.hoursData);
    let weekHoursHtml = '';
    if (allWeekHours) {
      weekHoursHtml = '<div class="week-hours" id="detail-week-hours">';
      allWeekHours.forEach(function(d) {
        weekHoursHtml += '<div class="week-hours-row' + (d.isToday ? ' week-hours-today' : '') + '"><span class="week-hours-day">' + escapeHtml(d.dayName) + '</span><span class="week-hours-time">' + escapeHtml(d.hours) + '</span></div>';
      });
      weekHoursHtml += '</div>';
    }
    html += '<div class="info-card hours-card-expandable"><div class="info-card-icon hours-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#d4af37" class="hours-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">TODAY\'S HOURS</span><span class="info-card-value" id="detail-hours-value">' + escapeHtml(hoursDisplay) + '</span>';
    html += '<span class="see-all-hours" id="see-all-hours-toggle" onclick="(function(e){var card=e.closest(\'.hours-card-expandable\');card.classList.toggle(\'expanded\');})(this)">See all hours <span class="see-all-hours-arrow">▼</span></span>';
    html += weekHoursHtml;
    html += '</div></div>';

    html += '</div>';

    html += '<button class="rate-btn">Rate This Bar</button>';
    html += '</div></div>';

    // Right Panel
    html += '<div class="modal-right">';
    html += '<div class="scorecard-header">';
    html += '<div class="scorecard-header-left">';
    html += '<h3 class="scorecard-title">The Scorecard</h3>';
    html += '<span class="scorecard-subtitle">' + reviewText + '</span>';
    html += '</div>';
    html += renderStars(score);
    html += '</div>';

    if (reviewCount === 0) {
      // No reviews state
      html += '<div class="no-reviews-state">';
      html += '<div class="overall-rating-card">';
      html += '<div class="overall-rating-info">';
      html += '<span class="overall-label">OVERALL RATING</span>';
      html += '<div class="overall-score-display"><span class="score-big">--</span></div>';
      html += '<span class="overall-sub">No ratings yet</span>';
      html += '</div>';
      html += renderProgressRing(0, maxScore);
      html += '</div>';
      html += '<div class="ratings-section" style="display:flex;align-items:center;justify-content:center;min-height:120px;"><span style="font-family:var(--font-display);font-size:0.85rem;font-style:italic;color:rgba(255,255,255,0.4);">Be the first to rate this bar!</span></div>';
      html += '</div>';
    } else {
      html += '<div class="overall-rating-card">';
      html += '<div class="overall-rating-info">';
      html += '<span class="overall-label">OVERALL RATING</span>';
      html += '<div class="overall-score-display"><span class="score-big">' + displayScore + '</span></div>';
      html += '<span class="overall-sub">out of ' + maxScore + '.0</span>';
      html += '</div>';
      html += renderProgressRing(score || 0, maxScore);
      html += '</div>';

      html += '<div class="ratings-section">';
      const SCORECARD_ORDER = ['atmosphere', 'crowdVibe', 'drinkSelection', 'tableQuality', 'cueQuality', 'elbowRoom', 'competitionLevel', 'waitTime'];
      SCORECARD_ORDER.forEach((k) => {
        if (bar.ratings[k] != null) html += renderRatingRow(k, bar.ratings[k], bar.id + '-' + k);
      });
      html += '</div>';
    }

    if (reviewCount > 0) {
      // View All Reviews expandable section
      html += '<div class="all-reviews-section" id="all-reviews-section">';
      html += '<div class="all-reviews-toggle" id="all-reviews-toggle">';
      html += '<span class="all-reviews-toggle-text">View All Reviews (' + reviewCount + ')</span>';
      html += '<span class="all-reviews-toggle-arrow">&#9660;</span>';
      html += '</div>';
      html += '<div class="all-reviews-list">';
      var sortedReviews = (bar.reviews || []).slice().sort(function(a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      sortedReviews.forEach(function(review, idx) {
        var isAnonymous = !review.user_id;
        var reviewUsername = isAnonymous ? 'Anonymous' : (review.username || review.reviewer_name || 'Anonymous');
        var initial = isAnonymous ? '?' : reviewUsername.replace(/^@/, '').charAt(0).toUpperCase();
        var date = new Date(review.created_at);
        var dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        var ratingMap = {
          tableQuality: review.table_quality,
          competitionLevel: review.competition,
          atmosphere: review.atmosphere,
          elbowRoom: review.elbow_room,
          waitTime: review.wait_time,
          cueQuality: review.cue_quality,
          drinkSelection: review.drink_selection,
          crowdVibe: review.crowd_vibe,
        };
        var ratedKeys = RATING_KEYS.filter(function(key) { return ratingMap[key] != null; });
        var sum = ratedKeys.reduce(function(acc, key) { return acc + ratingMap[key]; }, 0);
        var avg = ratedKeys.length > 0 ? (sum / ratedKeys.length).toFixed(1) : '--';
        var avgBall = ratedKeys.length > 0 ? ratingToBall(sum / ratedKeys.length) : 3;
        var reviewId = 'rev-' + bar.id + '-' + idx;

        html += '<div class="review-card">';
        html += '<div class="review-card-header">';
        html += '<div class="review-card-user">';
        html += '<div class="review-card-avatar">' + escapeHtml(initial) + '</div>';
        html += '<span class="review-card-username">' + escapeHtml(reviewUsername) + '</span>';
        html += '</div>';
        html += '<div class="review-card-right">';
        html += '<span class="review-card-date">' + escapeHtml(dateStr) + '</span>';
        html += '<span class="review-card-avg">' + avg + '</span>';
        html += '</div>';
        html += '</div>';
        if (review.notes) {
          html += '<div class="review-card-notes">"' + escapeHtml(review.notes) + '"</div>';
        }
        if (ratedKeys.length > 0) {
          html += '<div class="review-card-breakdown-toggle" data-target="' + reviewId + '">';
          html += '<span>See full breakdown</span>';
          html += '<span class="review-card-breakdown-arrow">&#9660;</span>';
          html += '</div>';
          html += '<div class="review-card-breakdown" id="' + reviewId + '">';
          ratedKeys.forEach(function(key) {
            html += '<div class="review-rating-row">';
            html += '<span class="review-rating-label">' + escapeHtml(RATING_LABELS[key]) + '</span>';
            html += '<span class="review-rating-value">' + ratingMap[key] + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div></div>';

    }

    html += '</div>';
    html += '</div>';

    return html;
  }

  function openDetail(bar) {
    selectedId = bar.id;
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('detail-content');
    content.innerHTML = renderDetail(bar);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // View All Reviews toggle
    var reviewsToggle = content.querySelector('#all-reviews-toggle');
    if (reviewsToggle) {
      reviewsToggle.addEventListener('click', function() {
        var section = document.getElementById('all-reviews-section');
        if (section) section.classList.toggle('expanded');
      });
    }

    if (!handlingPopState) {
      history.pushState({ view: 'detail', barId: bar.id }, '');
    }

    // Trigger progress ring animation
    setTimeout(() => {
      const ring = document.querySelector('.progress-ring-fill');
      if (ring) ring.classList.add('animate');
    }, 100);

    // Update all marker icons - selected bar gets highlight style
    updatingIcons = true;
    Object.keys(markers).forEach((id) => {
      markers[id].setIcon(createPinIcon(id === bar.id));
    });
    const m = markers[bar.id];
    if (m) {
      popupBarId = bar.id;
      // Zoom in if needed so marker is unclustered
      if (map.getZoom() < 14) {
        map.setZoom(14);
      }
      map.panTo({ lat: bar.lat, lng: bar.lng });
      setTimeout(() => {
        infoWindow.setContent(buildPopupContent(bar));
        infoWindow.open({ anchor: m, map: map });
      }, 300);
    }
    updatingIcons = false;

    const list = document.getElementById('bar-list');
    list.querySelectorAll('.bar-list-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === bar.id);
    });

    // Asynchronously fetch and update hours
    fetchAndCacheHours(bar).then((hoursData) => {
      if (!hoursData) return;
      const hoursEl = document.getElementById('detail-hours-value');
      const statusEl = document.getElementById('detail-open-status');
      if (hoursEl) {
        const todayHours = formatHoursForToday(hoursData);
        hoursEl.textContent = todayHours || 'Hours not available';
      }
      if (statusEl) {
        const open = isOpenNow(hoursData);
        if (open === true) {
          statusEl.innerHTML = '<span class="status-indicator"></span>Open Now';
          statusEl.className = 'venue-status';
          statusEl.style.display = '';
        } else if (open === false) {
          statusEl.innerHTML = '<span class="status-indicator closed"></span>Closed';
          statusEl.className = 'venue-status venue-closed';
          statusEl.style.display = '';
        }
      }
      // Update weekly hours
      const weekEl = document.getElementById('detail-week-hours');
      if (weekEl) {
        const allWeekHours = formatAllWeekHours(hoursData);
        if (allWeekHours) {
          weekEl.innerHTML = allWeekHours.map(function(d) {
            return '<div class="week-hours-row' + (d.isToday ? ' week-hours-today' : '') + '"><span class="week-hours-day">' + d.dayName + '</span><span class="week-hours-time">' + d.hours + '</span></div>';
          }).join('');
        }
      }
    });
  }

  function closeDetail(fromPopState) {
    selectedId = null;
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';

    updatingIcons = true;

    // Reset markers - keep the one with open InfoWindow highlighted
    Object.keys(markers).forEach((id) => {
      markers[id].setIcon(createPinIcon(id === popupBarId));
    });

    updatingIcons = false;

    document.getElementById('bar-list').querySelectorAll('.bar-list-item').forEach((el) => {
      el.classList.remove('active');
    });

    if (!fromPopState) {
      history.back();
    }
  }

  function createPinIcon(highlight) {
    if (highlight) {
      return {
        url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="9" fill="#1a3a2a" stroke="#d4af37" stroke-width="3"/></svg>'),
        scaledSize: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12),
      };
    }
    return {
      url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#d4af37" stroke="rgba(0,0,0,0.2)" stroke-width="2"/></svg>'),
      scaledSize: new google.maps.Size(16, 16),
      anchor: new google.maps.Point(8, 8),
    };
  }

  function addBarToMap(bar, popupContent) {
    const marker = new google.maps.Marker({
      position: { lat: bar.lat, lng: bar.lng },
      icon: createPinIcon(false),
      title: bar.name,
    });

    marker.addListener('click', () => {
      if (popupBarId && popupBarId !== bar.id && markers[popupBarId]) {
        markers[popupBarId].setIcon(createPinIcon(false));
      }
      popupBarId = bar.id;
      marker.setIcon(createPinIcon(true));
      infoWindow.setContent(popupContent);
      infoWindow.open({ anchor: marker, map: map });
    });

    markers[bar.id] = marker;
  }

  function buildPopupContent(bar) {
    const score = overallScore(bar.ratings);
    const hasReviews = bar.reviewCount > 0;
    const ratingHtml = hasReviews
      ? '<span class="popup-rating"><span class="popup-rating-star">★</span> ' + score.toFixed(1) + '</span>'
      : '';
    return (
      '<div class="popup-name">' + escapeHtml(bar.name) + '</div>' +
      '<div class="popup-meta">' +
      '<span>' + escapeHtml(bar.neighborhood) + '</span>' +
      ratingHtml +
      '</div>' +
      '<a href="#" class="popup-view-link" data-bar-id="' + bar.id + '">View Full Scorecard →</a>'
    );
  }

  function renderListItem(bar) {
    const score = overallScore(bar.ratings);
    const scoreStr = (score != null && bar.reviewCount > 0) ? score.toFixed(1) : '—';
    const li = document.createElement('li');
    li.className = 'bar-list-item';
    li.dataset.id = bar.id;
    li.innerHTML =
      '<div class="name">' +
      escapeHtml(bar.name) +
      '</div><div class="meta">' +
      escapeHtml(bar.neighborhood) +
      '</div><div class="score-badge">' +
      scoreStr +
      '</div>';
    li.addEventListener('click', () => openDetail(bar));
    return li;
  }

  function sortBars(barsToSort, sortType) {
    const sorted = [...barsToSort];
    switch (sortType) {
      case 'rating':
        sorted.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
        break;
      case 'name-az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-za':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'neighborhood':
        sorted.sort((a, b) => {
          const neighborhoodCompare = a.neighborhood.localeCompare(b.neighborhood);
          if (neighborhoodCompare !== 0) return neighborhoodCompare;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'nearest':
        if (userLocation) {
          sorted.sort((a, b) => {
            const distA = (a.lat - userLocation.lat) ** 2 + (a.lng - userLocation.lng) ** 2;
            const distB = (b.lat - userLocation.lat) ** 2 + (b.lng - userLocation.lng) ** 2;
            return distA - distB;
          });
        }
        break;
      default:
        sorted.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    }
    return sorted;
  }

  function filterBars(query) {
    const q = (query || '').trim().toLowerCase();
    let filtered = bars;

    // Apply map bounds filter (skip on mobile list view where map is hidden)
    var isMobileList = window.innerWidth <= 768 && !document.body.classList.contains('mobile-map');
    if (map && !isMobileList) {
      const bounds = map.getBounds();
      if (bounds) {
        filtered = filtered.filter((b) => bounds.contains({ lat: b.lat, lng: b.lng }));
      }
    }

    // Apply neighborhood filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter((b) => b.neighborhood === currentFilter);
    }

    // Apply Open Now filter
    if (openNowFilter) {
      filtered = filtered.filter((b) => b.hoursData && isOpenNow(b.hoursData) === true);
    }

    // Apply search query
    if (q) {
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.neighborhood.toLowerCase().includes(q) ||
          (b.address && b.address.toLowerCase().includes(q))
      );
    }

    return sortBars(filtered, currentSort);
  }

  function updateList(filtered) {
    const list = document.getElementById('bar-list');
    const countEl = document.getElementById('bar-count');
    list.innerHTML = '';
    countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bar-list-empty';
      empty.textContent = 'No bars match your search.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((bar) => list.appendChild(renderListItem(bar)));
  }

  var DARK_MAP_STYLES = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
  ];

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 40.72, lng: -74.0 },
      zoom: 11,
      styles: DARK_MAP_STYLES,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    infoWindow = new google.maps.InfoWindow();

    infoWindow.addListener('closeclick', () => {
      if (updatingIcons) return;
      if (popupBarId && markers[popupBarId] && selectedId !== popupBarId) {
        markers[popupBarId].setIcon(createPinIcon(false));
      }
      popupBarId = null;
    });

    infoWindow.addListener('close', () => {
      if (updatingIcons) return;
      if (popupBarId && markers[popupBarId] && selectedId !== popupBarId) {
        markers[popupBarId].setIcon(createPinIcon(false));
      }
      popupBarId = null;
    });

    // Close InfoWindow when clicking on the map background
    map.addListener('click', () => {
      infoWindow.close();
    });

    bars.forEach((bar) => {
      addBarToMap(bar, buildPopupContent(bar));
    });

    markerCluster = new markerClusterer.MarkerClusterer({
      map: map,
      markers: Object.values(markers),
      algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 30, maxZoom: 14 }),
      onClusterClick: function(event, cluster, gMap) {
        var pos = cluster.position;
        var currentZoom = gMap.getZoom() || 11;
        gMap.panTo(pos);
        gMap.setZoom(currentZoom + 2);
      },
      renderer: {
        render: function({ count, position }) {
          return new google.maps.Marker({
            position: position,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: count < 10 ? 16 : count < 50 ? 20 : 24,
              fillColor: '#d4af37',
              fillOpacity: 1,
              strokeColor: 'rgba(0,0,0,0.3)',
              strokeWeight: 2,
            },
            label: {
              text: String(count),
              color: '#0a2216',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              fontWeight: '600',
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          });
        },
      },
    });

    if (Object.keys(markers).length > 0) {
      var bounds = new google.maps.LatLngBounds();
      bars.forEach(function(bar) {
        bounds.extend({ lat: bar.lat, lng: bar.lng });
      });
      map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
      var initListener = google.maps.event.addListener(map, 'idle', function() {
        if (map.getZoom() > 12) map.setZoom(12);
        google.maps.event.removeListener(initListener);
      });
    }

    // Update sidebar when map view changes
    map.addListener('idle', function() {
      var searchInput = document.getElementById('search');
      var filtered = filterBars(searchInput ? searchInput.value : '');
      updateList(filtered);

      // Sync map markers when Open Now filter is active
      if (openNowFilter && markerCluster) {
        var filteredIds = new Set(filtered.map(function(b) { return b.id; }));
        var toAdd = [];
        var toRemove = [];
        Object.keys(markers).forEach(function(id) {
          if (filteredIds.has(id)) {
            toAdd.push(markers[id]);
          } else {
            toRemove.push(markers[id]);
          }
        });
        markerCluster.removeMarkers(toRemove);
        markerCluster.addMarkers(toAdd);
      }
    });
  }

  function initSearch() {
    const input = document.getElementById('search');
    input.addEventListener('input', () => updateList(filterBars(input.value)));
  }

  function positionDropdownMenu(trigger, menu) {
    const rect = trigger.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.left = rect.left + 'px';
  }

  function positionDropdownMenuRight(trigger, menu) {
    const rect = trigger.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.style.left = 'auto';
  }

  function initSortDropdown() {
    const dropdown = document.getElementById('sort-dropdown');
    const trigger = document.getElementById('sort-trigger');
    const menu = document.getElementById('sort-menu');
    const label = document.getElementById('sort-label');
    const options = menu.querySelectorAll('.control-option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('filter-dropdown').classList.remove('open');
      positionDropdownMenu(trigger, menu);
      dropdown.classList.toggle('open');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const sortType = option.dataset.sort;

        if (sortType === 'nearest') {
          if (userLocation) {
            // Already have location, just sort
            currentSort = sortType;
            options.forEach((o) => o.classList.remove('selected'));
            option.classList.add('selected');
            label.textContent = option.textContent;
            dropdown.classList.remove('open');
            const searchInput = document.getElementById('search');
            updateList(filterBars(searchInput.value));
          } else if (!navigator.geolocation) {
            dropdown.classList.remove('open');
            alert('Your browser doesn\'t support geolocation. Please try a different sort option.');
          } else {
            dropdown.classList.remove('open');
            navigator.geolocation.getCurrentPosition(
              (position) => {
                userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
                currentSort = sortType;
                options.forEach((o) => o.classList.remove('selected'));
                option.classList.add('selected');
                label.textContent = option.textContent;
                const searchInput = document.getElementById('search');
                updateList(filterBars(searchInput.value));
              },
              () => {
                alert('Location access is needed to sort by nearest bars. Please enable location permissions in your browser settings and try again.');
              }
            );
          }
          return;
        }

        currentSort = sortType;

        options.forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');

        label.textContent = option.textContent;
        dropdown.classList.remove('open');

        const searchInput = document.getElementById('search');
        updateList(filterBars(searchInput.value));
      });
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  function initFilterDropdown() {
    const dropdown = document.getElementById('filter-dropdown');
    const trigger = document.getElementById('filter-trigger');
    const menu = document.getElementById('filter-menu');
    const label = document.getElementById('filter-label');

    // Get unique neighborhoods and sort alphabetically
    const neighborhoods = [...new Set(bars.map((b) => b.neighborhood))].sort();

    // Add neighborhood options to the menu
    neighborhoods.forEach((neighborhood) => {
      const option = document.createElement('button');
      option.className = 'control-option';
      option.dataset.filter = neighborhood;
      option.textContent = neighborhood;
      menu.appendChild(option);
    });

    const options = menu.querySelectorAll('.control-option');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('sort-dropdown').classList.remove('open');
      positionDropdownMenuRight(trigger, menu);
      dropdown.classList.toggle('open');
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const filterValue = option.dataset.filter;
        currentFilter = filterValue;

        options.forEach((o) => o.classList.remove('selected'));
        option.classList.add('selected');

        label.textContent = filterValue === 'all' ? 'All' : option.textContent;
        dropdown.classList.remove('open');

        const searchInput = document.getElementById('search');
        updateList(filterBars(searchInput.value));
      });
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  function initOpenNowToggle() {
    var btn = document.getElementById('open-now-toggle');
    btn.addEventListener('click', function() {
      openNowFilter = !openNowFilter;
      btn.classList.toggle('active', openNowFilter);

      var searchInput = document.getElementById('search');
      var filtered = filterBars(searchInput ? searchInput.value : '');
      updateList(filtered);

      // Update map markers to match
      if (markerCluster) {
        var filteredIds = new Set(filtered.map(function(b) { return b.id; }));
        var toAdd = [];
        var toRemove = [];
        Object.keys(markers).forEach(function(id) {
          if (filteredIds.has(id)) {
            toAdd.push(markers[id]);
          } else {
            toRemove.push(markers[id]);
          }
        });
        markerCluster.removeMarkers(toRemove);
        markerCluster.addMarkers(toAdd);
      }
    });
  }

  function initDetailClose() {
    document.getElementById('detail-close').addEventListener('click', function() { closeDetail(); });
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeDetail();
    });

    // Individual review breakdown toggles (delegated, registered once)
    document.getElementById('detail-content').addEventListener('click', function(e) {
      var toggle = e.target.closest('.review-card-breakdown-toggle');
      if (!toggle) return;
      var targetId = toggle.getAttribute('data-target');
      var breakdown = document.getElementById(targetId);
      if (breakdown) {
        var isOpen = breakdown.classList.toggle('open');
        toggle.classList.toggle('open', isOpen);
      }
    });
  }

  // ===== Rating UI =====
  const RATING_CATEGORIES = [
    { key: 'atmosphere', title: 'Atmosphere', subtitle: 'LIGHTING, MUSIC, VIBE', labelLeft: 'BEAT', labelRight: 'ELECTRIC', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path></svg>' },
    { key: 'crowdVibe', title: 'Crowd Vibe', subtitle: 'FRIENDLINESS, CONVERSATION', labelLeft: 'RESERVED', labelRight: 'WELCOMING', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 5.5c-4.2 0-7 2.6-7 6s2.8 6 7 6h2.2L18 20v-2.6c1.8-1 3-2.9 3-5.9 0-3.4-2.8-6-7-6h-2z"/></svg>' },
    { key: 'drinkSelection', title: 'Drink Selection', subtitle: 'VARIETY, PRICING, QUALITY', labelLeft: 'BASIC', labelRight: 'ELITE', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5.5 9h10v8.7a2.3 2.3 0 0 1-2.3 2.3H7.8a2.3 2.3 0 0 1-2.3-2.3V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15.5 10.2h1.6a3 3 0 0 1 0 6h-1.6"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5.5 9c.6-1.4 2-1.8 3-.9 1-.9 2.1-.9 3.1 0 1.1-.9 2.4-.5 2.9.9"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.3 12.2v5.6M11 12.2v5.6M13.7 12.2v5.6"/></svg>' },
    { key: 'tableQuality', title: 'Table Quality', subtitle: 'CLOTH CONDITION, LEVELNESS, RAILS', labelLeft: 'ROUGH', labelRight: 'PRISTINE', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><rect x="4" y="7" width="16" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round"></rect><circle cx="5" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="5" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="7.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="16.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle></svg>' },
    { key: 'cueQuality', title: 'Cue Quality', subtitle: 'STICK CONDITION, CHALK, TIPS', labelLeft: 'ROUGH', labelRight: 'PRO GRADE', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><line x1="4" y1="20" x2="20" y2="4" stroke-width="2.2" stroke-linecap="round"></line><line x1="4" y1="20" x2="7" y2="17" stroke-width="3" stroke-linecap="round"></line></svg>' },
    { key: 'elbowRoom', title: 'Elbow Room', subtitle: 'SPACE AROUND TABLES, CROWDING', labelLeft: 'TIGHT', labelRight: 'SPACIOUS', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path></svg>' },
    { key: 'competitionLevel', title: 'Competition', subtitle: 'PLAYER SKILL LEVEL', labelLeft: 'CASUALS', labelRight: 'SHARKS', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path></svg>' },
    { key: 'waitTime', title: 'Wait Time', subtitle: 'TABLE AVAILABILITY', labelLeft: 'LONG WAITS', labelRight: 'NO WAIT', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
  ];

  let currentRatingBar = null;
  let userRatings = {};

  // Pool ball SVG generator for rating UI
  function ratingBallSvg(num, categoryKey) {
    const colors = {
      1: { light: '#fbbf24', dark: '#d97706' },
      2: { light: '#3b82f6', dark: '#1d4ed8' },
      3: { light: '#ef4444', dark: '#b91c1c' },
      4: { light: '#a855f7', dark: '#7e22ce' },
      5: { light: '#f97316', dark: '#c2410c' }
    };
    const c = colors[num];
    const gradId = `ball${num}-grad-${categoryKey}`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="${gradId}" cx="30%" cy="30%">
          <stop offset="0%" stop-color="${c.light}" />
          <stop offset="100%" stop-color="${c.dark}" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#${gradId})" />
      <circle cx="35" cy="35" r="12" fill="rgba(255,255,255,0.4)" />
      <circle cx="50" cy="50" r="18" fill="white" />
      <text x="50" y="58" font-size="24" font-weight="bold" fill="black" text-anchor="middle">${num}</text>
    </svg>`;
  }

  function openRatingUI(bar) {
    currentRatingBar = bar;
    userRatings = {};

    // Update user profile in rating header
    updateRatingUserUI();

    // Update establishment info
    document.getElementById('rating-bar-name').textContent = bar.name;
    document.getElementById('rating-address-text').textContent = bar.address;
    document.getElementById('rating-neighborhood').textContent = bar.neighborhood.toUpperCase();

    // Build rating grid
    const grid = document.getElementById('rating-grid');
    grid.innerHTML = RATING_CATEGORIES.map(cat => `
      <div class="rating-card" data-category="${cat.key}">
        <div class="rating-card-header">
          <div class="rating-card-icon">${cat.icon}</div>
          <div class="rating-card-info">
            <h3 class="rating-card-title">${cat.title}</h3>
            <p class="rating-card-subtitle">${cat.subtitle}</p>
          </div>
          <span class="rating-card-value" id="value-${cat.key}">--</span>
        </div>
        <div class="pool-ball-selector" data-category="${cat.key}">
          ${[1,2,3,4,5].map(n => `<button class="pool-ball-btn" data-value="${n}">${ratingBallSvg(n, cat.key)}</button>`).join('')}
        </div>
        <div class="rating-labels">
          <span class="rating-label">${cat.labelLeft}</span>
          <span class="rating-label">${cat.labelRight}</span>
        </div>
      </div>
    `).join('');

    // Add click handlers for pool balls
    grid.querySelectorAll('.pool-ball-btn').forEach(btn => {
      btn.addEventListener('click', handleBallClick);
    });

    // Reset UI
    updateRatingProgress();
    document.getElementById('rating-notes').value = '';

    // Show rating UI
    document.getElementById('rating-ui').classList.add('open');
    document.body.style.overflow = 'hidden';

    if (!handlingPopState) {
      history.pushState({ view: 'rating', barId: bar.id }, '');
    }
  }

  function closeRatingUI(fromPopState) {
    document.getElementById('rating-ui').classList.remove('open');
    document.body.style.overflow = '';

    if (!fromPopState) {
      history.back();
    }
  }

  function handleBallClick(e) {
    const btn = e.currentTarget;
    const value = parseInt(btn.dataset.value);
    const selector = btn.closest('.pool-ball-selector');
    const category = selector.dataset.category;

    // Update selection - select all balls up to and including clicked one
    selector.querySelectorAll('.pool-ball-btn').forEach(b => {
      const ballValue = parseInt(b.dataset.value);
      b.classList.remove('selected', 'active');
      if (ballValue <= value) {
        b.classList.add('active');
      }
      if (ballValue === value) {
        b.classList.add('selected');
      }
    });

    // Store rating
    userRatings[category] = value;

    // Update display
    const valueEl = document.getElementById('value-' + category);
    valueEl.textContent = value;
    valueEl.classList.add('has-value');

    updateRatingProgress();
  }

  function updateRatingProgress() {
    const completed = Object.keys(userRatings).length;
    document.getElementById('completed-count').textContent = completed;

    // Update overall
    const overallEl = document.getElementById('overall-value');
    if (completed > 0) {
      const avg = Object.values(userRatings).reduce((a, b) => a + b, 0) / completed;
      overallEl.innerHTML = avg.toFixed(1) + ' <span>/ 5.0</span>';
      overallEl.classList.add('has-value');
    } else {
      overallEl.innerHTML = '-- <span>/ 5.0</span>';
      overallEl.classList.remove('has-value');
    }

    // Enable/disable submit
    const submitBtn = document.getElementById('submit-review');
    if (completed === RATING_CATEGORIES.length) {
      submitBtn.classList.add('enabled');
    } else {
      submitBtn.classList.remove('enabled');
    }
  }

  async function submitReview() {
    if (Object.keys(userRatings).length !== RATING_CATEGORIES.length || !currentRatingBar) {
      return;
    }

    const notes = document.getElementById('rating-notes').value.trim();

    // Prepare review data for Supabase
    const reviewData = {
      bar_id: currentRatingBar.id,
      reviewer_name: currentUser ? currentUser.username : 'Anonymous',
      user_id: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : null,
      table_quality: userRatings.tableQuality,
      competition: userRatings.competitionLevel,
      atmosphere: userRatings.atmosphere,
      elbow_room: userRatings.elbowRoom,
      wait_time: userRatings.waitTime,
      cue_quality: userRatings.cueQuality,
      drink_selection: userRatings.drinkSelection,
      crowd_vibe: userRatings.crowdVibe,
      notes: notes || null,
    };

    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert([reviewData]);

      if (error) {
        console.error('Error submitting review:', error);
        alert('Error submitting review. Please try again.');
        return;
      }

      alert('Review submitted! Thank you for your feedback.');
      closeRatingUI(true);
      closeDetail(true);
      // Go back past both rating and detail history entries
      history.go(-2);

      // Refresh the data to show updated ratings
      await loadBarsFromSupabase();
      updateList(sortBars(bars, currentSort));

    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Error submitting review. Please try again.');
    }
  }

  function initRatingUI() {
    // Back button
    document.getElementById('rating-back').addEventListener('click', function() { closeRatingUI(); });

    // Submit button - now calls submitReview
    document.getElementById('submit-review').addEventListener('click', submitReview);

    // Rate This Bar button handler - using event delegation
    document.addEventListener('click', (e) => {
      if (e.target.closest('.rate-btn')) {
        const bar = bars.find(b => b.id === selectedId);
        if (bar) {
          openRatingUI(bar);
        }
      }
    });
  }

  // Fetch bars and their aggregated ratings from Supabase
  async function loadBarsFromSupabase() {
    try {
      // Fetch all bars
      const { data: barsData, error: barsError } = await supabase
        .from('bars')
        .select('*');

      if (barsError) {
        console.error('Error fetching bars:', barsError);
        return;
      }

      // Fetch all reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*');

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        return;
      }

      // Store raw reviews for individual review display and user count
      allReviewsRaw = reviewsData || [];

      // Group reviews by bar_id and calculate averages
      const reviewsByBar = {};
      reviewsData.forEach(review => {
        if (!reviewsByBar[review.bar_id]) {
          reviewsByBar[review.bar_id] = [];
        }
        reviewsByBar[review.bar_id].push(review);
      });

      // Transform bars data to match frontend format
      bars = barsData.map(bar => {
        const barReviews = reviewsByBar[bar.id] || [];
        const reviewCount = barReviews.length;

        // Calculate average ratings
        const ratings = {
          tableQuality: 0,
          competitionLevel: 0,
          atmosphere: 0,
          elbowRoom: 0,
          waitTime: 0,
          cueQuality: 0,
          drinkSelection: null,
          crowdVibe: null,
        };

        if (reviewCount > 0) {
          // Track counts for nullable fields separately
          let drinkSelectionCount = 0;
          let crowdVibeCount = 0;

          barReviews.forEach(review => {
            ratings.tableQuality += review.table_quality;
            ratings.competitionLevel += review.competition;
            ratings.atmosphere += review.atmosphere;
            ratings.elbowRoom += review.elbow_room;
            ratings.waitTime += review.wait_time;
            ratings.cueQuality += review.cue_quality;
            if (review.drink_selection != null) {
              ratings.drinkSelection = (ratings.drinkSelection || 0) + review.drink_selection;
              drinkSelectionCount++;
            }
            if (review.crowd_vibe != null) {
              ratings.crowdVibe = (ratings.crowdVibe || 0) + review.crowd_vibe;
              crowdVibeCount++;
            }
          });

          // Calculate averages for required fields
          ['tableQuality', 'competitionLevel', 'atmosphere', 'elbowRoom', 'waitTime', 'cueQuality'].forEach(key => {
            ratings[key] = Math.round((ratings[key] / reviewCount) * 10) / 10;
          });

          // Calculate averages for nullable fields (only if any reviews have values)
          if (drinkSelectionCount > 0) {
            ratings.drinkSelection = Math.round((ratings.drinkSelection / drinkSelectionCount) * 10) / 10;
          }
          if (crowdVibeCount > 0) {
            ratings.crowdVibe = Math.round((ratings.crowdVibe / crowdVibeCount) * 10) / 10;
          }
        }

        return {
          id: bar.id,
          name: bar.name,
          neighborhood: bar.neighborhood,
          address: bar.address,
          tableCount: bar.table_count,
          price: bar.price,
          priceType: bar.price_type,
          lat: bar.lat,
          lng: bar.lng,
          tableBrand: bar.table_brand,
          hours: bar.hours,
          placeId: bar.place_id,
          hoursData: bar.hours_data,
          hoursLastUpdated: bar.hours_last_updated,
          ratings: ratings,
          reviewCount: reviewCount,
          overallScore: overallScore(ratings),
          reviews: barReviews,
        };
      });

    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    }
  }

  function initMobileToggle() {
    const toggle = document.getElementById('mobile-toggle');
    if (!toggle) return;
    const buttons = toggle.querySelectorAll('.mobile-toggle-btn');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        buttons.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var view = btn.getAttribute('data-view');
        if (view === 'map') {
          document.body.classList.add('mobile-map');
          // Trigger resize so Google Maps renders correctly
          if (map) google.maps.event.trigger(map, 'resize');
        } else {
          document.body.classList.remove('mobile-map');
        }
      });
    });
  }

  async function load() {
    // Try to load from Supabase first
    await loadBarsFromSupabase();

    // If Supabase failed, fall back to local JSON
    if (bars.length === 0) {
      console.log('Falling back to local bars.json');
      try {
        const res = await fetch('bars.json');
        const data = await res.json();
        bars = (data.bars || []).map((b) => ({
          ...b,
          overallScore: overallScore(b.ratings),
          reviewCount: 1 // Default to 1 for seeded data
        }));
      } catch (err) {
        console.error('Error loading bars.json:', err);
      }
    }

    updateList(sortBars(bars, currentSort));
    initAuth();
    initMap();
    initSearch();
    initSortDropdown();
    initFilterDropdown();
    initOpenNowToggle();
    initDetailClose();
    initRatingUI();
    initPopupLinks();
    initSuggestBar();
    initInfoSubmit();
    initMobileToggle();
  }

  function initSuggestBar() {
    const btn = document.getElementById('suggest-bar-btn');
    const overlay = document.getElementById('suggest-overlay');
    const closeBtn = document.getElementById('suggest-close');
    const form = document.getElementById('suggest-bar-form');

    btn.addEventListener('click', () => overlay.classList.add('open'));
    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('suggest-name').value.trim();
      const address = document.getElementById('suggest-address').value.trim();
      const neighborhood = document.getElementById('suggest-neighborhood').value.trim();
      const price = document.getElementById('suggest-price').value.trim();
      const tables = document.getElementById('suggest-tables').value.trim();

      if (!name || !address) return;

      const suggestedData = JSON.stringify({ address, neighborhood: neighborhood || null, price: price || null, tables: tables || null });

      try {
        const { error } = await supabase.from('suggestions').insert([{
          type: 'new_bar',
          bar_name: name,
          suggested_data: suggestedData,
        }]);
        if (error) {
          console.error('Error submitting suggestion:', error);
          alert('Error submitting. Please try again.');
          return;
        }
        form.reset();
        overlay.classList.remove('open');
        alert('Thanks! We\'ll review and add it soon.');
      } catch (err) {
        console.error('Error:', err);
        alert('Error submitting. Please try again.');
      }
    });
  }

  function initInfoSubmit() {
    const overlay = document.getElementById('info-overlay');
    const closeBtn = document.getElementById('info-close');
    const form = document.getElementById('info-form');

    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    // Open info modal via event delegation on .info-submit-link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.info-submit-link');
      if (!link) return;

      const fieldType = link.dataset.infoType;
      const barId = link.dataset.barId;
      const barName = link.dataset.barName;

      document.getElementById('info-bar-id').value = barId;
      document.getElementById('info-bar-name').value = barName;
      document.getElementById('info-field-type').value = fieldType;

      if (fieldType === 'price') {
        document.getElementById('info-title').textContent = 'Submit Price Info';
        document.getElementById('info-subtitle').textContent = barName;
        document.getElementById('info-label').textContent = 'Price (e.g. $2/game, Free)';
        document.getElementById('info-value').type = 'text';
        document.getElementById('info-value').placeholder = 'e.g. $2/game';
      } else {
        document.getElementById('info-title').textContent = 'Submit Table Count';
        document.getElementById('info-subtitle').textContent = barName;
        document.getElementById('info-label').textContent = 'Number of Tables';
        document.getElementById('info-value').type = 'number';
        document.getElementById('info-value').placeholder = 'e.g. 2';
      }

      document.getElementById('info-value').value = '';
      overlay.classList.add('open');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const barId = document.getElementById('info-bar-id').value;
      const barName = document.getElementById('info-bar-name').value;
      const fieldType = document.getElementById('info-field-type').value;
      const value = document.getElementById('info-value').value.trim();

      if (!value) return;

      const suggestedData = JSON.stringify({ [fieldType]: value });

      try {
        const { error } = await supabase.from('suggestions').insert([{
          type: 'bar_info',
          bar_id: barId,
          bar_name: barName,
          suggested_data: suggestedData,
        }]);
        if (error) {
          console.error('Error submitting info:', error);
          alert('Error submitting. Please try again.');
          return;
        }
        form.reset();
        overlay.classList.remove('open');
        alert('Thanks! We\'ll verify and update.');
      } catch (err) {
        console.error('Error:', err);
        alert('Error submitting. Please try again.');
      }
    });
  }

  // ===== Authentication =====
  function countUserReviews(userId) {
    if (!userId) return 0;
    return allReviewsRaw.filter(function(r) { return r.user_id === userId; }).length;
  }

  function updateHeaderAuthUI() {
    var container = document.getElementById('header-user');
    if (!container) return;

    var lbLink = '<a class="header-leaderboard-link" href="/leaderboard/">Leaderboard</a>';
    if (currentUser) {
      var initial = currentUser.username.charAt(0).toUpperCase();
      var userReviewCount = countUserReviews(currentUser.id);
      container.innerHTML = lbLink +
        '<div class="header-user-avatar" id="header-avatar-btn" style="cursor:pointer;">' +
          escapeHtml(initial) +
        '</div>' +
        '<div class="header-user-dropdown" id="header-user-dropdown">' +
          '<div class="header-dropdown-name">' + escapeHtml(currentUser.username) + '</div>' +
          '<div class="header-dropdown-reviews">' + userReviewCount + ' review' + (userReviewCount !== 1 ? 's' : '') + '</div>' +
          '<button class="header-dropdown-signout" id="header-sign-out">Sign Out</button>' +
        '</div>';
    } else {
      container.innerHTML = lbLink + '<span class="header-sign-in" id="header-sign-in">Sign In</span>';
    }
  }

  function updateRatingUserUI() {
    var container = document.getElementById('rating-user-profile');
    if (!container) return;

    if (currentUser) {
      var initial = currentUser.username.charAt(0).toUpperCase();
      var userReviewCount = countUserReviews(currentUser.id);
      container.innerHTML =
        '<div class="user-avatar rating-avatar-btn" id="rating-avatar-btn" style="cursor:pointer;">' +
          escapeHtml(initial) +
        '</div>' +
        '<div class="header-user-dropdown rating-user-dropdown" id="rating-user-dropdown">' +
          '<div class="header-dropdown-name">' + escapeHtml(currentUser.username) + '</div>' +
          '<div class="header-dropdown-reviews">' + userReviewCount + ' review' + (userReviewCount !== 1 ? 's' : '') + '</div>' +
          '<button class="header-dropdown-signout" id="rating-sign-out">Sign Out</button>' +
        '</div>';
    } else {
      container.innerHTML =
        '<span class="header-sign-in rating-sign-in" id="rating-sign-in">Sign In</span>';
    }
  }

  function initAuth() {
    var overlay = document.getElementById('auth-overlay');
    var closeBtn = document.getElementById('auth-close');
    var form = document.getElementById('auth-form');
    var errorEl = document.getElementById('auth-error');
    var isSignUp = false;

    function setAuthMode(signUp) {
      isSignUp = signUp;
      document.getElementById('auth-title').textContent = signUp ? 'Sign Up' : 'Sign In';
      document.getElementById('auth-subtitle').textContent = signUp
        ? 'Create an account to track your reviews.'
        : 'Sign in to track your reviews.';
      document.getElementById('auth-submit-btn').textContent = signUp ? 'Sign Up' : 'Sign In';
      document.getElementById('auth-username-field').style.display = signUp ? 'block' : 'none';
      document.getElementById('auth-toggle').innerHTML = signUp
        ? 'Already have an account? <span class="auth-toggle-link" id="auth-toggle-link">Sign In</span>'
        : 'Don\'t have an account? <span class="auth-toggle-link" id="auth-toggle-link">Sign Up</span>';
      document.getElementById('auth-toggle-link').addEventListener('click', function() { setAuthMode(!signUp); });
      errorEl.style.display = 'none';
    }

    // Open auth modal from header "Sign In" link
    document.addEventListener('click', function(e) {
      if (e.target.id === 'header-sign-in' || e.target.closest('#header-sign-in')) {
        setAuthMode(false);
        form.reset();
        overlay.classList.add('open');
      }
    });

    // Close
    closeBtn.addEventListener('click', function() { overlay.classList.remove('open'); });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    // Form submit
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      errorEl.style.display = 'none';
      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;

      try {
        if (isSignUp) {
          var username = document.getElementById('auth-username').value.trim();
          if (!username) {
            errorEl.textContent = 'Username is required.';
            errorEl.style.display = 'block';
            errorEl.style.color = '#b55a5a';
            return;
          }
          var result = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { username: username } }
          });
          if (result.error) throw result.error;
          if (result.data.user && !result.data.session) {
            errorEl.textContent = 'Check your email to confirm your account.';
            errorEl.style.display = 'block';
            errorEl.style.color = '#5a8f5a';
          } else {
            form.reset();
            overlay.classList.remove('open');
          }
        } else {
          var signInResult = await supabase.auth.signInWithPassword({ email: email, password: password });
          if (signInResult.error) throw signInResult.error;
          form.reset();
          overlay.classList.remove('open');
        }
      } catch (err) {
        errorEl.textContent = err.message || 'An error occurred.';
        errorEl.style.display = 'block';
        errorEl.style.color = '#b55a5a';
      }
    });

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(function(event, session) {
      if (session && session.user) {
        currentUser = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata && session.user.user_metadata.username
            ? session.user.user_metadata.username
            : session.user.email.split('@')[0],
        };
      } else {
        currentUser = null;
      }
      updateHeaderAuthUI();
      updateRatingUserUI();
    });

    // Check initial session
    supabase.auth.getUser().then(function(resp) {
      if (resp.data && resp.data.user) {
        var user = resp.data.user;
        currentUser = {
          id: user.id,
          email: user.email,
          username: user.user_metadata && user.user_metadata.username
            ? user.user_metadata.username
            : user.email.split('@')[0],
        };
      }
      updateHeaderAuthUI();
    });

    // Avatar dropdown toggle (header + rating page)
    document.addEventListener('click', function(e) {
      var headerAvatar = e.target.closest('#header-avatar-btn');
      var ratingAvatar = e.target.closest('#rating-avatar-btn');

      if (headerAvatar) {
        var dd = document.getElementById('header-user-dropdown');
        if (dd) dd.classList.toggle('open');
        // Close rating dropdown if open
        var rdd = document.getElementById('rating-user-dropdown');
        if (rdd) rdd.classList.remove('open');
        return;
      }
      if (ratingAvatar) {
        var dd = document.getElementById('rating-user-dropdown');
        if (dd) dd.classList.toggle('open');
        // Close header dropdown if open
        var hdd = document.getElementById('header-user-dropdown');
        if (hdd) hdd.classList.remove('open');
        return;
      }

      // Close all dropdowns if clicking outside
      var hd = document.getElementById('header-user-dropdown');
      if (hd && !e.target.closest('.header-user-dropdown')) hd.classList.remove('open');
      var rd = document.getElementById('rating-user-dropdown');
      if (rd && !e.target.closest('.rating-user-dropdown')) rd.classList.remove('open');
    });

    // Sign out via event delegation (header + rating page)
    document.addEventListener('click', async function(e) {
      if (e.target.closest('#header-sign-out') || e.target.closest('#rating-sign-out')) {
        await supabase.auth.signOut();
      }
    });

    // Rating page "Sign In" link opens auth modal
    document.addEventListener('click', function(e) {
      if (e.target.id === 'rating-sign-in' || e.target.closest('#rating-sign-in')) {
        setAuthMode(false);
        form.reset();
        overlay.classList.add('open');
      }
    });
  }

  function initPopupLinks() {
    // Event delegation for "View Full Scorecard" links in popups
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.popup-view-link');
      if (link) {
        e.preventDefault();
        const barId = link.dataset.barId;
        const bar = bars.find(b => b.id === barId);
        if (bar) {
          openDetail(bar);
        }
      }
    });
  }

  // Browser back button support
  history.replaceState({ view: 'list' }, '');
  window.addEventListener('popstate', function(e) {
    var state = e.state || { view: 'list' };
    handlingPopState = true;

    var ratingOpen = document.getElementById('rating-ui').classList.contains('open');
    var detailOpen = document.getElementById('modal-overlay').classList.contains('open');

    if (state.view === 'detail' && ratingOpen) {
      // Going back from rating UI to detail
      closeRatingUI(true);
    } else if (state.view === 'list') {
      // Going back to the list
      if (ratingOpen) closeRatingUI(true);
      if (detailOpen) closeDetail(true);
    }

    handlingPopState = false;
  });

  load();
})();
