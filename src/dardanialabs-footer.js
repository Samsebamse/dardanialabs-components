/**
 * Generic Footer Web Component
 * A minimal footer component for copyright and social links
 */

class DardaniaLabsFooter extends HTMLElement {
  static get observedAttributes() {
    return ['company', 'founded', 'facebook', 'instagram', 'tiktok', 'x', 'snapchat', 'linkedin', 'whatsapp', 'developer', 'developer-url', 'align', 'color', 'font-size', 'social-gap', 'gap'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  get company() {
    return this.getAttribute('company') || '';
  }

  get founded() {
    return this.getAttribute('founded') || '';
  }

  get facebook() {
    return this.getAttribute('facebook') || '';
  }

  get instagram() {
    return this.getAttribute('instagram') || '';
  }

  get tiktok() {
    return this.getAttribute('tiktok') || '';
  }

  get x() {
    return this.getAttribute('x') || '';
  }

  get snapchat() {
    return this.getAttribute('snapchat') || '';
  }

  get linkedin() {
    return this.getAttribute('linkedin') || '';
  }

  get whatsapp() {
    return this.getAttribute('whatsapp') || '';
  }

  get developer() {
    return this.getAttribute('developer') || '';
  }

  get developerUrl() {
    return this.getAttribute('developer-url') || '';
  }

  get align() {
    const val = this.getAttribute('align') || 'center';
    if (val === 'start' || val === 'left') return 'flex-start';
    if (val === 'end' || val === 'right') return 'flex-end';
    return 'center';
  }

  get color() {
    return this.getAttribute('color') || '';
  }

  get fontSize() {
    return this.getAttribute('font-size') || '';
  }

  get socialGap() {
    return this.getAttribute('social-gap') || '2rem';
  }

  get gap() {
    return this.getAttribute('gap') || '0.5rem';
  }

  render() {
    const currentYear = new Date().getFullYear();
    const yearRange = !this.founded || this.founded === String(currentYear)
      ? currentYear
      : `${this.founded} - ${currentYear}`;

    const socials = [];
    if (this.facebook) {
      socials.push(`<a href="${this.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${this.facebookIcon}</a>`);
    }
    if (this.instagram) {
      socials.push(`<a href="${this.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${this.instagramIcon}</a>`);
    }
    if (this.tiktok) {
      socials.push(`<a href="${this.tiktok}" target="_blank" rel="noopener" aria-label="TikTok">${this.tiktokIcon}</a>`);
    }
    if (this.x) {
      socials.push(`<a href="${this.x}" target="_blank" rel="noopener" aria-label="X">${this.xIcon}</a>`);
    }
    if (this.snapchat) {
      socials.push(`<a href="${this.snapchat}" target="_blank" rel="noopener" aria-label="Snapchat">${this.snapchatIcon}</a>`);
    }
    if (this.linkedin) {
      socials.push(`<a href="${this.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">${this.linkedinIcon}</a>`);
    }
    if (this.whatsapp) {
      socials.push(`<a href="${this.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${this.whatsappIcon}</a>`);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: inherit;
          color: ${this.color || 'inherit'};
          ${this.fontSize ? `font-size: ${this.fontSize};` : ''}
          padding: 0;
          margin: 0;
        }

        .container {
          display: flex;
          flex-direction: column;
          align-items: ${this.align};
        }

        .socials {
          display: flex;
          gap: ${this.socialGap};
          margin-bottom: ${this.gap};
        }

        .socials a {
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .socials a:visited {
          color: inherit;
        }

        .socials a:hover {
          opacity: 0.7;
        }

        .socials svg {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        .copyright {
          margin: 0;
        }

        .copyright a {
          color: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .copyright a:visited {
          color: inherit;
        }
      </style>

      <div class="container">
        ${socials.length > 0 ? `<div class="socials">${socials.join('')}</div>` : ''}
        <p class="copyright">
          &copy; ${yearRange}${this.company ? ` ${this.company}` : ''}${this.developer ? ` | ${this.developerUrl ? `<a href="${this.developerUrl}" target="_blank" rel="noopener">${this.developer}</a>` : this.developer}` : ''}
        </p>
      </div>
    `;
  }

  get facebookIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>`;
  }

  get instagramIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>`;
  }

  get tiktokIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>`;
  }

  get xIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
    </svg>`;
  }

  get snapchatIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.217-.937 1.407-5.965 1.407-5.965s-.359-.72-.359-1.781c0-1.669.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/>
    </svg>`;
  }

  get linkedinIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>`;
  }

  get whatsappIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>`;
  }
}

if (!customElements.get('dardanialabs-footer')) {
  customElements.define('dardanialabs-footer', DardaniaLabsFooter);
}

// legacy alias retained during dardanialabs migration
class LegacyDardaniaLabsFooter extends DardaniaLabsFooter {}
if (!customElements.get('rtek-footer')) {
  customElements.define('rtek-footer', LegacyDardaniaLabsFooter);
}
