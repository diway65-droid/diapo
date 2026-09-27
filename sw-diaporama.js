<script>
(() => {
  const $ = (id) => document.getElementById(id);

  // ==========================================
  // ANTI-MISE EN VEILLE (WAKE LOCK)
  // ==========================================
  let wakeLock = null;
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('☀️ Diaporama : Écran maintenu allumé');
      } catch (err) {
        console.warn(`Wake Lock indisponible : ${err.message}`);
      }
    }
  }

  document.addEventListener('pointerdown', () => {
    if (!wakeLock) requestWakeLock();
  }, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // ==========================================
  // PLEIN ÉCRAN
  // ==========================================
  $('btn-fullscreen').addEventListener('click', () => {
    requestWakeLock();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  });

  // ==========================================
  // FIREBASE CONFIGURATION
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyAHCUcWse5QpNPxWQKYZqT-4elxIxkAO3s",
    authDomain: "mimie-doudou-40-ans.firebaseapp.com",
    projectId: "mimie-doudou-40-ans",
    storageBucket: "mimie-doudou-40-ans.firebasestorage.app",
    messagingSenderId: "745270670876",
    appId: "1:745270670876:web:7bdadd220d43fd7ec691d9"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();

  // ==========================================
  // LOGIQUE DIAPORAMA
  // ==========================================
  const INTERVAL_TIME = 4000;
  let allPhotos = [];
  let playlist = [];
  let currentSlideEl = $('slide-a');
  let nextSlideEl = $('slide-b');
  let loopTimer = null;
  let isInitialLoad = true;

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getNextPhotoUrl() {
    if (playlist.length === 0) {
      playlist = shuffle(allPhotos);
    }
    return playlist.pop();
  }

  function displayPhoto(url, isInstantNew = false) {
    if (!url) {
      console.warn("URL de photo vide ou invalide.");
      return;
    }

    const img = new Image();
    img.src = url;

    img.onload = () => {
      $('empty-state').style.display = 'none';

      nextSlideEl.innerHTML = '';
      nextSlideEl.appendChild(img);

      // Bascule fondu
      nextSlideEl.classList.add('active');
      currentSlideEl.classList.remove('active');

      // Inversion des conteneurs
      const temp = currentSlideEl;
      currentSlideEl = nextSlideEl;
      nextSlideEl = temp;

      if (isInstantNew) {
        $('new-badge').style.display = 'block';
        setTimeout(() => {
          $('new-badge').style.display = 'none';
        }, 3500);
      }
    };

    img.onerror = () => {
      console.error("Échec de chargement pour l'URL :", url);
      // Supprimer l'URL défectueuse de la liste pour ne plus la rappeler
      allPhotos = allPhotos.filter(u => u !== url);
      playlist = playlist.filter(u => u !== url);

      // Tenter d'afficher immédiatement la suivante si disponible
      if (allPhotos.length > 0) {
        displayPhoto(getNextPhotoUrl());
      }
    };
  }

  function startLoop() {
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = setInterval(() => {
      if (allPhotos.length > 0) {
        displayPhoto(getNextPhotoUrl());
      }
    }, INTERVAL_TIME);
  }

  // ==========================================
  // ÉCOUTE FIRESTORE TEMPS RÉEL
  // ==========================================
  db.collection('photos')
    .orderBy('createdAt', 'asc')
    .onSnapshot((snapshot) => {
      let hasNewDoc = false;
      let latestUrl = null;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Support du champ url ou photoUrl selon ce qui a été stocké
          const photoUrl = data ? (data.url || data.photoUrl) : null;

          if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim() !== '') {
            allPhotos.push(photoUrl.trim());
            latestUrl = photoUrl.trim();
            hasNewDoc = true;
          }
        }
      });

      $('counter').textContent = `${allPhotos.length} photo${allPhotos.length > 1 ? 's' : ''}`;

      if (allPhotos.length === 0) return;

      if (isInitialLoad) {
        isInitialLoad = false;
        playlist = shuffle(allPhotos);
        displayPhoto(getNextPhotoUrl());
        startLoop();
      } else if (hasNewDoc && latestUrl) {
        displayPhoto(latestUrl, true);
        startLoop();
      }
    }, (error) => {
      console.error("Erreur Firestore :", error);
    });

  // ==========================================
  // SERVICE WORKER
  // ==========================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw-diaporama.js').catch(err => {
        console.warn('Erreur SW Diaporama :', err);
      });
    });
  }
})();
</script>
