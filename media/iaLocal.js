/**
 * IA Local Panel — webview script
 * Handles communication with the VS Code WebviewViewProvider.
 */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    isModelLoaded: false,
    isDepsInstalled: false,
    modelsDir: '',
    currentModel: null,
    recommendedModels: [],
    installedModels: [],
    memoryInfo: null,
    warnedModelId: null,
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) { el.classList.add('visible'); }
  function hide(el) { el.classList.remove('visible'); }

  // ── API to VS Code ──────────────────────────────────────────────────────
  function post(data) {
    window.parent.postMessage({ type: 'vscodeApi', ...data }, '*');
  }

  function requestStatus() {
    post({ command: 'requestStatus' });
  }

  function requestRecommendedModels() {
    post({ command: 'requestRecommendedModels' });
  }

  function installDeps() {
    post({ command: 'installDeps' });
  }

  function loadModel(modelId) {
    post({ command: 'loadModel', modelId });
  }

  function unloadModel() {
    post({ command: 'unloadModel' });
  }

  function chooseModelsDir() {
    post({ command: 'chooseModelsDir' });
  }

  function searchModels(query) {
    post({ command: 'searchHuggingFace', query });
  }

  // ── UI updates ──────────────────────────────────────────────────────────
  function updateStatusBar() {
    const dot = $('status-dot');
    const label = $('status-label');
    const modelLabel = $('current-model');

    dot.className = '';
    if (state.isModelLoaded) {
      dot.classList.add('loaded');
      label.textContent = 'IA local: modelo cargado';
      modelLabel.textContent = state.currentModel
        ? esc(state.currentModel.split('/').pop())
        : '';
    } else if (!state.isDepsInstalled) {
      dot.classList.add('no-deps');
      label.textContent = 'IA local: sin instalar';
      modelLabel.textContent = '';
    } else {
      label.textContent = 'IA local: listo (sin modelo)';
      modelLabel.textContent = '';
    }
  }

  function getModelStatus(modelId) {
    if (!state.isModelLoaded || state.currentModel !== modelId) {
      return state.isDepsInstalled ? 'not-installed' : 'no-deps';
    }
    return 'loaded';
  }

  function renderRecommendedModels() {
    const container = $('recommended-models');
    container.innerHTML = '';

    state.recommendedModels.forEach(function (model) {
      const status = getModelStatus(model.id);
      const isLoading = $('progress-section').classList.contains('visible');
      const isWarned = state.warnedModelId === model.id;
      const memInfo = state.memoryInfo && state.currentModel === model.id ? state.memoryInfo : null;

      const card = document.createElement('div');
      card.className = 'model-card';

      // Top row: name + badge + actions
      const top = document.createElement('div');
      top.className = 'model-card-top';

      const info = document.createElement('div');
      info.className = 'model-info';

      const name = document.createElement('div');
      name.className = 'model-name';
      name.textContent = model.label;

      const meta = document.createElement('div');
      meta.className = 'model-meta';

      const size = document.createElement('span');
      size.textContent = model.size;
      meta.appendChild(size);

      if (model.recommended) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-recommended';
        badge.textContent = 'Recomendado';
        meta.appendChild(badge);
      }

      // Memory info if available
      if (memInfo && memInfo.required) {
        const memSpan = document.createElement('span');
        memSpan.style.fontSize = '9px';
        memSpan.style.color = 'var(--vscode-descriptionForeground)';
        memSpan.textContent = '~' + formatBytes(memInfo.required) + ' RAM';
        meta.appendChild(memSpan);
      }

      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge';
      statusBadge.id = 'badge-' + esc(model.id.replace(/\//g, '_'));
      if (status === 'loaded') {
        statusBadge.className += ' badge-loaded';
        statusBadge.textContent = 'Cargado';
      } else if (status === 'not-installed') {
        statusBadge.className += ' badge-not-installed';
        statusBadge.textContent = 'Sin instalar';
      } else {
        statusBadge.className += ' badge-not-installed';
        statusBadge.textContent = 'Sin instalar';
      }
      meta.appendChild(statusBadge);

      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'model-card-actions';

      if (state.isModelLoaded && state.currentModel === model.id) {
        // Model loaded → show unload button
        const unloadBtn = document.createElement('button');
        unloadBtn.className = 'btn btn-sm';
        unloadBtn.textContent = 'Liberar';
        unloadBtn.disabled = isLoading;
        unloadBtn.addEventListener('click', unloadModel);
        actions.appendChild(unloadBtn);
      } else if (isWarned) {
        // Warned → show "Cargar de todos modos" button
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-sm btn-primary';
        loadBtn.textContent = 'Cargar de todos modos';
        loadBtn.disabled = isLoading;
        loadBtn.addEventListener('click', function () {
          state.warnedModelId = null;
          loadModel(model.id);
        });
        actions.appendChild(loadBtn);
      } else {
        // Not loaded → show load button
        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-sm btn-primary';
        loadBtn.textContent = state.isDepsInstalled ? 'Cargar' : 'Instalar';
        loadBtn.disabled = isLoading;
        loadBtn.addEventListener('click', function () {
          if (!state.isDepsInstalled) {
            installDeps();
          } else {
            loadModel(model.id);
          }
        });
        actions.appendChild(loadBtn);
      }

      top.appendChild(info);
      top.appendChild(actions);

      card.appendChild(top);
      container.appendChild(card);
    });
  }

      function renderInstalledModels() {
        const container = $('installed-models');
        const header = $('installed-section-header');
        const description = $('installed-description');
        container.innerHTML = '';

        const models = state.installedModels;
        if (!models || models.length === 0) {
          hide(header);
          hide(description);
          return;
        }

        show(header);
        show(description);

        models.forEach(function (model) {
          const isLoaded = state.isModelLoaded && state.currentModel === model.id;
          const isRecommended = state.recommendedModels.some(function (r) { return r.id === model.id; });

          var card = document.createElement('div');
          card.className = 'model-card';

          var top = document.createElement('div');
          top.className = 'model-card-top';

          var info = document.createElement('div');
          info.className = 'model-info';

          var name = document.createElement('div');
          name.className = 'model-name';
          name.textContent = model.id;

          var meta = document.createElement('div');
          meta.className = 'model-meta';

          var badge = document.createElement('span');
          badge.className = 'badge' + (isLoaded ? ' badge-loaded' : ' badge-not-installed');
          badge.textContent = isLoaded ? 'En memoria' : 'En disco';
          meta.appendChild(badge);

          if (isRecommended) {
            var recBadge = document.createElement('span');
            recBadge.className = 'badge badge-recommended';
            recBadge.textContent = 'Recomendado';
            meta.appendChild(recBadge);
          }

          info.appendChild(name);
          info.appendChild(meta);

          var actions = document.createElement('div');
          actions.className = 'model-card-actions';

          if (isLoaded) {
            var unloadBtn = document.createElement('button');
            unloadBtn.className = 'btn btn-sm';
            unloadBtn.textContent = 'Liberar';
            unloadBtn.addEventListener('click', unloadModel);
            actions.appendChild(unloadBtn);
          } else {
            var loadBtn = document.createElement('button');
            loadBtn.className = 'btn btn-sm btn-primary';
            loadBtn.textContent = state.isDepsInstalled ? 'Cargar' : 'Instalar';
            loadBtn.addEventListener('click', function () {
              if (!state.isDepsInstalled) {
                installDeps();
              }
              loadModel(model.id);
            });
            actions.appendChild(loadBtn);
          }

          top.appendChild(info);
          top.appendChild(actions);
          card.appendChild(top);
          container.appendChild(card);
        });
      }

          function updateFolderSection() {
            const pathEl = $('folder-path');

            if (state.modelsDir) {
              pathEl.textContent = state.modelsDir;
              pathEl.classList.remove('empty');
            } else {
              pathEl.textContent = 'Por defecto: cache de HuggingFace (~/.cache/huggingface/)';
              pathEl.classList.add('empty');
            }
          }

          function updateSharedNotice(isShared) {
            const notice = $('shared-notice');
            if (isShared) {
              notice.classList.remove('hidden');
            } else {
              notice.classList.add('hidden');
            }
          }

  function showProgress(message, pct) {
    const section = $('progress-section');
    const label = $('progress-label');
    const fill = $('progress-fill');

    if (pct != null && pct >= 0) {
      label.textContent = message;
      fill.style.width = pct + '%';
      show(section);
    } else {
      label.textContent = message;
      fill.style.width = '0%';
      show(section);
    }
  }

  function hideProgress() {
    const section = $('progress-section');
    const fill = $('progress-fill');
    fill.style.width = '0%';
    hide(section);
  }

  function showError(message) {
    const section = $('error-section');
    section.textContent = message;
    show(section);
  }

  function hideError() {
    hide($('error-section'));
  }

  // Warning with option to proceed
  function showWarning(message, modelId) {
    const section = $('error-section');
    section.innerHTML = '';
    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.marginBottom = '8px';
    section.appendChild(msg);

    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'btn btn-sm btn-primary';
    proceedBtn.textContent = 'Cargar de todos modos';
    proceedBtn.addEventListener('click', function () {
      hideError();
      loadModel(modelId);
    });
    section.appendChild(proceedBtn);

    show(section);
  }

  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
    }
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  function renderSearchResults(results) {
    const container = $('search-results');
    container.innerHTML = '';

    if (!results || results.length === 0) {
      container.classList.remove('visible');
      return;
    }

    results.slice(0, 10).forEach(function (model) {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      const name = document.createElement('div');
      name.className = 'search-result-name';
      name.textContent = model.id;

      const meta = document.createElement('div');
      meta.className = 'search-result-meta';

      if (model.downloads) {
        const dl = document.createElement('span');
        dl.textContent = formatDownloads(model.downloads);
        meta.appendChild(dl);
      }
      if (model.sha) {
        const fmt = document.createElement('span');
        fmt.textContent = 'ONNX';
        meta.appendChild(fmt);
      }

      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn btn-sm';
      loadBtn.textContent = state.isDepsInstalled ? 'Cargar' : 'Instalar';
      loadBtn.addEventListener('click', function () {
        if (!state.isDepsInstalled) {
          installDeps();
        }
        loadModel(model.id);
      });

      item.appendChild(name);
      item.appendChild(meta);
      item.appendChild(loadBtn);
      container.appendChild(item);
    });

    show(container);
  }

  function formatDownloads(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M downloads';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K downloads';
    return n + ' downloads';
  }

  // ── Message handler ──────────────────────────────────────────────────────
  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg || msg.source !== 'vscodeApi') return;

    hideError();

    switch (msg.type) {
      case 'statusUpdate':
        state.isModelLoaded = !!msg.isModelLoaded;
        state.isDepsInstalled = !!msg.isDepsInstalled;
        state.modelsDir = msg.modelsDir || '';
        state.currentModel = msg.currentModel || null;
        state.installedModels = msg.installedModels || [];
        state.memoryInfo = msg.memoryInfo || null;
        updateStatusBar();
        renderRecommendedModels();
        renderInstalledModels();
        updateFolderSection();
        break;

      case 'sharedFolder':
        updateSharedNotice(!!msg.isShared);
        break;

      case 'progress':
        showProgress(msg.message || '', msg.progress);
        break;

      case 'modelUnloaded':
        state.isModelLoaded = false;
        state.currentModel = null;
        state.warnedModelId = null;
        hideProgress();
        updateStatusBar();
        renderRecommendedModels();
        break;

      case 'modelLoaded':
        state.isModelLoaded = true;
        state.currentModel = msg.modelId || null;
        state.warnedModelId = null;
        hideProgress();
        updateStatusBar();
        renderRecommendedModels();
        break;

      case 'recommendedModels':
        state.recommendedModels = msg.models || [];
        renderRecommendedModels();
        break;

      case 'searchResults':
        renderSearchResults(msg.results || []);
        break;

      case 'warning':
        // Memory warning - show with option to proceed
        state.warnedModelId = msg.modelId || null;
        hideProgress();
        showWarning(msg.message || 'Advertencia de memoria', msg.modelId);
        renderRecommendedModels(); // re-render to show proceed button
        break;

      case 'error':
        hideProgress();
        state.warnedModelId = null;
        showError(msg.message || 'Error desconocido');
        renderRecommendedModels(); // re-render to re-enable buttons
        break;

      case 'depsInstalled':
        state.isDepsInstalled = true;
        updateStatusBar();
        renderRecommendedModels();
        break;
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    requestStatus();
    requestRecommendedModels();
    initThemeToggle();
  }

  // ── Theme toggle ─────────────────────────────────────────────────────────
  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }

    function getPreferredTheme() {
      const saved = localStorage.getItem('iaLocal-theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('iaLocal-theme', next);
    }

    // Initial apply
    applyTheme(getPreferredTheme());

    toggle.addEventListener('click', toggleTheme);
    toggle.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('iaLocal-theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Search input handler (debounced)
  let searchTimer;
  $('search-input').addEventListener('input', function () {
    clearTimeout(searchTimer);
    const query = this.value.trim();
    if (query.length < 3) {
      $('search-results').classList.remove('visible');
      return;
    }
    searchTimer = setTimeout(function () {
      searchModels(query);
    }, 600);
  });

  // Search on Enter
  $('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearTimeout(searchTimer);
      const query = this.value.trim();
      if (query.length >= 3) {
        searchModels(query);
      }
    }
  });

  // Listen for webview ready
  window.addEventListener('load', function () {
    // Signal ready to provider
    post({ command: 'webviewReady' });
  });

  // The provider sends 'webviewReady' ack which triggers actual init
  // Fallback: request status after a short delay
  setTimeout(function () {
    if (state.recommendedModels.length === 0) {
      init();
    }
  }, 300);

  // Override the init to be triggered by provider
  window.addEventListener('message', function handler(event) {
    const msg = event.data;
    if (msg && msg.source === 'vscodeApi' && msg.type === 'webviewReady') {
      window.removeEventListener('message', handler);
      init();
    }
  });
})();
