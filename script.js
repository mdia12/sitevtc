document.addEventListener('DOMContentLoaded', function(){
  // year in footer
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  const form = document.getElementById('booking-form');
  const result = document.getElementById('booking-result');
  
  // Theme management
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.querySelector('.theme-icon');
  
  // Check for saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  
  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      themeIcon.textContent = '☀️';
      themeToggle.setAttribute('aria-label', 'Basculer en mode clair');
    } else {
      themeIcon.textContent = '🌙';
      themeToggle.setAttribute('aria-label', 'Basculer en mode sombre');
    }
  }
  
  themeToggle.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Smooth transition
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  });
  
  // Map and address handling
  let map = null;
  let pickupMarker = null;
  let dropoffMarker = null;
  let routeControl = null;
  let pickupCoords = null;
  let dropoffCoords = null;

  const pickupInput = document.getElementById('pickup-input');
  const dropoffInput = document.getElementById('dropoff-input');
  const pickupSuggestions = document.getElementById('pickup-suggestions');
  const dropoffSuggestions = document.getElementById('dropoff-suggestions');

  // Initialize map
  function initMap() {
    if (!map) {
      map = L.map('route-map').setView([48.8566, 2.3522], 11); // Paris center
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
    }
  }

  // Search addresses using Nominatim
  async function searchAddress(query) {
    if (query.length < 3) return [];
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&limit=5&addressdetails=1`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching address:', error);
      return [];
    }
  }

  // Show address suggestions
  function showSuggestions(results, suggestionsEl, inputEl, isPickup) {
    suggestionsEl.innerHTML = '';
    if (results.length === 0) {
      suggestionsEl.style.display = 'none';
      return;
    }

    results.forEach(result => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = result.display_name;
      div.addEventListener('click', () => {
        inputEl.value = result.display_name;
        suggestionsEl.style.display = 'none';
        
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        if (isPickup) {
          pickupCoords = [lat, lon];
        } else {
          dropoffCoords = [lat, lon];
        }
        
        updateMap();
      });
      suggestionsEl.appendChild(div);
    });
    
    suggestionsEl.style.display = 'block';
  }

  // Update map with markers and route
  function updateMap() {
    if (!map) initMap();
    
    // Add pickup marker
    if (pickupCoords) {
      if (pickupMarker) map.removeLayer(pickupMarker);
      pickupMarker = L.marker(pickupCoords)
        .addTo(map)
        .bindPopup('Point de départ')
        .openPopup();
    }
    
    // Add dropoff marker
    if (dropoffCoords) {
      if (dropoffMarker) map.removeLayer(dropoffMarker);
      dropoffMarker = L.marker(dropoffCoords)
        .addTo(map)
        .bindPopup('Destination');
    }
    
    // Draw route if both points are set
    if (pickupCoords && dropoffCoords) {
      if (routeControl) map.removeControl(routeControl);
      
      // Simple line between points (for demo - you could use a routing service)
      const routeLine = L.polyline([pickupCoords, dropoffCoords], {
        color: '#c9a96e',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      
      // Fit map to show both points
      const group = new L.featureGroup([pickupMarker, dropoffMarker]);
      map.fitBounds(group.getBounds().pad(0.1));
      
      // Update map info
      const mapInfo = document.querySelector('.map-info');
      if (mapInfo) {
        const distance = calculateDistance(pickupCoords, dropoffCoords);
        mapInfo.textContent = `Distance estimée: ${distance.toFixed(1)} km`;
      }
    }
  }

  // Calculate distance between two points
  function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Address input handlers
  let pickupTimeout;
  pickupInput.addEventListener('input', function() {
    clearTimeout(pickupTimeout);
    const query = this.value;
    pickupTimeout = setTimeout(async () => {
      if (query.length >= 3) {
        const results = await searchAddress(query);
        showSuggestions(results, pickupSuggestions, pickupInput, true);
      } else {
        pickupSuggestions.style.display = 'none';
      }
    }, 300);
  });

  let dropoffTimeout;
  dropoffInput.addEventListener('input', function() {
    clearTimeout(dropoffTimeout);
    const query = this.value;
    dropoffTimeout = setTimeout(async () => {
      if (query.length >= 3) {
        const results = await searchAddress(query);
        showSuggestions(results, dropoffSuggestions, dropoffInput, false);
      } else {
        dropoffSuggestions.style.display = 'none';
      }
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', function(e) {
    if (!pickupInput.contains(e.target) && !pickupSuggestions.contains(e.target)) {
      pickupSuggestions.style.display = 'none';
    }
    if (!dropoffInput.contains(e.target) && !dropoffSuggestions.contains(e.target)) {
      dropoffSuggestions.style.display = 'none';
    }
  });

  function showMessage(html, ok=true){
    result.innerHTML = '';
    const el = document.createElement('div');
    el.className = ok ? 'success' : 'error';
    el.style.padding = '.6rem';
    el.style.borderRadius = '8px';
    el.style.background = ok ? 'linear-gradient(90deg, rgba(16,185,129,0.08), transparent)' : 'linear-gradient(90deg, rgba(239,68,68,0.06), transparent)';
    el.style.color = ok ? '#065f46' : '#7f1d1d';
    el.innerHTML = html;
    result.appendChild(el);
  }

  function validatePhone(phone){
    // loose French mobile pattern (starts with 06 or 07 or international +33)
    return /^(?:\+33|0)[67]\d{8}$/.test(phone.replace(/\s+/g,''));
  }

  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      result.innerHTML = '';
      const data = new FormData(form);
      const name = (data.get('name')||'').toString().trim();
      const phone = (data.get('phone')||'').toString().trim();
      const pickup = (data.get('pickup')||'').toString().trim();
      const dropoff = (data.get('dropoff')||'').toString().trim();
      const datetime = (data.get('datetime')||'').toString();
      const passengers = Number(data.get('passengers')||1);
      const vehicle = (data.get('vehicle')||'').toString().trim();

      if(!name || !phone || !pickup || !dropoff || !datetime || !vehicle){
        showMessage('Veuillez compléter tous les champs obligatoires.', false);
        return;
      }
      if(!validatePhone(phone)){
        showMessage('Format du téléphone invalide. Ex: 06XXXXXXXX ou +336XXXXXXXX', false);
        return;
      }
      const when = new Date(datetime);
      if(isNaN(when.getTime()) || when < new Date()){
        showMessage('Veuillez choisir une date et heure future.', false);
        return;
      }
      if(passengers < 1 || passengers > 8){
        showMessage('Nombre de passagers invalide (1-8 pour nos véhicules).', false);
        return;
      }

      // Simulate booking success with VTC-specific messaging
      const token = 'VTC-' + Math.random().toString(36).slice(2,9).toUpperCase();
      const vehicleText = {
        'berline': 'une berline premium',
        'van': 'un van de luxe',
        'limousine': 'une limousine'
      }[vehicle] || 'un véhicule premium';
      
      let distanceText = '';
      if (pickupCoords && dropoffCoords) {
        const distance = calculateDistance(pickupCoords, dropoffCoords);
        distanceText = `<br/><em>Distance: ${distance.toFixed(1)} km</em>`;
      }
      
      showMessage(`<strong>Réservation VTC confirmée</strong><br/>Merci ${escapeHtml(name)} — Référence <strong>${token}</strong>.<br/>Votre chauffeur vous attendra avec ${vehicleText} à ${escapeHtml(pickup)} le ${when.toLocaleString('fr-FR')}.${distanceText}<br/><em>Vous recevrez les détails du chauffeur par SMS.</em>`);
      form.reset();
      
      // Reset map
      pickupCoords = null;
      dropoffCoords = null;
      if (pickupMarker) map.removeLayer(pickupMarker);
      if (dropoffMarker) map.removeLayer(dropoffMarker);
      if (routeControl) map.removeControl(routeControl);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  // Cookie Management
  function checkCookieConsent() {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setTimeout(() => {
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.classList.add('show');
      }, 2000);
    }
  }

  window.acceptCookies = function() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookie-banner').classList.remove('show');
  };

  window.declineCookies = function() {
    localStorage.setItem('cookieConsent', 'declined');
    document.getElementById('cookie-banner').classList.remove('show');
  };

  // Legal Modal Management
  const legalContent = {
    mentions: {
      title: "Mentions Légales",
      content: `
        <h3>1. Informations légales</h3>
        <p><strong>Raison sociale :</strong> Instant Confort SASU</p>
        <p><strong>Siège social :</strong> 123 Avenue des Champs-Élysées, 75008 Paris</p>
        <p><strong>SIRET :</strong> 123 456 789 00012</p>
        <p><strong>RCS :</strong> Paris B 123 456 789</p>
        <p><strong>Capital social :</strong> 50 000 €</p>
        <p><strong>Dirigeant :</strong> M. Jean Dupont</p>
        <p><strong>Email :</strong> contact@instant-confort.fr</p>
        <p><strong>Téléphone :</strong> +33 1 23 45 67 89</p>

        <h3>2. Activité</h3>
        <p>Instant Confort est une société spécialisée dans le transport de personnes avec chauffeur (VTC). Nous proposons des services de transport premium avec une flotte de véhicules haut de gamme.</p>

        <h3>3. Licences et autorisations</h3>
        <p>La société dispose de toutes les licences nécessaires pour exercer l'activité de VTC :</p>
        <ul>
          <li>Licence VTC n° EVTC123456789</li>
          <li>Inscrite au registre des VTC de la Préfecture de Paris</li>
          <li>Assurance responsabilité civile professionnelle : AXA Police n° 987654321</li>
        </ul>

        <h3>4. Hébergement</h3>
        <p><strong>Hébergeur :</strong> OVH SAS<br>
        2 rue Kellermann, 59100 Roubaix, France</p>

        <h3>5. Propriété intellectuelle</h3>
        <p>Le présent site et son contenu sont protégés par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
      `
    },
    privacy: {
      title: "Politique de Confidentialité",
      content: `
        <h3>1. Collecte des données personnelles</h3>
        <p>Dans le cadre de nos services VTC, nous collectons les données suivantes :</p>
        <ul>
          <li><strong>Données d'identification :</strong> nom, prénom, téléphone, email</li>
          <li><strong>Données de géolocalisation :</strong> adresses de prise en charge et destination</li>
          <li><strong>Données de réservation :</strong> date, heure, nombre de passagers, type de véhicule</li>
          <li><strong>Données techniques :</strong> adresse IP, cookies, données de navigation</li>
        </ul>

        <h3>2. Finalités du traitement</h3>
        <p>Vos données sont utilisées pour :</p>
        <ul>
          <li>Traiter et gérer vos réservations VTC</li>
          <li>Vous contacter concernant votre transport</li>
          <li>Améliorer nos services et notre site web</li>
          <li>Respecter nos obligations légales et réglementaires</li>
          <li>Gérer la facturation et les paiements</li>
        </ul>

        <h3>3. Base légale</h3>
        <p>Le traitement de vos données repose sur :</p>
        <ul>
          <li>L'exécution du contrat de transport (réservation VTC)</li>
          <li>Votre consentement pour les cookies et communications marketing</li>
          <li>Le respect d'obligations légales (facturation, déclarations)</li>
        </ul>

        <h3>4. Conservation des données</h3>
        <p>Vos données sont conservées :</p>
        <ul>
          <li><strong>Données client :</strong> 3 ans après la dernière course</li>
          <li><strong>Données de facturation :</strong> 10 ans (obligation comptable)</li>
          <li><strong>Cookies :</strong> 13 mois maximum</li>
        </ul>

        <h3>5. Vos droits</h3>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l'effacement</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité</li>
          <li>Droit d'opposition</li>
        </ul>
        <p>Pour exercer vos droits : <strong>dpo@instant-confort.fr</strong></p>

        <h3>6. Sécurité</h3>
        <p>Nous mettons en place des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès, modification, divulgation ou destruction non autorisés.</p>

        <h3>7. Transferts de données</h3>
        <p>Vos données peuvent être transmises à nos partenaires (chauffeurs, prestataires de paiement) uniquement dans le cadre nécessaire à l'exécution du service.</p>
      `
    },
    terms: {
      title: "Conditions Générales de Service",
      content: `
        <h3>1. Objet</h3>
        <p>Les présentes conditions générales régissent l'utilisation des services de transport avec chauffeur proposés par Instant Confort.</p>

        <h3>2. Services proposés</h3>
        <p>Instant Confort propose des services de transport de personnes avec chauffeur :</p>
        <ul>
          <li>Transferts aéroports et gares</li>
          <li>Transport d'affaires</li>
          <li>Événements et mariages</li>
          <li>Mise à disposition de véhicule avec chauffeur</li>
          <li>Courses longue distance</li>
        </ul>

        <h3>3. Réservations</h3>
        <p><strong>3.1 Modalités :</strong> Les réservations s'effectuent via notre site web ou par téléphone.</p>
        <p><strong>3.2 Confirmation :</strong> Toute réservation fait l'objet d'une confirmation par SMS ou email.</p>
        <p><strong>3.3 Modification :</strong> Les modifications doivent être demandées au moins 2h avant le départ.</p>

        <h3>4. Tarifs et paiement</h3>
        <p><strong>4.1 Tarification :</strong> Les prix sont indiqués TTC et confirmés lors de la réservation.</p>
        <p><strong>4.2 Paiement :</strong> Paiement par carte bancaire, espèces ou virement.</p>
        <p><strong>4.3 Facturation :</strong> Une facture est émise pour chaque course.</p>

        <h3>5. Annulation</h3>
        <p><strong>5.1 Par le client :</strong></p>
        <ul>
          <li>Gratuite jusqu'à 2h avant le départ</li>
          <li>50% du prix entre 2h et 30 min avant</li>
          <li>100% du prix moins de 30 min avant</li>
        </ul>
        <p><strong>5.2 Par Instant Confort :</strong> En cas de force majeure, remboursement intégral.</p>

        <h3>6. Responsabilité</h3>
        <p><strong>6.1 Transport :</strong> Instant Confort s'engage à fournir un service de qualité avec des chauffeurs professionnels.</p>
        <p><strong>6.2 Retards :</strong> Nous ne saurions être tenus responsables des retards dus à la circulation ou cas de force majeure.</p>
        <p><strong>6.3 Objets perdus :</strong> Instant Confort conserve les objets oubliés 30 jours.</p>

        <h3>7. Assurance</h3>
        <p>Tous nos véhicules sont assurés pour le transport de personnes avec une couverture responsabilité civile de 1 000 000 €.</p>

        <h3>8. Réclamations</h3>
        <p>Toute réclamation doit être adressée sous 48h à : <strong>reclamations@instant-confort.fr</strong></p>

        <h3>9. Droit applicable</h3>
        <p>Les présentes conditions sont soumises au droit français. Tout litige relève de la compétence des tribunaux de Paris.</p>

        <h3>10. Modifications</h3>
        <p>Instant Confort se réserve le droit de modifier les présentes conditions à tout moment. La version en vigueur est celle publiée sur le site web.</p>
      `
    },
    cookies: {
      title: "Politique des Cookies",
      content: `
        <h3>1. Qu'est-ce qu'un cookie ?</h3>
        <p>Un cookie est un petit fichier texte stocké sur votre appareil lors de la visite d'un site web. Il permet au site de se souvenir de vos actions et préférences.</p>

        <h3>2. Types de cookies utilisés</h3>
        <p><strong>2.1 Cookies essentiels (obligatoires) :</strong></p>
        <ul>
          <li>Gestion des sessions utilisateur</li>
          <li>Sécurité et prévention des fraudes</li>
          <li>Fonctionnement du formulaire de réservation</li>
        </ul>

        <p><strong>2.2 Cookies de performance :</strong></p>
        <ul>
          <li>Google Analytics (anonymisé)</li>
          <li>Mesure d'audience et statistiques</li>
          <li>Amélioration de l'expérience utilisateur</li>
        </ul>

        <p><strong>2.3 Cookies de géolocalisation :</strong></p>
        <ul>
          <li>Affichage de la carte interactive</li>
          <li>Autocomplétion des adresses</li>
          <li>Calcul d'itinéraires</li>
        </ul>

        <h3>3. Gestion de vos préférences</h3>
        <p>Vous pouvez à tout moment :</p>
        <ul>
          <li>Accepter ou refuser les cookies non-essentiels</li>
          <li>Modifier vos préférences via votre navigateur</li>
          <li>Supprimer les cookies existants</li>
        </ul>

        <h3>4. Durée de conservation</h3>
        <ul>
          <li><strong>Cookies essentiels :</strong> Durée de la session</li>
          <li><strong>Cookies de performance :</strong> 13 mois maximum</li>
          <li><strong>Consentement cookies :</strong> 13 mois</li>
        </ul>

        <h3>5. Partenaires tiers</h3>
        <p>Nos partenaires peuvent déposer des cookies :</p>
        <ul>
          <li><strong>OpenStreetMap :</strong> Affichage des cartes</li>
          <li><strong>Google Analytics :</strong> Statistiques (si accepté)</li>
        </ul>

        <h3>6. Paramétrage du navigateur</h3>
        <p>Vous pouvez configurer votre navigateur pour :</p>
        <ul>
          <li>Bloquer tous les cookies</li>
          <li>Être averti avant l'installation d'un cookie</li>
          <li>Supprimer les cookies à la fermeture</li>
        </ul>

        <h3>7. Impact du refus des cookies</h3>
        <p>Le refus des cookies peut limiter certaines fonctionnalités :</p>
        <ul>
          <li>Autocomplétion des adresses</li>
          <li>Mémorisation de vos préférences</li>
          <li>Optimisation de l'expérience utilisateur</li>
        </ul>

        <h3>8. Contact</h3>
        <p>Pour toute question relative aux cookies : <strong>cookies@instant-confort.fr</strong></p>
      `
    }
  };

  window.showLegalModal = function(type) {
    const modal = document.getElementById('legal-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    if (legalContent[type]) {
      title.textContent = legalContent[type].title;
      body.innerHTML = legalContent[type].content;
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeLegalModal = function() {
    document.getElementById('legal-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
  };

  // Close modal when clicking outside
  document.addEventListener('click', function(e) {
    const modal = document.getElementById('legal-modal');
    if (e.target === modal) {
      closeLegalModal();
    }
  });

  // Initialize cookie banner
  checkCookieConsent();
});