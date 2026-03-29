import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';

// --- SILK WAVES COMPONENT ---
const SilkWaves = () => {
  return (
    <div className="silk-waves-container">
      <svg className="silk-wave-svg" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <motion.path
          d="M0,200 Q360,100 720,200 T1440,200 V400 H0 Z"
          fill="rgba(139, 92, 246, 0.15)"
          animate={{ d: ["M0,200 Q360,100 720,200 T1440,200 V400 H0 Z", "M0,200 Q360,300 720,200 T1440,200 V400 H0 Z", "M0,200 Q360,100 720,200 T1440,200 V400 H0 Z"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M0,250 Q360,150 720,250 T1440,250 V400 H0 Z"
          fill="rgba(236, 72, 153, 0.1)"
          animate={{ d: ["M0,250 Q360,150 720,250 T1440,250 V400 H0 Z", "M0,250 Q360,350 720,250 T1440,250 V400 H0 Z", "M0,250 Q360,150 720,250 T1440,250 V400 H0 Z"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </svg>
    </div>
  );
};

const AdvancedSilkWaves = () => (
  <div style={{ position: 'absolute', inset: 0, opacity: 0.35, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="wavesMask" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="focalMask">
          <rect width="1000" height="1000" fill="url(#wavesMask)" />
        </mask>
      </defs>
      <g mask="url(#focalMask)">
        {[...Array(3)].map((_, i) => (
          <motion.path
            key={i}
            animate={{
              d: [
                `M 0 ${500 + i * 40} Q 250 ${420 + i * 60} 500 ${500 + i * 40} T 1000 ${500 + i * 40}`,
                `M 0 ${500 + i * 40} Q 250 ${580 + i * 60} 500 ${500 + i * 40} T 1000 ${500 + i * 40}`,
                `M 0 ${500 + i * 40} Q 250 ${420 + i * 60} 500 ${500 + i * 40} T 1000 ${500 + i * 40}`,
              ],
              opacity: [0.08, 0.18, 0.08]
            }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            fill="none"
            stroke={i % 2 === 0 ? "var(--primary-neon)" : "var(--accent-blue)"}
            strokeWidth="120"
            strokeLinecap="round"
            filter="blur(140px)"
          />
        ))}
      </g>
    </svg>
  </div>
);

const GlowOrbs = () => (
  <>
    <div className="orb orb-purple" />
    <div className="orb orb-pink" />
    <div className="orb orb-blue" />
  </>
);

const SectionHeader = ({ label, title, subtitle }) => (
  <div style={{ textAlign: 'center', marginBottom: '80px' }}>
    <motion.span
      className="cyber-card-label"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {label}
    </motion.span>
    <motion.h2
      className="hero-h1"
      style={{ fontSize: '72px' }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {title}
    </motion.h2>
    {subtitle && <p className="hero-p" style={{ margin: '24px auto' }}>{subtitle}</p>}
  </div>
);

const TypewriterText = ({ text, color }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, 40);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setDisplayedText("");
        setIndex(0);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [index, text]);

  return (
    <div style={{ color, fontWeight: 700, position: 'relative', minHeight: '1.4em', display: 'flex', alignItems: 'center' }}>
      <span>{displayedText}</span>
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        style={{ borderLeft: `2px solid ${color}`, height: '1.2em', marginLeft: '6px', display: 'inline-block' }}
      />
    </div>
  );
};

const MiniWaveform = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', height: '24px', marginLeft: '12px', verticalAlign: 'middle' }}>
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        animate={{
          height: [4, 20, 4],
          opacity: [0.3, 1, 0.3]
        }}
        transition={{
          repeat: Infinity,
          duration: 0.8 + Math.random() * 0.4,
          delay: i * 0.1
        }}
        style={{ width: '2px', background: 'var(--primary-neon)', borderRadius: '10px' }}
      />
    ))}
  </div>
);

function App() {
  const [scrolled, setScrolled] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app-cyber-theme">
      <GlowOrbs />
      <AdvancedSilkWaves />

      <nav className={`nav-cyber ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="container nav-inner">
          <div className="nav-logo-cyber">
            <span className="logo-dot" />
            RhyMic
          </div>
          <div className="nav-links-cyber">
            <a href="#features">Features</a>
            <a href="#modes">Modes</a>
            <a href="#setup">Setup</a>
          </div>
          <div className="nav-actions">
            <a href="/extension.zip" download className="btn-neon-pill" style={{ textDecoration: 'none' }}>Install v1.0</a>
          </div>
        </div>
      </nav>

      <section className="hero-cyber">
        <div className="container" style={{ position: 'relative', zIndex: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="hero-h1">
              Speak directly <br />
              <span>into any field</span>
            </h1>
            <p className="hero-p">
              Turn speech into clean, ready-to-use text everywhere.
              Optimized for Indian languages with specialized Developer and Normal modes.
            </p>
            <motion.div
              style={{ marginBottom: '40px', display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '8px 20px', borderRadius: '100px', border: '1px solid var(--border-glass)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Global Hotkey</span>
              <code style={{ background: 'var(--primary-neon)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '14px', fontWeight: 700 }}>Ctrl + Shift + Space</code>
            </motion.div>
            <div style={{ marginTop: '20px' }}>
              <a href="/extension.zip" download className="btn-neon-pill" style={{ padding: '16px 48px', textDecoration: 'none', background: 'var(--primary-neon)', fontSize: '18px', display: 'inline-block' }}>
                Download Extension (.zip)
              </a>
            </div>
          </motion.div>
          <div className="mic-action-center">
            <motion.div
              className={`mic-sphere interactive ${isLive ? 'active' : ''}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsLive(!isLive)}
            >
              <div className="orb-dynamic" />
              <div className="orb-glass-shine" />
              <svg viewBox="0 0 24 24" width="48" height="48" fill="white" style={{ position: 'relative', zIndex: 10 }}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>
          </div>
        </div>
        <SilkWaves />
      </section>

      <section className="container" style={{ padding: '80px 0 120px' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <h2 className="hero-h1" style={{ fontSize: 'clamp(48px, 6vw, 84px)', fontWeight: 800 }}>
            <span style={{ borderBottom: '4px solid var(--primary-neon)', display: 'inline-block', lineHeight: '1' }}>5x faster</span> than typing
          </h2>
          <p className="hero-p" style={{ marginTop: '24px', maxWidth: '750px', margin: '24px auto 0', lineHeight: 1.6, opacity: 0.8 }}>
            After decades of using the same keyboard, voice that actually works is finally here.
            Speak naturally at the speed you think and let RhyMic handle the rest.
          </p>
          <div className="nav-actions" style={{ justifyContent: 'center', marginTop: '32px' }}>
            <a href="/extension.zip" download className="btn-neon-pill" style={{ padding: '16px 48px', textDecoration: 'none' }}>Download v1.0 Archive</a>
          </div>
        </div>
        <div className="cyber-cards-grid" style={{ gap: '20px' }}>
          <motion.div
            className="cyber-card"
            whileHover={{ y: -5 }}
            style={{ background: 'rgba(255, 255, 255, 0.02)', textAlign: 'center', padding: '60px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <span className="cyber-card-label" style={{ opacity: 0.5 }}>Standard Keyboard</span>
            <div style={{ fontSize: '96px', fontWeight: 900, letterSpacing: '-0.06em', marginBottom: '8px' }}>
              40 <small style={{ fontSize: '24px', opacity: 0.3, fontWeight: 500, marginLeft: '12px' }}>wpm</small>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>The average limit for physical typing.</p>
          </motion.div>
          <motion.div
            className="cyber-card"
            whileHover={{ y: -5 }}
            style={{
              background: 'rgba(139, 92, 246, 0.08)',
              borderColor: 'var(--primary-neon)',
              textAlign: 'center',
              padding: '60px 40px',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.15)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <span className="cyber-card-label" style={{ color: 'var(--primary-neon)' }}>RhyMic AI</span>
            <div style={{ fontSize: '96px', fontWeight: 900, letterSpacing: '-0.06em', marginBottom: '8px', color: 'var(--primary-neon)' }}>
              200 <small style={{ fontSize: '24px', opacity: 0.8, fontWeight: 500, marginLeft: '12px' }}>wpm</small>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Transcription at the speed of thought.</p>
          </motion.div>
        </div>
      </section>

      <section id="modes" className="container" style={{ padding: '120px 0' }}>
        <SectionHeader
          label="Workflow Optimization"
          title="Engineered for Context"
          subtitle="Choose between two specialized AI pipelines designed for your specific terminal or communication needs."
        />
        <div className="cyber-cards-grid">
          <motion.div className="cyber-card" whileHover={{ y: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <span className="cyber-card-label">Mode 01</span>
                <h3 className="cyber-card-title">Normal Mode</h3>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.3)' }}>COMMUNICATION</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Perfect for daily correspondence. Transcribes your natural voice with 99.9% punctuation accuracy while stripping away filler words and speech artifacts.</p>
            <ul style={{ margin: '24px 0', listStyle: 'none', padding: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
              <li style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-blue)' }}>✔</span> Smart Punctuation & Casing
              </li>
              <li style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-blue)' }}>✔</span> Filler Removal (um, ah, like)
              </li>
              <li style={{ marginBottom: '0px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-blue)' }}>✔</span> Optimized for Slack & Email
              </li>
            </ul>
            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(5,5,5,0.4)', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Drafting Output:</span>
              <p style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>"Hey team... um... let's hop on a call in ten minutes to discuss the new UI."</p>
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                <TypewriterText text="Hey team, let's hop on a call in 10 minutes to discuss the new UI." color="var(--accent-blue)" />
              </div>
            </div>
          </motion.div>
          <motion.div className="cyber-card" style={{ borderColor: 'var(--primary-neon)' }} whileHover={{ y: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <span className="cyber-card-label" style={{ color: 'var(--primary-neon)' }}>Mode 02</span>
                <h3 className="cyber-card-title">Developer Mode</h3>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', fontSize: '11px', color: 'var(--primary-neon)', fontWeight: 700, border: '1px solid rgba(139, 92, 246, 0.3)' }}>ENGINEERING</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Tailored for software engineers and prompt crafters. Converts unstructured verbal thoughts into structured, technical instructions for LLM interaction.</p>
            <ul style={{ margin: '24px 0', listStyle: 'none', padding: 0, fontSize: '14px', color: 'var(--text-primary)' }}>
              <li style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--primary-neon)' }}>✔</span> Technical Keyword Extraction
              </li>
              <li style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--primary-neon)' }}>✔</span> Concise Prompt Structuring
              </li>
              <li style={{ marginBottom: '0px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--primary-neon)' }}>✔</span> Optimized for VS Code & Terminals
              </li>
            </ul>
            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(5,5,5,0.4)', border: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Prompt Output:</span>
              <p style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>"Create a react component for a navbar with three links and a logo."</p>
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                <TypewriterText text="React navbar component: 3 links, 1 logo, styled with Tailwind." color="var(--primary-neon)" />
              </div>
            </div>
          </motion.div>
        </div>
        <div style={{ marginTop: '120px' }}>
          <SectionHeader label="Pipeline" title="How RhyMic Lives" />
          <div className="pipeline-grid">
            {[
              { step: "01", title: "Capture", desc: "Low-latency offscreen document initializes mic capture on hotkey trigger." },
              { step: "02", title: "Transcribe", desc: "Groq Whisper Large V3 processes audio in real-time with sub-200ms lag." },
              { step: "03", title: "Refine", desc: "Multi-pass Llama 3.3 scoring cleans syntax based on Mode selection." },
              { step: "04", title: "Inject", desc: "Final text is injected via DOM events into any active editable field." }
            ].map((p, i) => (
              <div key={i} className="cyber-card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '13px', color: 'var(--primary-neon)', fontWeight: 800, marginBottom: '16px' }}>{p.step}</div>
                <h4 style={{ marginBottom: '8px', fontSize: '18px' }}>{p.title}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="container" style={{ padding: '120px 0' }}>
        <SectionHeader label="Capability" title="The RhyMic Edge" />
        <div className="cyber-cards-grid grid-3-col">
          {[
            { title: "Multi Language", accent: "var(--primary-neon)", desc: "Native support for Tamil, Telugu, Hindi, Kannada, Malayalam, and more." },
            { title: "Universal Injection", accent: "var(--secondary-neon)", desc: "Works instantly in Gmail, Notion, Slack, WhatsApp, and VS Code." },
            { title: "Smart Analytics", accent: "var(--accent-blue)", desc: "Track words spoken today, weekly progress, and total time saved." },
            { title: "MV3 Secure", accent: "var(--accent-orange)", desc: "Built on Manifest V3 with offscreen recording for maximum performance." },
            { title: "Hotkey Control", accent: "#fff", desc: "Global Ctrl+Shift+Space triggers. Push-to-talk and Toggle supported." },
            { title: "AI Refinement", accent: "#8B5CF6", desc: "Multi-pass scoring via Groq Llama for peerless transcription accuracy." }
          ].map((f, i) => (
            <motion.div key={i} className="cyber-card" whileHover={{ y: -5 }} style={{ padding: '32px' }}>
              <div style={{ width: '32px', height: '3px', background: f.accent, marginBottom: '20px' }} />
              <h3 className="cyber-card-title" style={{ fontSize: '24px' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="setup" className="container" style={{ padding: '120px 0' }}>
        <SectionHeader
          label="Get Started"
          title="Install in Seconds"
          subtitle="Follow these 5 simple steps to get the power of RhyMic in your browser."
        />
        <div style={{ textAlign: 'center', marginBottom: '48px', marginTop: '-40px' }}>
          <a href="/extension.zip" download className="btn-neon-pill" style={{ padding: '12px 32px', textDecoration: 'none', borderColor: 'var(--primary-neon)', background: 'rgba(139, 92, 246, 0.1)' }}>
             Download zip Package
          </a>
        </div>
        <div className="setup-grid">
          {[
            {
              step: "01",
              title: "Open Extensions",
              desc: "Navigate to chrome://extensions in your Chrome browser.",
              icon: "🔌"
            },
            {
              step: "02",
              title: "Enable Dev Mode",
              desc: "Toggle the 'Developer mode' switch in the top right corner.",
              icon: "🛠️"
            },
            {
              step: "03",
              title: "Load Unpacked",
              desc: "Click 'Load unpacked' and select the folder where you extracted the zip (ensure it contains manifest.json).",
              icon: "📦"
            },
            {
              step: "04",
              title: "Pin RhyMic",
              desc: "Find RhyMic in your extensions menu and pin it for quick access.",
              icon: "📌"
            },
            {
              step: "05",
              title: "Add API Key",
              desc: "Open the popup and enter your Groq API Key to start transcribing.",
              icon: "🔑"
            }
          ].map((s, i) => (
            <motion.div
              key={i}
              className="cyber-card setup-step-card"
              whileHover={{ y: -5, borderColor: 'var(--primary-neon)' }}
            >
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '80px', opacity: 0.03, fontWeight: 900, pointerEvents: 'none' }}>
                {s.step}
              </div>
              <div style={{ fontSize: '32px', marginBottom: '24px' }}>{s.icon}</div>
              <div style={{ fontSize: '13px', color: 'var(--primary-neon)', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.1em' }}>STEP {s.step}</div>
              <h3 className="cyber-card-title" style={{ fontSize: '22px', marginBottom: '12px' }}>{s.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: '60px', textAlign: 'center' }}>
          <div style={{ padding: '24px', borderRadius: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'inline-block', maxWidth: '600px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--primary-neon)', fontWeight: 700 }}>Note:</span> Make sure you have a valid Groq API key. You can get one for free at <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>console.groq.com</a>.
            </p>
          </div>
        </div>
      </section>

      <footer className="cyber-footer">
        <div className="container">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>
            Made for <br />
            <a
              href="https://rhysetech.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                fontWeight: 800,
                background: 'linear-gradient(90deg, var(--primary-neon), var(--accent-blue), var(--primary-neon))',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'textGradientMove 4s linear infinite'
              }}
            >
              RHYSE TECH Developers

            </a>
            <style>
              {`
                @keyframes textGradientMove {
                  0% { background-position: 0% center; }
                  100% { background-position: 200% center; }
                }
              `}
            </style>
          </motion.h2>
          <div style={{ marginTop: '80px', color: 'var(--text-muted)', fontSize: '14px' }}>
            © 2026 RhyMic. All rights reserved.
            <br /> Built for Manifest V3. Internal RHYSETECH Project.
          </div>
        </div>
      </footer>
      <AnimatePresence>
        {isLive && (
          <motion.div
            className="live-status-pill"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
          >
            <span className="recording-dot" />
            <span style={{ fontWeight: 600 }}>VOICE CONTROL ACTIVE</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
