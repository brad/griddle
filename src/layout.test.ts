// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { KEY_ROWS } from './data';

describe('UI Layout and CSS Constraints', () => {
  it('index.html sets overflow hidden and height 100dvh on html and body', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).toContain('height: 100%');
    expect(htmlContent).toContain('height: 100dvh');
    expect(htmlContent).toContain('overflow: hidden');
  });

  it('index.html configures keyboard with flex layout and min-width 0', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).match(/\.keyboard\s*\{[^}]*width\s*:\s*min\(500px,\s*100%\)/);
    expect(htmlContent).match(/\.key\s*\{[^}]*height\s*:\s*clamp\(/);
    expect(htmlContent).match(/\bflex\s*:\s*1\b/);
    expect(htmlContent).match(/\bmin-width\s*:\s*0\b/);
    expect(htmlContent).match(/\.key\.wide\s*\{[^}]*flex\s*:\s*1\.5/);
    expect(htmlContent).match(/\.key-spacer\s*\{[^}]*flex\s*:\s*0\.5/);
  });

  it('keyboard layout matches standard QWERTY structure', () => {
    expect(KEY_ROWS[0]).toEqual(["Q","W","E","R","T","Y","U","I","O","P"]);
    expect(KEY_ROWS[1]).toEqual(["A","S","D","F","G","H","J","K","L"]);
    expect(KEY_ROWS[2]).toEqual(["↵","Z","X","C","V","B","N","M","⌫"]);
  });
  it('index.html configures absolute HTTPS URLs for Open Graph and Twitter metadata', () => {
    const htmlPath = path.resolve(__dirname, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).toContain('<meta property="og:url" content="https://brad.github.io/griddle/">');
    expect(htmlContent).toContain('<meta property="og:image" content="https://brad.github.io/griddle/og-image.gif">');
    expect(htmlContent).toContain('<meta property="og:image:secure_url" content="https://brad.github.io/griddle/og-image.gif">');
    expect(htmlContent).toContain('<meta name="twitter:image" content="https://brad.github.io/griddle/og-image.gif">');
  });
});
