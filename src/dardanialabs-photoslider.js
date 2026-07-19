/**
 * Generic Photo Slider Web Component
 * Swipeable image slider with arrows, optional autoplay and lightbox.
 * Dot indicators always render BELOW the image so visitors can see
 * how many photos a gallery holds.
 *
 * Usage:
 *   <dardanialabs-photoslider
 *     images='["/img/a.jpg","/img/b.jpg"]'
 *     autoplay="5000"
 *     object-fit="cover"
 *     lightbox
 *     alt="Product gallery"
 *   ></dardanialabs-photoslider>
 *
 * Theming (CSS custom properties on the host):
 *   --dardanialabs-accent      dot/arrow accent color   (default #c4622d)
 *   --dardanialabs-radius      image corner radius      (default 12px)
 *   --dardanialabs-dots-bg     dots strip background    (default transparent)
 *   --dardanialabs-height      image area height        (default 100%)
 */

class DardaniaLabsPhotoslider extends HTMLElement {
  static get observedAttributes() {
    return ['images', 'autoplay', 'object-fit', 'object-position', 'lightbox', 'alt', 'start', 'no-arrows', 'dots'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.index = 0;
    this.timer = null;
    this.touchStartX = 0;
  }

  connectedCallback() {
    this.render();
    this.startAutoplay();
  }

  disconnectedCallback() {
    this.stopAutoplay();
    this.closeLightbox();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    this.index = 0;
    this.render();
    this.startAutoplay();
  }

  get images() {
    try {
      const parsed = JSON.parse(this.getAttribute('images') || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  // Frameworks bind :images as a DOM property; without this setter the getter
  // above would shadow the assignment and it would be silently lost. Accepts
  // a JSON string or a real array.
  set images(value) {
    this.setAttribute('images', typeof value === 'string' ? value : JSON.stringify(value ?? []));
  }

  get autoplayMs() {
    const raw = this.getAttribute('autoplay');
    if (raw === null || raw === 'false') return 0;
    const ms = parseInt(raw, 10);
    return Number.isFinite(ms) && ms > 0 ? ms : 5000;
  }

  get objectFit() {
    return this.getAttribute('object-fit') || 'cover';
  }

  // Where the image anchors inside the frame when object-fit leaves space
  // (e.g. 'bottom' pins it to the frame's bottom edge so overlay dots sit on it)
  get objectPosition() {
    return this.getAttribute('object-position') || 'center';
  }

  get lightboxEnabled() {
    return this.hasAttribute('lightbox');
  }

  get noArrows() {
    return this.hasAttribute('no-arrows');
  }

  // 'below' (default, in-flow strip) or 'overlay' (bottom-center over the
  // image — for full-bleed heroes where a strip below makes no sense)
  get dotsMode() {
    return this.getAttribute('dots') === 'overlay' ? 'overlay' : 'below';
  }

  startAutoplay() {
    this.stopAutoplay();
    if (this.autoplayMs && this.images.length > 1) {
      this.timer = setInterval(() => this.go(this.index + 1), this.autoplayMs);
    }
  }

  stopAutoplay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  go(next) {
    const count = this.images.length;
    if (!count) return;
    this.index = ((next % count) + count) % count;
    const track = this.shadowRoot.querySelector('.track');
    if (track) track.style.transform = `translateX(-${this.index * 100}%)`;
    this.shadowRoot.querySelectorAll('.dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === this.index);
    });
    this.syncLightbox();
  }

  syncLightbox() {
    if (!this.lb) return;
    this.lb.querySelector('img').src = this.images[this.index];
    const counter = this.lb.querySelector('.lb-counter');
    if (counter) counter.textContent = `${this.index + 1} / ${this.images.length}`;
  }

  // The lightbox is mounted on document.body: position:fixed inside the
  // component would be trapped (and flicker) whenever an ancestor has a
  // transform or filter (hover-animated cards, drop shadows, …)
  openLightbox() {
    if (!this.lightboxEnabled || this.lb) return;
    this.stopAutoplay();

    const lb = document.createElement('div');
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', this.getAttribute('alt') || 'Image viewer');
    lb.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;';
    const multiple = this.images.length > 1;
    const btn = 'position:absolute;border:none;border-radius:50%;background:rgba(255,255,255,0.92);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:0;font-family:system-ui,sans-serif;';
    lb.innerHTML = `
      <img src="${this.images[this.index] || ''}" alt="" style="max-width:92vw;max-height:92vh;object-fit:contain;display:block;" />
      <button class="lb-close" aria-label="Close" style="${btn}top:18px;right:18px;width:44px;height:44px;">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="display:block;">
          <path d="M2 2 L14 14 M14 2 L2 14" stroke="#333" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        </svg>
      </button>
      ${multiple ? `
        <button class="lb-prev" aria-label="Previous" style="${btn}left:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;font-size:1.9rem;">&#8249;</button>
        <button class="lb-next" aria-label="Next" style="${btn}right:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;font-size:1.9rem;">&#8250;</button>
        <div class="lb-counter" style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,0.55);padding:0.45rem 1rem;border-radius:20px;font:500 0.9rem/1 system-ui,sans-serif;">${this.index + 1} / ${this.images.length}</div>
      ` : ''}
    `;
    lb.addEventListener('click', (e) => { if (e.target === lb) this.closeLightbox(); });
    lb.querySelector('.lb-close').addEventListener('click', () => this.closeLightbox());
    lb.querySelector('.lb-prev')?.addEventListener('click', (e) => { e.stopPropagation(); this.go(this.index - 1); });
    lb.querySelector('.lb-next')?.addEventListener('click', (e) => { e.stopPropagation(); this.go(this.index + 1); });

    this.lbKeydown = (e) => {
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.go(this.index - 1);
      if (e.key === 'ArrowRight') this.go(this.index + 1);
    };
    document.addEventListener('keydown', this.lbKeydown);

    document.body.appendChild(lb);
    this.lb = lb;
    this.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }

  closeLightbox() {
    if (!this.lb) return;
    document.removeEventListener('keydown', this.lbKeydown);
    this.lb.remove();
    this.lb = null;
    document.documentElement.style.overflow = this.prevOverflow || '';
    this.startAutoplay();
  }

  // legacy alias retained during dardanialabs migration
  // (every var() read below falls back from --dardanialabs-* to the old
  //  --rtek-* name so pages themed before the rename keep their look)
  render() {
    const images = this.images;
    const alt = this.getAttribute('alt') || 'Image';
    const start = parseInt(this.getAttribute('start') || '0', 10);
    if (Number.isFinite(start) && start >= 0 && start < images.length) this.index = start;
    const multiple = images.length > 1;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          position: relative;
        }
        /* aspect mode: the IMAGE AREA gets the ratio (default square) and the
           host sizes itself around it — so images fill the frame edge to edge
           and the dots strip sits below without stealing image height */
        :host([aspect]) {
          height: auto;
        }
        :host([aspect]) .frame {
          flex: none;
          height: auto;
          width: 100%;
          aspect-ratio: var(--dardanialabs-aspect, var(--rtek-aspect, 1));
        }
        .frame {
          position: relative;
          flex: 1;
          min-height: 0;
          height: var(--dardanialabs-height, var(--rtek-height, 100%));
          overflow: hidden;
          border-radius: var(--dardanialabs-radius, var(--rtek-radius, 12px));
        }
        .track {
          display: flex;
          height: 100%;
          transition: transform 0.35s ease-out;
        }
        .slide {
          flex: 0 0 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .slide img {
          width: 100%;
          height: 100%;
          object-fit: ${this.objectFit};
          object-position: ${this.objectPosition};
          display: block;
          ${this.lightboxEnabled ? 'cursor: zoom-in;' : ''}
        }
        ${this.objectFit === 'contain' ? `
        /* contain: shrink the box to the painted image so the corner radius
           rounds the IMAGE itself rather than an invisible letterboxed box */
        .slide img {
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 100%;
          border-radius: var(--dardanialabs-radius, var(--rtek-radius, 12px));
        }` : ''}
        .arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 38px;
          height: 38px;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          color: var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          font-size: 1.35rem;
          line-height: 0;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.25s ease, background 0.2s ease;
          z-index: 2;
        }
        .frame:hover .arrow { opacity: 1; }
        .arrow:hover { background: #fff; }
        .arrow.prev { left: 10px; }
        .arrow.next { right: 10px; }
        .dots {
          display: ${multiple ? 'flex' : 'none'};
          justify-content: center;
          gap: 8px;
          padding: 0.6rem 0 0.45rem;
          background: var(--dardanialabs-dots-bg, var(--rtek-dots-bg, transparent));
          ${this.dotsMode === 'overlay' ? `
          position: absolute;
          bottom: 8px;
          left: 0;
          right: 0;
          background: transparent;
          z-index: 2;
          ` : ''}
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          background: transparent;
          padding: 0;
          cursor: pointer;
          transition: background 0.25s ease, transform 0.25s ease;
        }
        .dot.active {
          background: var(--dardanialabs-accent, var(--rtek-accent, #c4622d));
          transform: scale(1.2);
        }
        @media (max-width: 768px) {
          .arrow { opacity: 0.85; width: 34px; height: 34px; font-size: 1.15rem; }
        }
      </style>
      <div class="frame">
        <div class="track" style="transform: translateX(-${this.index * 100}%)">
          ${images.map((src, i) => `
            <div class="slide"><img src="${src}" alt="${alt} ${i + 1}" loading="lazy" /></div>
          `).join('')}
        </div>
        ${multiple && !this.noArrows ? `
          <button class="arrow prev" aria-label="Previous">&#8249;</button>
          <button class="arrow next" aria-label="Next">&#8250;</button>
        ` : ''}
      </div>
      <div class="dots">
        ${images.map((_, i) => `
          <button class="dot ${i === this.index ? 'active' : ''}" data-i="${i}" aria-label="Go to image ${i + 1}"></button>
        `).join('')}
      </div>
    `;

    const root = this.shadowRoot;
    root.querySelector('.arrow.prev')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.go(this.index - 1); });
    root.querySelector('.arrow.next')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.go(this.index + 1); });
    root.querySelectorAll('.dot').forEach((dot) => {
      dot.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.go(parseInt(dot.dataset.i, 10)); });
    });

    const frame = root.querySelector('.frame');
    frame.addEventListener('mouseenter', () => this.stopAutoplay());
    frame.addEventListener('mouseleave', () => this.startAutoplay());
    frame.addEventListener('touchstart', (e) => { this.touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    frame.addEventListener('touchend', (e) => {
      const diff = this.touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) this.go(this.index + (diff > 0 ? 1 : -1));
    }, { passive: true });

    if (this.lightboxEnabled) {
      root.querySelectorAll('.slide img').forEach((img) => img.addEventListener('click', () => this.openLightbox()));
    }
  }
}

if (!customElements.get('dardanialabs-photoslider')) {
  customElements.define('dardanialabs-photoslider', DardaniaLabsPhotoslider);
}

// legacy alias retained during dardanialabs migration
class LegacyDardaniaLabsPhotoslider extends DardaniaLabsPhotoslider {}
if (!customElements.get('rtek-photoslider')) {
  customElements.define('rtek-photoslider', LegacyDardaniaLabsPhotoslider);
}
