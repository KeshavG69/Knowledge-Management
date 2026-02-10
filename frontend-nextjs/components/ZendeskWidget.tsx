"use client";

import { useEffect } from "react";

export default function ZendeskWidget() {
  useEffect(() => {
    const widgetKey = process.env.NEXT_PUBLIC_ZENDESK_WIDGET_KEY;

    if (!widgetKey || widgetKey === 'your-widget-key-here') {
      console.warn('Zendesk widget key not configured');
      return;
    }

    // Load Zendesk Web Widget script
    const script = document.createElement('script');
    script.id = 'ze-snippet';
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${widgetKey}`;
    script.async = true;

    script.onload = () => {
      console.log('Zendesk widget loaded successfully');

      // Wait for zE to be available and hide only the launcher button
      const hideLauncher = () => {
        // Simple CSS to hide only the launcher frame, keeping messenger fully functional
        const style = document.createElement('style');
        style.id = 'zendesk-custom-styles';
        style.innerHTML = `
          /* Hide only the launcher button iframe by ID */
          iframe#launcher {
            display: none !important;
            visibility: hidden !important;
          }
          /* Ensure ALL messenger iframes remain visible and functional */
          iframe[title*="Messaging"] {
            display: block !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
          /* Ensure the messenger container is fully functional */
          div[data-test-id="web-messenger-container"] {
            display: block !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
          /* Custom close button overlay */
          .zendesk-custom-close {
            position: fixed;
            top: 20px;
            right: 420px;
            z-index: 999999;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #e2e8f0;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: all 0.2s;
          }
          .zendesk-custom-close:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.5);
          }
          .zendesk-custom-close.visible {
            display: flex;
          }
        `;
        document.head.appendChild(style);
      };

      // Add custom close button
      const addCloseButton = () => {
        if (document.getElementById('zendesk-custom-close-btn')) return;

        const closeBtn = document.createElement('div');
        closeBtn.id = 'zendesk-custom-close-btn';
        closeBtn.className = 'zendesk-custom-close';
        closeBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
        closeBtn.onclick = () => {
          if (window.zE) {
            window.zE('messenger', 'close');
          }
        };
        document.body.appendChild(closeBtn);
      };

      // Show/hide close button based on messenger state
      const setupEventListeners = () => {
        if (window.zE) {
          window.zE('messenger:on', 'open', () => {
            const closeBtn = document.getElementById('zendesk-custom-close-btn');
            if (closeBtn) {
              closeBtn.classList.add('visible');
            }
          });

          window.zE('messenger:on', 'close', () => {
            const closeBtn = document.getElementById('zendesk-custom-close-btn');
            if (closeBtn) {
              closeBtn.classList.remove('visible');
            }
          });
        }
      };

      // Hide launcher after a short delay to ensure it's loaded
      setTimeout(() => {
        hideLauncher();
        addCloseButton();
        setupEventListeners();
      }, 1000);
    };

    script.onerror = () => {
      console.error('Failed to load Zendesk widget');
    };

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const existingScript = document.getElementById('ze-snippet');
      const existingStyles = document.getElementById('zendesk-custom-styles');
      if (existingScript) {
        existingScript.remove();
      }
      if (existingStyles) {
        existingStyles.remove();
      }
    };
  }, []);

  return null;
}
