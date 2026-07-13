import { useState, useEffect, useCallback, useRef } from 'react';
import { Ticket, Lock, Plus, Trash2, Copy, Check, LogOut, Eye, EyeOff, X, Loader2, Gift, ExternalLink, Shield, Award, Flame, Youtube, Heart, Twitch } from 'lucide-react';
import { supabase } from './lib/supabase';

// Credenciales del admin (puedes cambiarlas)
const ADMIN_USER = 'byrol';
const ADMIN_PASS = 'byrol2026';

const STORAGE_KEY = 'byrol-sorteos';
const CLAIMS_KEY = 'byrol-claims';
const TWITCH_STATUS_KEY = 'byrol-twitch-status';
const FOG_STATUS_KEY = 'byrol-fog-status';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [view, setView] = useState('public');
  const [sorteos, setSorteos] = useState([]);
  const [claims, setClaims] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [revealed, setRevealed] = useState({});
  const [claimingId, setClaimingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [editing, setEditing] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCodes, setFormCodes] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  
  // Estados para controles
  const [isTwitchLive, setIsTwitchLive] = useState(false);
  const [loadingTwitch, setLoadingTwitch] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(true);

  // ============================================
  // FUNCIONES PARA SORTEOS
  // ============================================

  async function loadSorteos() {
    try {
      const { data, error } = await supabase
        .from('sorteos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error cargando sorteos:', error);
      return [];
    }
  }

  async function saveSorteo(sorteo) {
    try {
      const { data, error } = await supabase
        .from('sorteos')
        .upsert(sorteo, { onConflict: 'id' })
        .select();
      
      if (error) throw error;
      return data?.[0];
    } catch (error) {
      console.error('Error guardando sorteo:', error);
      throw error;
    }
  }

  async function deleteSorteo(id) {
    try {
      const { error } = await supabase
        .from('sorteos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error eliminando sorteo:', error);
      throw error;
    }
  }

  // ============================================
  // FUNCIONES PARA CÓDIGOS
  // ============================================

  async function claimCode(sorteoId, code) {
    try {
      const { data: existingClaim, error: claimError } = await supabase
        .from('claims')
        .select('*')
        .eq('sorteo_id', sorteoId)
        .eq('code', code)
        .maybeSingle();
      
      if (claimError) throw claimError;
      if (existingClaim) {
        throw new Error('Código ya canjeado');
      }
      
      const { data: newClaim, error: insertError } = await supabase
        .from('claims')
        .insert({
          id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sorteo_id: sorteoId,
          code: code
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newClaim;
    } catch (error) {
      console.error('Error canjeando código:', error);
      throw error;
    }
  }

  async function getClaims(sorteoId) {
    try {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('sorteo_id', sorteoId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error obteniendo canjes:', error);
      return [];
    }
  }

  // ============================================
  // LOAD DATA
  // ============================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const lista = await loadSorteos();
      setSorteos(lista);
      
      const allClaims = {};
      for (const sorteo of lista) {
        const claimsList = await getClaims(sorteo.id);
        if (claimsList.length > 0) {
          allClaims[sorteo.id] = claimsList[0].code;
        }
      }
      setClaims(allClaims);

      // Cargar estado de Twitch
      try {
        const twitchRes = await window.storage.get(TWITCH_STATUS_KEY, false);
        if (twitchRes) {
          const twitchData = JSON.parse(twitchRes.value);
          setIsTwitchLive(twitchData.live || false);
        }
      } catch {
        setIsTwitchLive(false);
      }

      // Cargar estado de la neblina
      try {
        const fogRes = await window.storage.get(FOG_STATUS_KEY, false);
        if (fogRes) {
          const fogData = JSON.parse(fogRes.value);
          setFogEnabled(fogData.enabled !== undefined ? fogData.enabled : true);
        }
      } catch {
        setFogEnabled(true);
      }
    } catch (e) {
      setError('No se pudieron cargar los sorteos.');
    } finally {
      setLoading(false);
      setLoadingTwitch(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================
  // MOUSE TRACKING
  // ============================================

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY
      });
    };

    const handleMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // ============================================
  // PERSISTENCIA
  // ============================================

  async function persistSorteos(next) {
    setSorteos(next);
    try {
      for (const sorteo of next) {
        await saveSorteo(sorteo);
      }
    } catch (e) {
      setError('No se pudo guardar.');
    }
  }

  async function persistClaims(next) {
    setClaims(next);
    try {
      await window.storage.set(CLAIMS_KEY, JSON.stringify(next), false);
    } catch {
      // no crítico
    }
  }

  async function persistTwitchStatus(live) {
    setIsTwitchLive(live);
    try {
      await window.storage.set(TWITCH_STATUS_KEY, JSON.stringify({ live }), false);
    } catch {
      setError('No se pudo guardar el estado de Twitch.');
    }
  }

  async function persistFogStatus(enabled) {
    setFogEnabled(enabled);
    try {
      await window.storage.set(FOG_STATUS_KEY, JSON.stringify({ enabled }), false);
    } catch {
      setError('No se pudo guardar el estado de la neblina.');
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  async function handleClaim(sorteo) {
    if (claimingId) return;
    if (claims[sorteo.id]) return;
    setClaimingId(sorteo.id);
    try {
      const codes = sorteo.codes || [];
      const claimedCodes = claims[sorteo.id] ? [claims[sorteo.id]] : [];
      
      let availableCode = null;
      for (const code of codes) {
        if (!claimedCodes.includes(code)) {
          availableCode = code;
          break;
        }
      }
      
      if (!availableCode) {
        setError('No hay códigos disponibles.');
        setClaimingId(null);
        return;
      }
      
      await claimCode(sorteo.id, availableCode);
      
      const nextClaims = { ...claims, [sorteo.id]: availableCode };
      setClaims(nextClaims);
      setRevealed((prev) => ({ ...prev, [sorteo.id]: availableCode }));
      
    } catch (e) {
      setError(e.message || 'No se pudo canjear el código.');
    } finally {
      setClaimingId(null);
    }
  }

  function handleCopy(code, id) {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleLogin(e) {
    e.preventDefault();
    if (loginUser === ADMIN_USER && loginPass === ADMIN_PASS) {
      setView('admin');
      setLoginError('');
      setLoginUser('');
      setLoginPass('');
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  }

  function openNew() {
    setEditing('new');
    setFormTitle('');
    setFormDesc('');
    setFormCodes('');
    setFormActive(true);
  }

  function openEdit(s) {
    setEditing(s.id);
    setFormTitle(s.title);
    setFormDesc(s.description);
    setFormCodes(s.codes.filter((c) => !c.claimed).map((c) => c.code).join('\n'));
    setFormActive(s.active);
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    setSaving(true);
    const newCodesList = formCodes.split('\n').map((c) => c.trim()).filter(Boolean);
    try {
      if (editing === 'new') {
        const sorteo = {
        id: uid(),
        title: formTitle.trim(),
        description: formDesc.trim(),
        active: formActive,
        created_at: new Date().toISOString(),  // ✅ Corregido: created_at
        codes: newCodesList,
      };
        await saveSorteo(sorteo);
        setSorteos([sorteo, ...sorteos]);
      } else {
        const next = sorteos.map((s) => {
          if (s.id !== editing) return s;
          const claimedCodes = s.codes.filter((c) => c.claimed);
          const unclaimedCodes = newCodesList.map((code) => ({ code, claimed: false }));
          return { ...s, title: formTitle.trim(), description: formDesc.trim(), active: formActive, codes: [...claimedCodes, ...unclaimedCodes] };
        });
        await persistSorteos(next);
      }
      setEditing(null);
    } catch (e) {
      setError('No se pudo guardar el sorteo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSorteo(id);
      const next = sorteos.filter((s) => s.id !== id);
      setSorteos(next);
    } catch (e) {
      setError('No se pudo eliminar el sorteo.');
    }
  }

  async function toggleActive(s) {
    const next = sorteos.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x));
    await persistSorteos(next);
  }

  const publicSorteos = sorteos.filter((s) => s.active);

  // ============================================
  // PATROCINADORES
  // ============================================

  const sponsors = [
    {
      id: 'keydrop',
      name: 'KeyDrop',
      url: 'https://kd.link/?code=XROLX',
      logo: '/logos/keydrop.webp',
      color: '#FF6B00',
      description: 'Consigue tus skins favoritas'
    },
    {
      id: 'casehug',
      name: 'CaseHug',
      url: 'https://casehug.com/r/XBYROLX',
      logo: '/logos/casehug.webp',
      color: '#4F46E5',
      description: 'Abre cajas con las mejores skins'
    }
  ];

  const mouseX = mousePos.x;
  const mouseY = mousePos.y;

  const SponsorsSection = () => (
    <div className="sponsors-container">
      <div className="w-full">
        <p className="sponsors-title">🌟 Patrocinadores</p>
        <div className="flex gap-3 flex-wrap">
          {sponsors.map((sponsor) => (
            <a
              key={sponsor.id}
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sponsor-button"
            >
              <span className="sponsor-badge">★</span>
              
              <img 
                src={sponsor.logo} 
                alt={sponsor.name}
                className="sponsor-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const parent = e.target.parentElement;
                  const fallback = document.createElement('span');
                  fallback.textContent = sponsor.name.charAt(0);
                  fallback.style.cssText = `
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: ${sponsor.color}33;
                    border-radius: 8px;
                    font-size: 20px;
                    font-weight: 700;
                    color: ${sponsor.color};
                    flex-shrink: 0;
                  `;
                  parent.insertBefore(fallback, e.target);
                }}
              />
              
              <div className="sponsor-info">
                <span className="sponsor-name">{sponsor.name}</span>
                <span className="sponsor-desc">{sponsor.description}</span>
              </div>
              
              <ExternalLink size={16} className="sponsor-arrow" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================
  // FOOTER
  // ============================================

  const Footer = () => (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="flex items-center gap-2 mb-3">
            <span className="footer-logo">BYROL</span>
            <span className="footer-badge">CS2</span>
          </div>
          <p className="footer-desc">
            Códigos exclusivos para sorteos y promociones de Counter-Strike 2.
          </p>
        </div>

        <div className="footer-section footer-social">
          <p className="footer-social-title">📺 Sígueme en</p>
          <a
            href="https://www.youtube.com/@xbyrolx"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social-link youtube"
          >
            <div className="footer-social-icon-wrapper">
              <Youtube size={18} />
            </div>
            <span>@xbyrolx</span>
            <ExternalLink size={14} className="footer-social-arrow" />
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-divider"></div>
        <p className="footer-copy">
          © {new Date().getFullYear()} XBYROL. Todos los derechos reservados.
          <Heart size={12} className="footer-heart" />
        </p>
      </div>
    </footer>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --bg: #0a0a0f;
          --surface: rgba(20, 20, 35, 0.9);
          --surface-2: #1a1a2e;
          --gold: #FFD700;
          --gold-dark: #C9A800;
          --teal: #33B7A0;
          --coral: #FF6B5B;
          --text: #F5EFE6;
          --text-muted: #8a8a9a;
          --font-display: 'Space Grotesk', sans-serif;
          --font-body: 'IBM Plex Sans', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
          --cs-gradient: linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #0a0a0f 100%);
        }

        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100vh;
          background: var(--bg);
        }

        #root {
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .app-container {
          width: 100%;
          min-height: 100vh;
          color: var(--text);
          font-family: var(--font-body);
          position: relative;
          overflow: hidden;
          background: var(--bg);
        }

        .background-with-light {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          background: var(--cs-gradient);
        }

        .cs-background {
          position: absolute;
          inset: 0;
          background-image: url('/logos/fondocs2.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.2;
          filter: blur(1px);
          z-index: 1;
        }

        .cs-background-overlay {
          position: absolute;
          inset: 0;
          background: 
            linear-gradient(135deg, rgba(12, 12, 37, 0.7), rgba(26, 10, 46, 0.7)),
            url('/logos/fondocs2.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.4;
          z-index: 2;
        }

        .cs-fog {
          position: absolute;
          inset: 0;
          z-index: 3;
          background: 
            radial-gradient(ellipse at 20% 80%, rgba(255, 215, 0, 0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(255, 200, 100, 0.02) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(255, 215, 0, 0.02) 0%, transparent 60%);
          pointer-events: none;
        }

        .cs-fog-animated {
          position: absolute;
          inset: 0;
          z-index: 4;
          background: 
            radial-gradient(ellipse at 30% 60%, rgba(255, 215, 0, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 30%, rgba(255, 200, 100, 0.03) 0%, transparent 40%);
          animation: fogMove 30s ease-in-out infinite alternate;
          pointer-events: none;
        }

        @keyframes fogMove {
          0% { transform: scale(1) translate(0, 0); opacity: 0.6; }
          50% { transform: scale(1.1) translate(20px, -10px); opacity: 1; }
          100% { transform: scale(0.9) translate(-20px, 10px); opacity: 0.7; }
        }

        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(150px);
          opacity: 0.015;
          animation: orbFloat 25s ease-in-out infinite;
          will-change: transform;
          z-index: 0;
        }

        .bg-orb:nth-child(1) {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #FFD700, transparent 70%);
          top: -20%;
          left: -20%;
          animation-delay: 0s;
          animation-duration: 30s;
        }

        .bg-orb:nth-child(2) {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, #33B7A0, transparent 70%);
          bottom: -20%;
          right: -20%;
          animation-delay: -8s;
          animation-duration: 35s;
        }

        .bg-orb:nth-child(3) {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, #FF6B5B, transparent 70%);
          top: 60%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -15s;
          animation-duration: 40s;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(50px, -50px) scale(1.1); }
          50% { transform: translate(-40px, 40px) scale(0.9); }
          75% { transform: translate(30px, -30px) scale(1.05); }
        }

        .mouse-light {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle 400px at ${mouseX}px ${mouseY}px,
            rgba(255, 215, 0, 0.06) 0%,
            rgba(255, 215, 0, 0.02) 30%,
            rgba(51, 183, 160, 0.01) 50%,
            transparent 70%
          );
          transition: background 0.05s ease-out;
          will-change: transform, background;
          pointer-events: none;
          z-index: 5;
        }

        .mouse-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle 80px at ${mouseX}px ${mouseY}px,
            rgba(255, 215, 0, 0.08) 0%,
            transparent 70%
          );
          transition: background 0.05s ease-out;
          will-change: transform, background;
          pointer-events: none;
          z-index: 5;
          mix-blend-mode: screen;
        }

        .content-wrapper {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        header {
          border-bottom: 1px solid rgba(255, 215, 0, 0.08);
          background: rgba(10, 10, 15, 0.6);
          backdrop-filter: blur(20px);
          border-radius: 0 0 16px 16px;
          margin: 0 -20px;
          padding: 14px 28px !important;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: all 0.3s ease;
        }

        header:hover {
          background: rgba(10, 10, 15, 0.8);
          border-bottom-color: rgba(255, 215, 0, 0.15);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-text {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 22px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
          text-decoration: none;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: rgba(51, 183, 160, 0.12);
          color: #33B7A0;
          border: 1px solid rgba(51, 183, 160, 0.15);
        }

        .header-badge .shield-icon {
          width: 10px;
          height: 10px;
        }

        .header-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 215, 0, 0.1);
        }

        .header-tagline {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 400;
          display: none;
        }

        .twitch-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px 6px 10px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--text-muted);
          text-decoration: none;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .twitch-button:hover {
          background: rgba(145, 70, 255, 0.08);
          border-color: rgba(145, 70, 255, 0.2);
          color: var(--text);
          transform: translateY(-1px);
        }

        .twitch-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9146FF;
          transition: background 0.3s ease;
          flex-shrink: 0;
        }

        .twitch-button.live .twitch-status-dot {
          background: #FF0000;
          box-shadow: 0 0 12px rgba(255, 0, 0, 0.4);
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        .twitch-button.live {
          border-color: rgba(255, 0, 0, 0.2);
          background: rgba(255, 0, 0, 0.05);
        }

        .twitch-button.live:hover {
          background: rgba(255, 0, 0, 0.1);
          border-color: rgba(255, 0, 0, 0.3);
        }

        .twitch-button .twitch-label {
          display: inline;
        }

        .twitch-button.live .twitch-label {
          color: #FF0000;
        }

        .twitch-button .twitch-live-badge {
          display: none;
          font-size: 8px;
          background: #FF0000;
          color: white;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .twitch-button.live .twitch-live-badge {
          display: inline;
        }

        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }

        .nav-tab { 
          font-family: var(--font-display);
          font-weight: 600;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.06em;
          padding: 8px 0;
        }
        
        .nav-tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, #FFD700, #FFA500);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }
        
        .nav-tab.active::after {
          transform: scaleX(1);
        }
        
        .nav-tab.active {
          color: #FFD700;
        }
        
        .nav-tab:hover:not(.active) {
          color: var(--text);
        }

        .ticket-card { 
          background: var(--surface);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 215, 0, 0.08);
          border-radius: 12px;
          position: relative;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .ticket-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 12px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), transparent 50%, rgba(255, 215, 0, 0.05));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        
        .ticket-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 40px rgba(255, 215, 0, 0.08);
          border-color: rgba(255, 215, 0, 0.2);
        }
        
        .ticket-card::after { 
          content: ''; 
          position: absolute; 
          width: 18px; 
          height: 18px; 
          background: var(--bg); 
          border-radius: 50%; 
          top: 50%; 
          transform: translateY(-50%); 
          right: -9px;
          border: 1px solid rgba(255, 215, 0, 0.05);
        }

        .admin-panel-title {
          font-family: var(--font-display);
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .cs-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: rgba(255, 215, 0, 0.15);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.2);
        }

        .cs-badge-green {
          background: rgba(51, 183, 160, 0.15);
          color: #33B7A0;
          border-color: rgba(51, 183, 160, 0.2);
        }

        .btn-primary { 
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #0a0a0f;
          font-family: var(--font-display);
          font-weight: 700;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          border: none;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 13px;
        }
        
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .btn-primary:hover:not(:disabled)::before {
          opacity: 1;
        }
        
        .btn-primary:hover:not(:disabled) { 
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 215, 0, 0.3);
        }
        
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .input-field { 
          background: rgba(10, 10, 15, 0.8);
          border: 1px solid rgba(255, 215, 0, 0.1);
          color: var(--text);
          border-radius: 8px;
          transition: all 0.3s ease;
          font-family: var(--font-body);
        }
        
        .input-field:focus { 
          outline: none;
          border-color: #FFD700;
          box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.1);
        }

        .twitch-admin-control {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(10, 10, 15, 0.5);
          border-radius: 10px;
          border: 1px solid rgba(255, 215, 0, 0.06);
        }

        .twitch-admin-control .twitch-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #9146FF;
          transition: all 0.3s ease;
        }

        .twitch-admin-control .twitch-dot.live {
          background: #FF0000;
          box-shadow: 0 0 16px rgba(255, 0, 0, 0.3);
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        .twitch-toggle-btn {
          padding: 4px 16px;
          border-radius: 8px;
          border: none;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .twitch-toggle-btn.activate {
          background: #FF0000;
          color: white;
        }

        .twitch-toggle-btn.activate:hover {
          background: #cc0000;
          transform: scale(1.02);
        }

        .twitch-toggle-btn.deactivate {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
        }

        .twitch-toggle-btn.deactivate:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(1.02);
        }

        .twitch-status-text {
          font-size: 12px;
          color: var(--text-muted);
        }

        .twitch-status-text .live-text {
          color: #FF0000;
          font-weight: 600;
        }

        .twitch-status-text .offline-text {
          color: #9146FF;
          font-weight: 600;
        }

        .sponsor-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          border-radius: 10px;
          border: 1px solid rgba(255, 215, 0, 0.08);
          background: var(--surface);
          backdrop-filter: blur(12px);
          color: var(--text);
          font-family: var(--font-display);
          font-weight: 600;
          transition: all 0.3s ease;
          cursor: pointer;
          text-decoration: none;
          position: relative;
          overflow: hidden;
          flex: 1;
          min-width: 140px;
        }

        .sponsor-button::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.05), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .sponsor-button:hover::before {
          opacity: 1;
        }

        .sponsor-button:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 215, 0, 0.3);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        }

        .sponsor-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px;
        }

        .sponsor-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #0a0a0f;
          font-size: 8px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sponsors-container {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
          padding: 20px 0 12px 0;
          border-top: 1px solid rgba(255, 215, 0, 0.06);
        }

        .sponsors-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 8px;
          font-weight: 600;
        }

        .stock-bar-track { 
          background: rgba(255, 215, 0, 0.05);
          border-radius: 999px; 
          overflow: hidden; 
          border: 1px solid rgba(255, 215, 0, 0.05);
        }
        
        .stock-bar-fill { 
          background: linear-gradient(90deg, #FFD700, #FFA500);
          height: 100%; 
          transition: width 0.6s ease;
          position: relative;
        }
        
        .stock-bar-fill.low { 
          background: linear-gradient(90deg, #FF6B5B, #FF4444);
        }

        .footer {
          margin-top: auto;
          padding: 24px 0 12px 0;
          background: rgba(10, 10, 15, 0.4);
          backdrop-filter: blur(10px);
          border-radius: 16px 16px 0 0;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          padding: 0 20px 16px 20px;
        }

        .footer-section {
          display: flex;
          flex-direction: column;
        }

        .footer-logo {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.02em;
        }

        .footer-badge {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 1px 8px;
          border-radius: 12px;
          background: rgba(51, 183, 160, 0.12);
          color: #33B7A0;
          border: 1px solid rgba(51, 183, 160, 0.15);
        }

        .footer-desc {
          font-size: 12px;
          color: var(--text-muted);
          max-width: 280px;
          line-height: 1.5;
        }

        .footer-social-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .footer-social-link {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 16px 6px 12px;
          border-radius: 10px;
          background: rgba(255, 0, 0, 0.06);
          border: 1px solid rgba(255, 0, 0, 0.1);
          color: #FF0000;
          text-decoration: none;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.3s ease;
          font-family: var(--font-display);
        }

        .footer-social-link:hover {
          transform: translateY(-2px);
          background: rgba(255, 0, 0, 0.12);
          border-color: rgba(255, 0, 0, 0.25);
          box-shadow: 0 6px 20px rgba(255, 0, 0, 0.12);
        }

        .footer-social-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .footer-social-arrow {
          opacity: 0.4;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .footer-social-link:hover .footer-social-arrow {
          opacity: 1;
          transform: translateX(2px);
        }

        .footer-bottom {
          padding: 12px 20px 0 20px;
        }

        .footer-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.08), transparent);
          margin-bottom: 12px;
        }

        .footer-copy {
          font-size: 11px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .footer-heart {
          color: #FF6B5B;
          animation: heartbeat 1.5s ease-in-out infinite;
          display: inline-block;
        }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.2); }
          50% { transform: scale(1); }
          75% { transform: scale(1.1); }
        }

        .footer-heart:hover {
          animation-play-state: paused;
        }

        .fade-in {
          animation: fadeIn 0.5s ease forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .slide-up {
          animation: slideUp 0.4s ease forwards;
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .glow-text {
          text-shadow: 0 0 40px rgba(255, 215, 0, 0.1);
        }

        @media (max-width: 640px) {
          .content-wrapper {
            padding: 0 12px;
          }
          header {
            margin: 0 -12px;
            padding: 12px 16px !important;
          }
          .ticket-card::after {
            display: none;
          }
          .sponsor-button {
            padding: 10px 14px;
            min-width: 120px;
            flex: 1 1 100%;
          }
          .sponsor-logo {
            width: 32px;
            height: 32px;
          }
          .sponsor-name {
            font-size: 12px;
          }
          .sponsor-desc {
            font-size: 10px;
          }
          .logo-text {
            font-size: 18px;
          }
          .header-tagline {
            display: none;
          }
          .header-divider {
            display: none;
          }
          .twitch-button .twitch-label {
            display: none;
          }
          .twitch-button {
            padding: 6px 10px;
          }

          .footer-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 16px;
            padding: 0 12px 16px 12px;
          }
          .footer-desc {
            max-width: 100%;
          }
          .footer-social-link {
            justify-content: center;
          }
          .footer-section {
            align-items: center;
          }
          .twitch-admin-control {
            flex-wrap: wrap;
            justify-content: center;
          }
        }

        @media (min-width: 768px) {
          .header-tagline {
            display: inline;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-orb, .cs-fog-animated, .btn-primary, .stock-bar-fill, .nav-tab, .ticket-card, .sponsor-button, .footer-heart, .twitch-button.live .twitch-status-dot {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div className="background-with-light">
        <div className="cs-background"></div>
        <div className="cs-background-overlay"></div>
        {fogEnabled && <div className="cs-fog"></div>}
        {fogEnabled && <div className="cs-fog-animated"></div>}
        <div className="bg-orb"></div>
        <div className="bg-orb"></div>
        <div className="bg-orb"></div>
        <div className="mouse-light"></div>
        <div className="mouse-glow"></div>
      </div>

      <div className="content-wrapper">
        <header className="flex items-center justify-between">
          <div className="header-left">
            <span className="logo-text">BYROL</span>
            <span className="header-badge">
              <Shield size={10} className="shield-icon" /> CS2
            </span>
            <span className="header-divider"></span>
            <span className="header-tagline">Códigos exclusivos</span>
          </div>
          <nav className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setView('public')} className={`nav-tab ${view === 'public' ? 'active' : ''}`}>
              Sorteos
            </button>
            <button onClick={() => setView(view === 'admin' ? 'admin' : 'login')} className={`nav-tab flex items-center gap-1 ${view === 'admin' || view === 'login' ? 'active' : ''}`}>
              <Lock size={11} /> Admin
            </button>
            
            <a
              href="https://www.twitch.tv/xbyrolx"
              target="_blank"
              rel="noopener noreferrer"
              className={`twitch-button ${isTwitchLive ? 'live' : ''}`}
            >
              <div className="twitch-status-dot"></div>
              <span className="twitch-label">
                {isTwitchLive ? 'EN DIRECTO' : 'Twitch'}
              </span>
              <span className="twitch-live-badge">LIVE</span>
            </a>
          </nav>
        </header>

        {error && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(255, 107, 91, 0.1)', border: '1px solid rgba(255, 107, 91, 0.2)', color: 'var(--coral)' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1">
          {view === 'public' && (
            <div className="px-4 py-8 fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Flame size={20} color="#FFD700" />
                <p className="text-xs tracking-widest uppercase" style={{ color: '#FFD700' }}>Sorteos activos</p>
              </div>
              <h1 className="byrol-display text-3xl mb-2 glow-text" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Canjea tu <span style={{ color: '#FFD700' }}>código</span>
              </h1>
              <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
                Consigue tus códigos exclusivos y canjéalos en las mejores plataformas
              </p>
              
              {loading ? (
                <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={18} /> Cargando sorteos…
                </div>
              ) : (
                <>
                  {publicSorteos.length === 0 ? (
                    <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                      <Ticket size={48} className="mx-auto mb-4" style={{ opacity: 0.3 }} />
                      <p className="text-lg font-semibold">No hay sorteos activos</p>
                      <p className="text-sm mt-1">Vuelve a pasarte pronto para conseguir códigos exclusivos</p>
                    </div>
                  ) : (
                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                      {publicSorteos.map((s, index) => {
                        const total = s.codes?.length || 0;
                        const remaining = s.codes?.filter((c) => !c.claimed)?.length || 0;
                        const pct = total ? (remaining / total) * 100 : 0;
                        const claimedCode = claims[s.id] || revealed[s.id];
                        const soldOut = remaining === 0 && !claimedCode;
                        return (
                          <div key={s.id} className="ticket-card p-5 flex flex-col gap-3 slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                            <div>
                              <h3 className="byrol-display text-lg font-bold mb-1">{s.title}</h3>
                              {s.description && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                <span>Disponibles</span>
                                <span className="byrol-mono font-bold">{remaining}/{total}</span>
                              </div>
                              <div className="stock-bar-track h-1.5">
                                <div className={`stock-bar-fill ${pct < 20 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <div className="stub-divider pl-4 mt-1" style={{ borderLeftColor: 'rgba(255,215,0,0.1)' }}>
                              {claimedCode ? (
                                <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(10,10,15,0.5)', border: '1px solid rgba(255,215,0,0.1)' }}>
                                  <span className="byrol-mono text-sm font-bold truncate" style={{ color: '#FFD700' }}>{claimedCode}</span>
                                  <button onClick={() => handleCopy(claimedCode, s.id)} className="shrink-0 p-1.5 rounded-md" style={{ background: 'rgba(255,215,0,0.1)' }} aria-label="Copiar código">
                                    {copiedId === s.id ? <Check size={14} color="#33B7A0" /> : <Copy size={14} color="#FFD700" />}
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => handleClaim(s)} disabled={soldOut || claimingId === s.id} className="btn-primary w-full py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                                  {claimingId === s.id ? <Loader2 size={15} className="animate-spin" /> : <Ticket size={15} />}
                                  {soldOut ? 'Agotado' : claimingId === s.id ? 'Canjeando…' : 'Canjear código'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <SponsorsSection />
                </>
              )}
            </div>
          )}

          {view === 'login' && (
            <div className="px-4 py-16 max-w-sm mx-auto fade-in">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <Lock size={28} color="#FFD700" />
                </div>
                <h2 className="byrol-display text-2xl font-bold" style={{ color: '#FFD700' }}>Acceso admin</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Introduce tus credenciales para gestionar sorteos</p>
              </div>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <input className="input-field px-4 py-3 text-sm" placeholder="Usuario" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} autoFocus />
                <div className="relative">
                  <input className="input-field px-4 py-3 text-sm w-full" type={showPass ? 'text' : 'password'} placeholder="Contraseña" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-label="Mostrar contraseña">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {loginError && <p className="text-sm" style={{ color: 'var(--coral)' }}>{loginError}</p>}
                <button type="submit" className="btn-primary py-3 rounded-lg text-sm mt-2">Entrar al panel</button>
              </form>
            </div>
          )}

          {view === 'admin' && (
            <div className="px-4 py-8 fade-in">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="admin-panel-title byrol-display text-2xl font-bold">Panel de sorteos</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Gestiona todos tus sorteos de CS2</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={openNew} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <Plus size={16} /> Nuevo sorteo
                  </button>
                  <button onClick={() => setView('public')} className="text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,215,0,0.05)' }}>
                    <LogOut size={14} /> Salir
                  </button>
                </div>
              </div>

              <div className="ticket-card p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Twitch size={20} color={isTwitchLive ? '#FF0000' : '#9146FF'} />
                    <div>
                      <h4 className="text-sm font-bold">Estado de Twitch</h4>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {isTwitchLive ? (
                          <span className="live-text">🔴 En directo</span>
                        ) : (
                          <span className="offline-text">⚫ Offline</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => persistTwitchStatus(!isTwitchLive)}
                    className={`twitch-toggle-btn ${isTwitchLive ? 'deactivate' : 'activate'}`}
                  >
                    {isTwitchLive ? 'Marcar como offline' : 'Marcar como en directo'}
                  </button>
                </div>
              </div>

              <div className="ticket-card p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,215,0,0.1)' }}>
                      🌫️
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">Neblina de fondo</h4>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {fogEnabled ? '🟢 Activada' : '⚪ Desactivada'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => persistFogStatus(!fogEnabled)}
                    className={`twitch-toggle-btn ${fogEnabled ? 'deactivate' : 'activate'}`}
                  >
                    {fogEnabled ? 'Desactivar neblina' : 'Activar neblina'}
                  </button>
                </div>
              </div>

              {editing && (
                <div className="ticket-card p-5 mb-6 slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="byrol-display text-base font-bold" style={{ color: '#FFD700' }}>
                      {editing === 'new' ? '✨ Nuevo sorteo' : '✏️ Editar sorteo'}
                    </h3>
                    <button onClick={() => setEditing(null)} aria-label="Cerrar"><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input className="input-field px-3 py-2 text-sm" placeholder="Título del sorteo" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                    <textarea className="input-field px-3 py-2 text-sm" rows={2} placeholder="Descripción (opcional)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                    <textarea className="input-field px-3 py-2 text-sm byrol-mono" rows={6} placeholder={'Un código por línea\nEJ: BYROL-ABC123\nBYROL-XYZ789'} value={formCodes} onChange={(e) => setFormCodes(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} /> Sorteo activo (visible al público)
                    </label>
                    <button onClick={handleSave} disabled={saving || !formTitle.trim()} className="btn-primary py-2.5 rounded-lg text-sm">
                      {saving ? 'Guardando…' : 'Guardar sorteo'}
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>
              ) : sorteos.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <Award size={48} className="mx-auto mb-4" style={{ opacity: 0.3 }} />
                  <p className="text-lg">No hay sorteos creados</p>
                  <p className="text-sm mt-1">Haz clic en "Nuevo sorteo" para empezar</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {sorteos.map((s) => {
                    const total = s.codes?.length || 0;
                    const claimed = s.codes?.filter((c) => c.claimed)?.length || 0;
                    const remaining = total - claimed;
                    return (
                      <div key={s.id} className="ticket-card p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="byrol-display text-sm font-bold">{s.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'cs-badge cs-badge-green' : 'cs-badge'}`}>
                              {s.active ? 'Activo' : 'Oculto'}
                            </span>
                          </div>
                          <p className="text-xs byrol-mono" style={{ color: 'var(--text-muted)' }}>{remaining}/{total} códigos disponibles</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleActive(s)} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'rgba(255,215,0,0.05)', color: 'var(--text)', border: '1px solid rgba(255,215,0,0.1)' }}>
                            {s.active ? 'Ocultar' : 'Activar'}
                          </button>
                          <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'rgba(255,215,0,0.05)', color: 'var(--text)', border: '1px solid rgba(255,215,0,0.1)' }}>
                            Editar
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-md" style={{ background: 'rgba(255,107,91,0.1)', border: '1px solid rgba(255,107,91,0.1)' }} aria-label="Eliminar">
                            <Trash2 size={14} color="var(--coral)" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}