// ============================================================
// VoiceFlow India — Landing Page Script
// Handles: nav scroll, mobile nav, FAQ accordion,
//          demo typing animation, scroll animations
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ---- Navbar Scroll Effect ----
  const nav = document.getElementById('nav');
  let lastScrollY = 0;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScrollY = scrollY;
  }, { passive: true });

  // ---- Mobile Navigation Toggle ----
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      mobileToggle.classList.toggle('active');
    });

    // Close on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileToggle.classList.remove('active');
      });
    });
  }

  // ---- FAQ Accordion ----
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));

      // Toggle clicked
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

  // ---- Wispr Hero Ribbon Animation ----
  const textPath = document.getElementById('wispr-textpath');
  if (textPath) {
    let offset = 100; // Start offscreen right
    
    function animateRibbon() {
      offset -= 0.15; // Speed of text flow
      if (offset < -150) {
        offset = 100; // Reset loop
      }
      textPath.setAttribute('startOffset', `${offset}%`);
      requestAnimationFrame(animateRibbon);
    }
    
    // Start animation loop
    requestAnimationFrame(animateRibbon);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- Scroll Animations (Intersection Observer) ----
  const animateElements = document.querySelectorAll(
    '.feature-card, .step-card, .lang-card, .domain-card, .pricing-card, .faq-item, .pipeline-card'
  );

  animateElements.forEach(el => {
    el.classList.add('animate-on-scroll');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger animations
          const delay = Array.from(entry.target.parentElement.children).indexOf(entry.target) * 100;
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, Math.min(delay, 400));
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  );

  animateElements.forEach(el => observer.observe(el));

  // ---- Smooth Scroll for Anchor Links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const navHeight = nav.offsetHeight;
        const targetPosition = target.offsetTop - navHeight - 20;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ---- Parallax on hero orbs ----
  const heroOrbs = document.querySelectorAll('.hero-gradient-orb');
  if (heroOrbs.length > 0) {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      heroOrbs.forEach((orb, i) => {
        const factor = (i + 1) * 15;
        orb.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
      });
    }, { passive: true });
  }
});
