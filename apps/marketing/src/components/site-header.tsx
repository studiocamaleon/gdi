"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "./brand";

export function SiteHeader({
  login,
  signup,
}: {
  login: string;
  signup: string;
}) {
  const [open, setOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const links = [
    ["La experiencia", "#experiencia"],
    ["El sistema", "#modulos"],
    ["Planes", "#precios"],
  ];
  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <a href="#top" aria-label="Grafoprint, inicio">
        <Brand />
      </a>
      <nav className="desktop-nav" aria-label="Navegación principal">
        {links.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <a className="login-link" href={login}>
          Iniciar sesión
        </a>
        <a href={signup} className="button button-light header-cta">
          Probar Grafo <ArrowUpRight size={16} />
        </a>
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="Navegación móvil"
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
              <ArrowUpRight size={18} />
            </a>
          ))}
          <a href={login}>
            Iniciar sesión
            <ArrowUpRight size={18} />
          </a>
          <a href={signup}>
            Empezar prueba gratis
            <ArrowUpRight size={18} />
          </a>
        </nav>
      )}
    </header>
  );
}
