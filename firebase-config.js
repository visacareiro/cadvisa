// ═══════════════════════════════════════════════════════════════════════════
//  firebase-config.js — Módulo Central de Configuração Firebase
//  VISA Careiro — Cadastro Sanitário
//
//  Utilizado por: index.html · mobile.html · seed_usuarios.html
//
//  ⚠️  Altere APENAS este arquivo caso as credenciais do projeto mudem.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Credenciais do Projeto Firebase ────────────────────────────────────
  const firebaseConfig = {
  apiKey: "AIzaSyBq3R72sCbOiYfJ52xDFj2jLpRu0yhgYhI",
  authDomain: "cadvisa-667da.firebaseapp.com",
  projectId: "cadvisa-667da",
  storageBucket: "cadvisa-667da.firebasestorage.app",
  messagingSenderId: "369275850587",
  appId: "1:369275850587:web:88883e8a656371029e147e"
};

  // ── Inicializa o app evitando duplicidade ───────────────────────────────
  const _fbApp = firebase.apps.length
    ? firebase.apps[0]
    : firebase.initializeApp(firebaseConfig);

  const _db     = firebase.firestore(_fbApp);
  const _fbAuth = (typeof firebase.auth === 'function')
    ? firebase.auth(_fbApp)
    : null; // seed_usuarios.html não carrega firebase-auth-compat.js

  // ── Referências Firestore compartilhadas ────────────────────────────────
  const _STATE_REF    = _db.collection('visa_state').doc('app');
  const _BASE_REF     = _db.collection('visa_state').doc('base_data');
  const _INATIVOS_REF = _db.collection('visa_state').doc('inativos_data');
  const _USERS_REF    = _db.collection('visa_usuarios');

  // ── Expõe tudo no escopo global ─────────────────────────────────────────
  Object.assign(window, {
    _fbApp,
    _db,
    _fbAuth,
    _STATE_REF,
    _BASE_REF,
    _INATIVOS_REF,
    _USERS_REF,
  });

})(); 
