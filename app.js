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
  ];
  const RATING_LABELS = {
    tableQuality: 'Table Quality',
    competitionLevel: 'Competition',
    atmosphere: 'Atmosphere',
    elbowRoom: 'Elbow Room',
    waitTime: 'Wait Time',
    cueQuality: 'Cue Quality',
  };

  // Map database column names to frontend keys
  const DB_TO_FRONTEND = {
    table_quality: 'tableQuality',
    competition: 'competitionLevel',
    atmosphere: 'atmosphere',
    elbow_room: 'elbowRoom',
    wait_time: 'waitTime',
    cue_quality: 'cueQuality',
  };

  const FRONTEND_TO_DB = {
    tableQuality: 'table_quality',
    competitionLevel: 'competition',
    atmosphere: 'atmosphere',
    elbowRoom: 'elbow_room',
    waitTime: 'wait_time',
    cueQuality: 'cue_quality',
  };

  let bars = [];
  let map = null;
  let markers = {};
  let selectedId = null;
  let popupBarId = null; // Track which bar's popup is currently open
  let updatingIcons = false; // Flag to prevent popupclose from interfering during icon updates
  let currentSort = 'rating';
  let currentFilter = 'all';

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

  function renderDetail(bar) {
    const score = overallScore(bar.ratings);
    const displayScore = score ? score.toFixed(1) : '0';
    const maxScore = 5;
    const reviewCount = bar.reviewCount || 0;
    const reviewText = reviewCount === 1 ? 'Based on 1 review' : `Based on ${reviewCount} reviews`;

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
    html += '<span class="venue-status"><span class="status-indicator"></span>Open Now</span>';
    html += '</div>';
    html += '<div class="venue-divider"></div>';

    html += '<div class="info-cards">';

    // Tables card with inline SVG icon
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#d4af37" class="hours-svg"><rect x="4" y="7" width="16" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round"></rect><circle cx="5" cy="8" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="19" cy="8" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="5" cy="16" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="19" cy="16" r="0.9" fill="#d4af37" stroke="none"></circle><circle cx="12" cy="7.5" r="0.8" fill="#d4af37" stroke="none"></circle><circle cx="12" cy="16.5" r="0.8" fill="#d4af37" stroke="none"></circle></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">TABLES</span><span class="info-card-value">' + escapeHtml(String(bar.tableCount)) + ' Tables Available</span><span class="info-card-sub">' + escapeHtml(bar.tableBrand || 'House Tables') + '</span></div></div>';

    // Price card with inline SVG icon
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="#d4af37" class="hours-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">PRICE</span><span class="info-card-value">' + escapeHtml(bar.price) + '</span><span class="info-card-sub">' + escapeHtml(bar.priceType || 'per hour per person') + '</span></div></div>';

    // Location card with inline SVG icon
    html += '<div class="info-card"><div class="info-card-icon svg-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d4af37" class="icon-svg"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">LOCATION</span><span class="info-card-value">' + escapeHtml(bar.address) + '</span><span class="info-card-sub link">GET DIRECTIONS</span></div></div>';

    // Hours card with inline SVG icon
    html += '<div class="info-card"><div class="info-card-icon hours-icon-circle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#d4af37" class="hours-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
    html += '<div class="info-card-content"><span class="info-card-label">HOURS</span><span class="info-card-value">' + escapeHtml(bar.hours || 'Hours vary') + '</span></div></div>';

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

    html += '<div class="overall-rating-card">';
    html += '<div class="overall-rating-info">';
    html += '<span class="overall-label">OVERALL RATING</span>';
    html += '<div class="overall-score-display"><span class="score-big">' + displayScore + '</span></div>';
    html += '<span class="overall-sub">out of ' + maxScore + '.0</span>';
    html += '</div>';
    html += renderProgressRing(score || 0, maxScore);
    html += '</div>';

    html += '<div class="ratings-section">';
    RATING_KEYS.forEach((k) => {
      if (bar.ratings[k] != null) html += renderRatingRow(k, bar.ratings[k], bar.id + '-' + k);
    });
    html += '</div>';

    html += '<div class="modal-footer">';
    html += '<span class="modal-footer-text">Ratings updated in real-time • Community verified</span>';
    html += '</div>';

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

    // Trigger progress ring animation
    setTimeout(() => {
      const ring = document.querySelector('.progress-ring-fill');
      if (ring) ring.classList.add('animate');
    }, 100);

    // Update all marker icons - selected bar gets highlight style
    updatingIcons = true;
    Object.keys(markers).forEach((id) => {
      const m = markers[id];
      m.setIcon(createPinIcon(id === bar.id));
    });
    const m = markers[bar.id];
    if (m) {
      popupBarId = bar.id;
      m.openPopup();
      map.flyTo([bar.lat, bar.lng], map.getZoom(), { duration: 0.3 });
    }
    updatingIcons = false;

    const list = document.getElementById('bar-list');
    list.querySelectorAll('.bar-list-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === bar.id);
    });
  }

  function closeDetail() {
    selectedId = null;
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';

    // Find which marker has an open popup
    let openPopupId = null;
    Object.keys(markers).forEach((id) => {
      if (markers[id].isPopupOpen()) {
        openPopupId = id;
      }
    });

    // Set flag to prevent popupclose from interfering
    updatingIcons = true;

    // Reset markers - keep the one with open popup highlighted
    Object.keys(markers).forEach((id) => {
      const m = markers[id];
      const shouldHighlight = id === openPopupId;
      m.setIcon(createPinIcon(shouldHighlight));
    });

    // If a popup was open, make sure it stays open (setIcon might close it)
    if (openPopupId && markers[openPopupId]) {
      popupBarId = openPopupId;
      markers[openPopupId].openPopup();
    }

    updatingIcons = false;

    document.getElementById('bar-list').querySelectorAll('.bar-list-item').forEach((el) => {
      el.classList.remove('active');
    });
  }

  function createPinIcon(highlight) {
    const div = document.createElement('div');
    let className = 'pin-marker';
    if (highlight) className += ' highlight';
    div.className = className;

    // Circular pins: anchor at center
    const size = highlight ? 24 : 16;
    return L.divIcon({
      html: div,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function addBarToMap(bar, popupContent) {
    const icon = createPinIcon(false);
    const marker = L.marker([bar.lat, bar.lng], { icon })
      .addTo(map)
      .bindPopup(popupContent);

    // When popup opens (pin clicked), highlight this pin and reset others
    marker.on('popupopen', () => {
      // Reset previous popup bar's pin if different
      if (popupBarId && popupBarId !== bar.id && markers[popupBarId]) {
        markers[popupBarId].setIcon(createPinIcon(false));
      }
      popupBarId = bar.id;
      marker.setIcon(createPinIcon(true));
    });

    // When popup closes, reset pin to default (unless detail card is open or we're updating icons)
    marker.on('popupclose', () => {
      if (updatingIcons) return; // Don't interfere during icon updates
      popupBarId = null;
      if (selectedId !== bar.id) {
        marker.setIcon(createPinIcon(false));
      }
    });

    markers[bar.id] = marker;
  }

  function buildPopupContent(bar) {
    const score = overallScore(bar.ratings);
    const scoreDisplay = score != null ? score.toFixed(1) : '—';
    return (
      '<div class="popup-name">' + escapeHtml(bar.name) + '</div>' +
      '<div class="popup-meta">' +
      '<span>' + escapeHtml(bar.neighborhood) + '</span>' +
      '<span class="popup-rating"><span class="popup-rating-star">★</span> ' + scoreDisplay + '</span>' +
      '</div>' +
      '<a href="#" class="popup-view-link" data-bar-id="' + bar.id + '">View Full Scorecard →</a>'
    );
  }

  function renderListItem(bar) {
    const score = overallScore(bar.ratings);
    const scoreStr = score != null ? score.toFixed(1) : '—';
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
      default:
        sorted.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
    }
    return sorted;
  }

  function filterBars(query) {
    const q = (query || '').trim().toLowerCase();
    let filtered = bars;

    // Apply neighborhood filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter((b) => b.neighborhood === currentFilter);
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

  function initMap() {
    map = L.map('map', {
      center: [40.72, -74.0],
      zoom: 11,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    bars.forEach((bar) => {
      addBarToMap(bar, buildPopupContent(bar));
    });

    const group = L.featureGroup(Object.values(markers));
    if (group.getBounds().isValid()) map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 12 });
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

  function initDetailClose() {
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeDetail();
    });
  }

  // ===== Rating UI =====
  const RATING_CATEGORIES = [
    { key: 'tableQuality', title: 'Table Quality', subtitle: 'CLOTH CONDITION, LEVELNESS, RAILS', labelLeft: 'ROUGH', labelRight: 'PRISTINE', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><rect x="4" y="7" width="16" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round"></rect><circle cx="5" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="8" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="5" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="19" cy="16" r="0.9" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="7.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle><circle cx="12" cy="16.5" r="0.8" fill="rgba(232, 215, 176, 0.6)" stroke="none"></circle></svg>' },
    { key: 'competitionLevel', title: 'Competition', subtitle: 'PLAYER SKILL LEVEL', labelLeft: 'CASUALS', labelRight: 'SHARKS', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path></svg>' },
    { key: 'atmosphere', title: 'Atmosphere', subtitle: 'LIGHTING, MUSIC, VIBE', labelLeft: 'BEAT', labelRight: 'ELECTRIC', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path></svg>' },
    { key: 'elbowRoom', title: 'Elbow Room', subtitle: 'SPACE AROUND TABLES, CROWDING', labelLeft: 'TIGHT', labelRight: 'SPACIOUS', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path></svg>' },
    { key: 'waitTime', title: 'Wait Time', subtitle: 'TABLE AVAILABILITY', labelLeft: 'LONG WAITS', labelRight: 'NO WAIT', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
    { key: 'cueQuality', title: 'Cue Quality', subtitle: 'STICK CONDITION, CHALK, TIPS', labelLeft: 'ROUGH', labelRight: 'PRO GRADE', icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="rgba(232, 215, 176, 0.6)"><line x1="4" y1="20" x2="20" y2="4" stroke-width="2.2" stroke-linecap="round"></line><line x1="4" y1="20" x2="7" y2="17" stroke-width="3" stroke-linecap="round"></line></svg>' },
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
  }

  function closeRatingUI() {
    document.getElementById('rating-ui').classList.remove('open');
    document.body.style.overflow = '';
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
    if (completed === 6) {
      submitBtn.classList.add('enabled');
    } else {
      submitBtn.classList.remove('enabled');
    }
  }

  async function submitReview() {
    if (Object.keys(userRatings).length !== 6 || !currentRatingBar) {
      return;
    }

    const notes = document.getElementById('rating-notes').value.trim();

    // Prepare review data for Supabase
    const reviewData = {
      bar_id: currentRatingBar.id,
      reviewer_name: '@jack', // Could be made dynamic with auth
      table_quality: userRatings.tableQuality,
      competition: userRatings.competitionLevel,
      atmosphere: userRatings.atmosphere,
      elbow_room: userRatings.elbowRoom,
      wait_time: userRatings.waitTime,
      cue_quality: userRatings.cueQuality,
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
      closeRatingUI();
      closeDetail();

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
    document.getElementById('rating-back').addEventListener('click', closeRatingUI);

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
        };

        if (reviewCount > 0) {
          barReviews.forEach(review => {
            ratings.tableQuality += review.table_quality;
            ratings.competitionLevel += review.competition;
            ratings.atmosphere += review.atmosphere;
            ratings.elbowRoom += review.elbow_room;
            ratings.waitTime += review.wait_time;
            ratings.cueQuality += review.cue_quality;
          });

          // Calculate averages
          Object.keys(ratings).forEach(key => {
            ratings[key] = Math.round((ratings[key] / reviewCount) * 10) / 10;
          });
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
          ratings: ratings,
          reviewCount: reviewCount,
          overallScore: overallScore(ratings),
        };
      });

    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    }
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
    initMap();
    initSearch();
    initSortDropdown();
    initFilterDropdown();
    initDetailClose();
    initRatingUI();
    initPopupLinks();
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

  load();
})();
