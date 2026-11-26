"use client";

import { useEffect } from "react";
import Image from "next/image";
import { initEngine } from "@/lib/engine";

// Python snippet shown in the hero terminal (pre-highlighted spans).
const TERMINAL_CODE = `<code><span class="tk">class</span> <span class="tf">Developer</span>:
  <span class="tk">def</span> <span class="tf">__init__</span>(<span class="tv">self</span>):
    <span class="tv">self</span>.name  = <span class="ts">"Bernardo"</span>
    <span class="tv">self</span>.years = <span class="tn">2</span>
    <span class="tv">self</span>.stack = [
      <span class="ts">"Python"</span>,
      <span class="ts">"Java"</span>,
      <span class="ts">"C"</span>,
    ]
    <span class="tv">self</span>.degree = <span class="ts">"C.S."</span>
    <span class="tv">self</span>.uni = <span class="ts">"Unisinos"</span>

<span class="tk">if</span> __name__ == <span class="ts">"__main__"</span>:
  Developer()</code>`;

const NAV_SECTIONS = [
  ["about", "About"],
  ["journey", "Journey"],
  ["skills", "Skills"],
  ["leadership", "Leadership"],
  ["projects", "Projects"],
  ["contact", "Contact"],
] as const;

export default function Experience() {
  useEffect(() => {
    // The engine owns the canvas, panel rendering, i18n and the spaceship game.
    initEngine();
  }, []);

  return (
    <>
      {/* Desktop: three.js map (loaded on demand). The 2D canvas sits on top —
          it is the whole map on touch/portrait screens and the game layer on desktop. */}
      <canvas id="neural-3d" aria-hidden="true" />
      <canvas id="neural-canvas" aria-hidden="true" />
      <div className="cluster-labels" id="cluster-labels" aria-hidden="true" />

      <header className="topbar">
        <div className="signal-group">
          <a className="signal" href="#" aria-label="Bernardo Righi home">
            <span className="signal__mark" />
            <span>Bernardo Righi</span>
          </a>
          <div className="signal-socials">
            <a
              href="https://github.com/righibe"
              target="_blank"
              rel="noopener"
              className="signal-social"
              aria-label="GitHub"
            >
              <i className="fa-brands fa-github" />
            </a>
            <a
              href="https://www.linkedin.com/in/bernardo-righi/"
              target="_blank"
              rel="noopener"
              className="signal-social"
              aria-label="LinkedIn"
            >
              <i className="fa-brands fa-linkedin" />
            </a>
            <a
              href="https://www.instagram.com/righi._/"
              target="_blank"
              rel="noopener"
              className="signal-social"
              aria-label="Instagram"
            >
              <i className="fa-brands fa-instagram" />
            </a>
            <a
              href="/bernardo-righi-resume.pdf"
              download="bernardo-righi-resume.pdf"
              className="cv-download"
              data-i18n="downloadCv"
              aria-label="Download CV"
            >
              <i className="fa-solid fa-file-arrow-down" />
              <span>CV</span>
            </a>
          </div>
        </div>
        <nav className="nav" aria-label="Portfolio sections">
          {NAV_SECTIONS.map(([key, label]) => (
            <button key={key} className="nav__item" data-section={key}>
              {label}
            </button>
          ))}
        </nav>
        <div className="lang-toggle" aria-label="Language">
          <button className="lang-toggle__item active" data-lang="en">
            EN
          </button>
          <button className="lang-toggle__item" data-lang="pt">
            PT
          </button>
        </div>
      </header>

      <main className="experience" id="experience">
        <section className="identity" aria-label="Intro">
          <div className="identity__inner">
            <div className="identity__photo">
              <Image src="/avatar.png" alt="Bernardo Righi" width={180} height={180} priority />
            </div>
            <p className="identity__eyebrow" data-i18n="heroEyebrow">
              Back-End Developer | Machine Learning &amp; Data Analysis
            </p>
            <h1 aria-label="Bernardo Righi">
              <span className="reveal-line" aria-hidden="true">
                <span>Bernardo</span>
              </span>{" "}
              <span className="reveal-line" aria-hidden="true">
                <span>Righi</span>
              </span>
            </h1>
            <p className="identity__copy">
              Back-end developer building APIs, automations and intelligent
              systems with Python and Java — with a strong pull toward Machine
              Learning, data and how systems really work underneath.
            </p>
            <div className="identity__stats">
              <div className="istat">
                <strong data-count="2" data-suffix="+">2+</strong>
                <span data-i18n="statYears">years building</span>
              </div>
              <div className="istat">
                <strong data-count="10" data-suffix="+">10+</strong>
                <span data-i18n="statProjects">projects realized</span>
              </div>
              <div className="istat">
                <strong data-count="6" data-prefix="Top ">Top 6</strong>
                <span data-i18n="statCommunity">Brazil dev community</span>
              </div>
            </div>

            <div className="identity__languages">
              <span className="lang-badge">
                Portuguese <small>Native</small>
              </span>
              <span className="lang-badge">
                English <small>Fluent</small>
              </span>
              <span className="lang-badge">
                Spanish <small>Intermediate</small>
              </span>
            </div>

            <a
              className="cv-promo"
              href="https://cvlint.righi.dev"
              target="_blank"
              rel="noopener"
              data-i18n="cvPromo"
            >
              <span className="cv-promo__tag">NEW</span>
              <span className="cv-promo__text">Check your resume with cvlint</span>
              <i className="fa-solid fa-arrow-up-right" aria-hidden="true" />
            </a>

            <div className="terminal" id="terminal">
              <div className="terminal__bar">
                <span className="terminal__dot" />
                <span className="terminal__dot" />
                <span className="terminal__dot" />
                <span className="terminal__title">~/bernardo/developer.py</span>
              </div>
              <div className="terminal__body">
                <pre
                  style={{
                    margin: 0,
                    padding: 0,
                    lineHeight: 1.4,
                    fontFamily: "var(--mono)",
                    fontSize: "0.85rem",
                  }}
                  dangerouslySetInnerHTML={{ __html: TERMINAL_CODE }}
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="section-panel" id="section-panel" aria-live="polite">
          <button
            className="section-panel__close"
            id="panel-close"
            type="button"
            aria-label="Close section"
          >
            <i className="fa-solid fa-arrow-left" />
            <span data-i18n="backHome">Back to neural map</span>
          </button>
          <div className="section-panel__meta">
            <span id="panel-kicker">Active cluster</span>
            <span className="section-panel__pulse" />
          </div>
          <div id="panel-content" />
        </aside>

        <div className="hint" id="hint">
          <span className="hint__dot" />
          <span data-i18n="hint">Click a neural cluster or use the top navigation</span>
        </div>

        <div className="explore-hud" id="explore-hud" aria-hidden="true">
          <span>Exploration mode</span>
          <strong id="explore-score">0</strong>
          <small>WASD / Setas: Mover &nbsp;·&nbsp; Espaço / Enter: Atirar</small>
        </div>
        <button
          id="explore-exit"
          className="explore-exit-btn"
          data-i18n="exploreExit"
          aria-hidden="true"
        >
          Stop / Exit
        </button>
      </main>

      <div className="modal-overlay" id="project-modal" aria-hidden="true">
        <article
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <button className="modal__close" id="modal-close" aria-label="Close project">
            <i className="fa-solid fa-xmark" />
          </button>
          <div id="modal-content" />
        </article>
      </div>
    </>
  );
}
