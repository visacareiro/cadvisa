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
  apiKey: "AIzaSyAhyxpNRHDrUrwzlEz6Oj8qu0QdXXPla64",
  authDomain: "visa-54770.firebaseapp.com",
  projectId: "visa-54770",
  storageBucket: "visa-54770.firebasestorage.app",
  messagingSenderId: "477249120108",
  appId: "1:477249120108:web:8b7e470d7d2e1f74cd7549"
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