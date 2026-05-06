import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// Scroll animation hook
const useScrollReveal = () => {
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = ref.current?.querySelectorAll('.landing-fade-up');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return ref;
};

// Typing effect hook
const useTypingEffect = (words, speed = 100, pause = 2000) => {
  const [text, setText] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIdx];
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, charIdx + 1));
        if (charIdx + 1 === current.length) {
          setTimeout(() => setDeleting(true), pause);
        } else {
          setCharIdx(charIdx + 1);
        }
      } else {
        setText(current.slice(0, charIdx));
        if (charIdx === 0) {
          setDeleting(false);
          setWordIdx((wordIdx + 1) % words.length);
        } else {
          setCharIdx(charIdx - 1);
        }
      }
    }, deleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return text;
};

// Animated counter
const AnimatedCounter = ({ target, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const num = parseInt(target.replace(/[^0-9]/g, '')) || 0;
        const duration = 1800;
        const steps = 40;
        const increment = num / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= num) { setCount(num); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const display = target.includes('/')
    ? target
    : target.includes('%')
    ? `${count}%`
    : `${count >= 1000 ? Math.floor(count / 1000) + 'K' : count}+`;

  return <span ref={ref}>{display}{suffix}</span>;
};

// FAQ Item
const FAQItem = ({ question, answer, idx }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="landing-faq-item">
      <button className="landing-faq-question" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <span className={`material-symbols-outlined landing-faq-icon ${open ? 'open' : ''}`}>add</span>
      </button>
      <div className={`landing-faq-answer ${open ? 'open' : ''}`}>{answer}</div>
    </div>
  );
};

const FEATURES = [
  { icon: 'smart_toy', title: 'AI Tutor Chat', desc: 'Chat with your documents. Get instant, accurate answers powered by RAG — your personal AI study buddy.', color: '#0ea5e9' },
  { icon: 'quiz', title: 'Smart Quizzes', desc: 'Auto-generate quizzes from your materials. Track performance and identify weak areas instantly.', color: '#8b5cf6' },
  { icon: 'style', title: 'Flashcards & Spaced Rep', desc: 'Convert notes to flashcards instantly. Built-in spaced repetition maximizes long-term retention.', color: '#10b981' },
  { icon: 'headphones', title: 'Audio Podcasts', desc: 'Turn boring PDFs into engaging audio podcasts. Study while commuting or exercising.', color: '#f59e0b' },
  { icon: 'hub', title: 'Mind Maps', desc: 'Visualize connections between concepts with AI-generated mind maps for complex subjects.', color: '#ec4899' },
  { icon: 'analytics', title: 'Progress Tracking', desc: 'Streaks, heatmaps, and detailed reports. Visualize your learning journey and stay motivated.', color: '#6366f1' },
];

const TESTIMONIALS = [
  { name: 'Arjun Mehta', role: 'Engineering Student', text: "Shiro.ai completely changed how I prepare for exams. The AI quizzes helped me score 40% higher in my finals.", initials: 'AM' },
  { name: 'Priya Sharma', role: 'Medical Student', text: "The flashcard system with spaced repetition is incredible. I retained 3x more anatomy terms compared to traditional methods.", initials: 'PS' },
  { name: 'Rahul Desai', role: 'UPSC Aspirant', text: "Mind maps and audio podcasts are game-changers. I study during my commute and visualize complex topics effortlessly.", initials: 'RD' },
];

const FAQS = [
  { q: 'What file formats does Shiro.ai support?', a: 'Shiro.ai supports PDF, DOCX, TXT files and images. Simply upload your study materials and our AI processes them instantly.' },
  { q: 'Is my data secure and private?', a: 'Absolutely. All your documents are encrypted and stored securely. We never share your data with third parties.' },
  { q: 'Can I use Shiro.ai for free?', a: 'Yes! Shiro.ai offers a generous free tier with access to all core features. Premium plans unlock advanced analytics and unlimited storage.' },
  { q: 'How does the AI tutor work?', a: 'Our AI uses Retrieval-Augmented Generation (RAG) to answer questions based exclusively on your uploaded materials, ensuring accurate and relevant responses.' },
  { q: 'Does it work for all subjects?', a: 'Yes — from engineering and medicine to humanities and competitive exams. Shiro.ai adapts to any study material you upload.' },
];

const MARQUEE_ITEMS = [
  { icon: 'description', text: 'PDF Processing' },
  { icon: 'smart_toy', text: 'AI Chat' },
  { icon: 'quiz', text: 'Auto Quizzes' },
  { icon: 'style', text: 'Flashcards' },
  { icon: 'hub', text: 'Mind Maps' },
  { icon: 'headphones', text: 'Audio Podcasts' },
  { icon: 'analytics', text: 'Analytics' },
  { icon: 'local_fire_department', text: 'Streaks' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useScrollReveal();
  const typedWord = useTypingEffect(['Smarter', 'Faster', 'Better'], 90, 2200);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="landing-page">
      {/* Background effects */}
      <div className="landing-grid-bg" />
      <div className="landing-glow-1" />
      <div className="landing-glow-2" />

      {/* ===== NAVBAR ===== */}
      <div className={`landing-nav-wrapper ${scrolled ? 'scrolled' : ''}`}>
        <nav className="landing-nav">
          <div className="landing-nav-logo" onClick={() => scrollToSection('hero')}>
            <div className="landing-logo-circle">
              <img src="/logo.jpg" alt="Shiro.ai" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span className="landing-logo-text">Shiro.ai</span>
          </div>

          <div className="landing-nav-center">
            <ul className="landing-nav-links">
              <li><a onClick={() => scrollToSection('features')}>Features</a></li>
              <li><a onClick={() => scrollToSection('how-it-works')}>How it Works</a></li>
              <li><a onClick={() => scrollToSection('testimonials')}>Reviews</a></li>
              <li><a onClick={() => scrollToSection('faq')}>FAQ</a></li>
            </ul>
          </div>

          <div className="landing-nav-right">
            <button className="landing-auth-pill" onClick={() => navigate('/login')}>
              Get Started
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
        </nav>
      </div>

      {/* ===== HERO ===== */}
      <section className="landing-hero" id="hero">
        {/* Animated Background & Floating Node Cards */}
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none hidden lg:flex">
          <svg width="1200" height="800" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
            
            {/* Card 1: Top Left */}
            <g style={{ animation: 'floatCard1 7s ease-in-out infinite' }}>
              <path d="M 200 150 L 300 150 L 350 200 L 350 350 L 450 450 L 500 450" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="20" y="126" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="200" cy="150" r="2.5" fill="#fff" />
              <circle cx="200" cy="150" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="48" y="126" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '18px' }}>local_fire_department</span>
                  <span>7-Day Streak 🔥</span>
                </div>
              </foreignObject>
            </g>

            {/* Card 2: Middle Left */}
            <g style={{ animation: 'floatCard2 8.5s ease-in-out infinite -2.5s' }}>
              <path d="M 200 424 L 300 424 L 350 450 L 400 450 L 450 460 L 500 460" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="20" y="400" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="200" cy="424" r="2.5" fill="#fff" />
              <circle cx="200" cy="424" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="48" y="400" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#ec4899', fontSize: '18px' }}>school</span>
                  <span>Smart Quizzes</span>
                </div>
              </foreignObject>
            </g>

            {/* Card 3: Bottom Left */}
            <g style={{ animation: 'floatCard3 7.5s ease-in-out infinite -1.5s' }}>
              <path d="M 200 700 L 300 700 L 350 650 L 350 500 L 450 400 L 500 400" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="20" y="676" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="200" cy="700" r="2.5" fill="#fff" />
              <circle cx="200" cy="700" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="48" y="676" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#8b5cf6', fontSize: '18px' }}>hub</span>
                  <span>Mind Map Ready</span>
                </div>
              </foreignObject>
            </g>

            {/* Card 4: Top Right */}
            <g style={{ animation: 'floatCard2 6.8s ease-in-out infinite -4s' }}>
              <path d="M 1000 150 L 900 150 L 850 200 L 850 350 L 750 450 L 700 450" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="1000" y="126" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="1000" cy="150" r="2.5" fill="#fff" />
              <circle cx="1000" cy="150" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="1015" y="126" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#0ea5e9', fontSize: '18px' }}>quiz</span>
                  <span>Quiz Generated ✓</span>
                </div>
              </foreignObject>
            </g>

            {/* Card 5: Middle Right */}
            <g style={{ animation: 'floatCard3 8s ease-in-out infinite -3s' }}>
              <path d="M 1000 424 L 900 424 L 850 450 L 800 450 L 750 460 L 700 460" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="1000" y="400" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="1000" cy="424" r="2.5" fill="#fff" />
              <circle cx="1000" cy="424" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="1015" y="400" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '18px' }}>monitoring</span>
                  <span>Progress Tracker</span>
                </div>
              </foreignObject>
            </g>

            {/* Card 6: Bottom Right */}
            <g style={{ animation: 'floatCard1 7.2s ease-in-out infinite -5s' }}>
              <path d="M 1000 700 L 900 700 L 850 650 L 850 500 L 750 400 L 700 400" stroke="#27272a" strokeWidth="1" strokeLinejoin="round" strokeOpacity="0.4" />
              <rect x="1000" y="676" width="180" height="48" rx="10" fill="#131316" stroke="#27272a" strokeWidth="1" />
              <circle cx="1000" cy="700" r="2.5" fill="#fff" />
              <circle cx="1000" cy="700" r="6" fill="#fff" fillOpacity="0.15" />

              <foreignObject x="1015" y="676" width="140" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: '18px' }}>headphones</span>
                  <span>Audio Podcast 🎙️</span>
                </div>
              </foreignObject>
            </g>

          </svg>
        </div>

        <div className="landing-hero-inner">
          <div className="landing-fade-up">
            <span className="landing-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              AI-Powered Study Platform
            </span>
          </div>

          <h1 className="landing-headline landing-fade-up">
            Study <span className="highlight">{typedWord}</span>
            <span className="typing-cursor" />,
            <br />Not Harder
          </h1>

          <p className="landing-subtitle landing-fade-up">
            Upload your notes, PDFs, or documents — and let Shiro.ai transform them into quizzes, flashcards, mind maps, audio podcasts, and more.
          </p>

          <div className="landing-hero-actions landing-fade-up">
            <button onClick={() => navigate('/')} className="landing-btn-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
              Get Started Free
            </button>
            <button onClick={() => navigate('/login')} className="landing-btn-ghost">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <div className="landing-stats-section landing-fade-up">
        <div className="landing-stats-card">
          <div className="landing-stats">
            {[
              { num: '10000', display: '10K+', label: 'Active Students' },
              { num: '50000', display: '50K+', label: 'Quizzes Generated' },
              { num: '98', display: '98%', label: 'Satisfaction' },
              { num: '24/7', display: '24/7', label: 'AI Available' },
            ].map((s, i) => (
              <div className="landing-stat-item" key={i}>
                <div className="landing-stat-number">
                  <AnimatedCounter target={s.display} />
                </div>
                <div className="landing-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MARQUEE ===== */}
      <div style={{ overflow: 'hidden', padding: '60px 0 0', position: 'relative', zIndex: 1 }}>
        <div className="landing-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <div className="landing-marquee-item" key={i}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0ea5e9' }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* ===== FEATURES ===== */}
      <section className="landing-section" id="features">
        <div className="landing-section-header">
          <div className="landing-fade-up"><span className="landing-section-label">Features</span></div>
          <h2 className="landing-fade-up landing-section-title">Everything You Need to Ace Your Studies</h2>
          <p className="landing-fade-up landing-section-desc">
            Powerful AI tools designed to supercharge your learning workflow from upload to mastery.
          </p>
        </div>
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <div
              className="landing-fade-up landing-feature-card"
              key={i}
              style={{
                transitionDelay: `${i * 0.07}s`,
                '--feature-glow': `${f.color}08`,
                '--feature-border': `${f.color}30`,
              }}
            >
              <div className="landing-feature-icon" style={{ background: `${f.color}12`, color: f.color }}>
                <span className="material-symbols-outlined">{f.icon}</span>
              </div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-divider" />

      {/* ===== HOW IT WORKS ===== */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-section-header">
          <div className="landing-fade-up"><span className="landing-section-label">How It Works</span></div>
          <h2 className="landing-fade-up landing-section-title">Three Steps to Better Grades</h2>
        </div>
        <div className="landing-steps-wrapper">
          <div className="landing-steps-line" />
          <div className="landing-steps">
            {[
              { step: '01', icon: 'cloud_upload', title: 'Upload Materials', desc: 'Drop your PDFs, DOCX, or images. Shiro.ai processes your content in seconds.' },
              { step: '02', icon: 'psychology', title: 'AI Processes', desc: 'Our RAG-powered engine analyzes, indexes, and structures your materials for optimal learning.' },
              { step: '03', icon: 'school', title: 'Start Learning', desc: 'Access quizzes, flashcards, mind maps, podcasts, and chat — all tailored to your content.' },
            ].map((s, i) => (
              <div className="landing-fade-up landing-step" key={i} style={{ transitionDelay: `${i * 0.15}s` }}>
                <div className="landing-step-number">{s.step}</div>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#0ea5e9', marginBottom: 14, display: 'block' }}>{s.icon}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, color: '#e4e4e7' }}>{s.title}</h3>
                <p style={{ fontSize: '0.88rem', color: '#71717a', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      {/* ===== WHY US ===== */}
      <section className="landing-section" id="why-us">
        <div className="landing-section-header">
          <div className="landing-fade-up"><span className="landing-section-label">Why Shiro.ai</span></div>
          <h2 className="landing-fade-up landing-section-title">Built Different From Day One</h2>
        </div>
        <div className="landing-why-grid">
          {[
            { icon: 'neurology', title: 'RAG-Powered Accuracy', desc: 'Answers come exclusively from your materials — no hallucinations, no generic responses.' },
            { icon: 'speed', title: 'Instant Processing', desc: 'Upload today, study today. No waiting for manual content creation or formatting.' },
            { icon: 'devices', title: 'Study Anywhere', desc: 'Audio podcasts, mobile-friendly design. Your study materials travel with you.' },
            { icon: 'trending_up', title: 'Data-Driven Progress', desc: 'Streaks, heatmaps, and analytics show exactly where you stand and what to focus on.' },
          ].map((item, i) => (
            <div className="landing-fade-up landing-why-card" key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="landing-why-icon">
                <span className="material-symbols-outlined" style={{ color: '#0ea5e9', fontSize: 22 }}>{item.icon}</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6, color: '#e4e4e7', fontSize: '1rem' }}>{item.title}</div>
                <div style={{ color: '#71717a', fontSize: '0.88rem', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-divider" />

      {/* ===== TESTIMONIALS ===== */}
      <section className="landing-section" id="testimonials">
        <div className="landing-section-header">
          <div className="landing-fade-up"><span className="landing-section-label">Reviews</span></div>
          <h2 className="landing-fade-up landing-section-title">Loved by Students Everywhere</h2>
        </div>
        <div className="landing-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div className="landing-fade-up landing-testimonial" key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="landing-testimonial-stars">
                {[...Array(5)].map((_, j) => (
                  <span key={j} className="material-symbols-outlined fill" style={{ color: '#f59e0b', fontSize: 16 }}>star</span>
                ))}
              </div>
              <div className="landing-testimonial-text">"{t.text}"</div>
              <div className="landing-testimonial-author">
                <div className="landing-testimonial-avatar">{t.initials}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#e4e4e7' }}>{t.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#52525b' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-divider" />

      {/* ===== FAQ ===== */}
      <section className="landing-section" id="faq">
        <div className="landing-section-header">
          <div className="landing-fade-up"><span className="landing-section-label">FAQ</span></div>
          <h2 className="landing-fade-up landing-section-title">Got Questions?</h2>
        </div>
        <div className="landing-fade-up landing-faq-container">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} idx={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-section">
        <div className="landing-fade-up landing-cta-section">
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 700, marginBottom: 14, color: '#fff', letterSpacing: '-0.02em' }}>
              Ready to Transform Your Learning?
            </h2>
            <p style={{ color: '#71717a', marginBottom: 32, fontSize: '1rem', maxWidth: 480, margin: '0 auto 32px' }}>
              Join thousands of students who study smarter with Shiro.ai. Start for free — no credit card required.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/login')} className="landing-btn-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
                Start Learning Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer" id="contact">
        <div className="landing-footer-inner">
          <div className="landing-footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="landing-logo-circle" style={{ overflow: 'hidden' }}>
                  <img src="/logo.jpg" alt="Shiro.ai" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>Shiro.ai</span>
              </div>
              <p style={{ color: '#52525b', fontSize: '0.85rem', lineHeight: 1.7, maxWidth: 260 }}>
                Your AI-powered study companion. Transforming how students learn, one document at a time.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {['G', 'T', 'L'].map((s) => (
                  <a key={s} href="#" className="landing-social-link">{s}</a>
                ))}
              </div>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
              <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a>
              <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>FAQ</a>
            </div>
            <div>
              <h4>Study Tools</h4>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>AI Chat</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/quiz'); }}>Quizzes</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/flashcards'); }}>Flashcards</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/mindmap'); }}>Mind Maps</a>
            </div>
            <div>
              <h4>Account</h4>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log In</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign Up</a>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span style={{ color: '#3f3f46', fontSize: '0.8rem' }}>© 2025 Shiro.ai. All rights reserved.</span>
            <span style={{ color: '#3f3f46', fontSize: '0.8rem' }}>Built with ♥ for students</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
