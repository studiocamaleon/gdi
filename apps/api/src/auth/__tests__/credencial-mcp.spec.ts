import {
  PREFIJO_TOKEN_MCP,
  generarTokenMcp,
  hashTokenMcp,
  permisosEfectivosMcp,
  pistaDeToken,
} from '../credencial-mcp.util';
import { expandir } from '../permisos';

/**
 * Estos permisos deciden qué ve una IA EXTERNA al sistema, así que el borde
 * que importa es el de la fuga: márgenes que se cuelan por un scope mal
 * armado, o un `ver` resucitado por expandir después de intersecar.
 */

describe('permisosEfectivosMcp', () => {
  it('scopes vacío = todos los del rol, menos márgenes', () => {
    const rol = expandir([
      'comercial.gestionar',
      'costos.ver',
      'finanzas.ver_margenes',
    ]);
    const efectivos = permisosEfectivosMcp(rol, new Set());
    expect(efectivos.has('comercial.gestionar')).toBe(true);
    expect(efectivos.has('comercial.ver')).toBe(true); // expandido del rol
    expect(efectivos.has('costos.ver')).toBe(true);
    expect(efectivos.has('finanzas.ver_margenes')).toBe(false);
  });

  it('la intersección recorta: el scope no agranda lo que el rol no tiene', () => {
    const rol = expandir(['comercial.ver']);
    const scopes = expandir(['comercial.gestionar', 'administracion.cobrar']);
    const efectivos = permisosEfectivosMcp(rol, scopes);
    expect(efectivos.has('comercial.ver')).toBe(true);
    // El scope pide gestionar pero el rol sólo tiene ver: no escala.
    expect(efectivos.has('comercial.gestionar')).toBe(false);
    expect(efectivos.has('administracion.cobrar')).toBe(false);
  });

  it('márgenes no entra ni pedido explícitamente en scopes', () => {
    const rol = expandir(['finanzas.ver_margenes', 'comercial.ver']);
    const scopes = expandir(['finanzas.ver_margenes', 'comercial.ver']);
    const efectivos = permisosEfectivosMcp(rol, scopes);
    expect(efectivos.has('finanzas.ver_margenes')).toBe(false);
    expect(efectivos.has('comercial.ver')).toBe(true);
  });

  it('rol ADMINISTRADOR con scopes de sólo-lectura queda en sólo-lectura', () => {
    // El caso real de F1: la credencial nace con el trío de lectura aunque
    // la membership sea de un admin que puede todo.
    const rolAdmin = expandir([
      'comercial.gestionar',
      'costos.gestionar',
      'registros.gestionar',
      'administracion.gestionar',
      'configuracion.gestionar',
      'finanzas.ver_margenes',
    ]);
    const scopes = expandir(['comercial.ver', 'costos.ver', 'registros.ver']);
    const efectivos = permisosEfectivosMcp(rolAdmin, scopes);
    expect([...efectivos].sort()).toEqual([
      'comercial.ver',
      'costos.ver',
      'registros.ver',
    ]);
  });
});

describe('token opaco', () => {
  it('formato: prefijo reconocible + 43 chars de entropía', () => {
    const token = generarTokenMcp();
    expect(token.startsWith(PREFIJO_TOKEN_MCP)).toBe(true);
    expect(token.length).toBe(PREFIJO_TOKEN_MCP.length + 43); // 32 bytes b64url
  });

  it('dos tokens nunca colisionan y el hash es estable', () => {
    const a = generarTokenMcp();
    const b = generarTokenMcp();
    expect(a).not.toBe(b);
    expect(hashTokenMcp(a)).toBe(hashTokenMcp(a));
    expect(hashTokenMcp(a)).not.toBe(hashTokenMcp(b));
  });

  it('la pista identifica sin servir para autenticar', () => {
    const token = generarTokenMcp();
    expect(pistaDeToken(token)).toBe(token.slice(-4));
    expect(pistaDeToken(token).length).toBe(4);
  });
});
