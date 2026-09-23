// Juegos/categorías para transmitir. pop = popularidad (audiencia), sat = saturación (competencia de streamers).
// mini = tipo de minijuego durante el directo: aim | timing | qte | chat

export const GAMES = [
  { id: 'chat', name: 'Charlando', genre: 'Social', price: 0, req: 0, pop: 45, sat: 0.6, mini: 'chat', color: ['#7b2ff7', '#f107a3'] },
  { id: 'fortaleza', name: 'Fortaleza Royale', genre: 'Battle Royale', price: 0, req: 30, pop: 92, sat: 0.95, mini: 'aim', color: ['#1e90ff', '#00e5ff'] },
  { id: 'retro', name: 'Retro Arcade Pack', genre: 'Retro', price: 10, req: 5, pop: 22, sat: 0.2, mini: 'timing', color: ['#ff3d3d', '#ffd23f'] },
  { id: 'blockcraft', name: 'BlockCraft', genre: 'Sandbox', price: 25, req: 18, pop: 75, sat: 0.8, mini: 'timing', color: ['#3aa655', '#8bd346'] },
  { id: 'leyendas', name: 'Leyendas Arena', genre: 'MOBA', price: 0, req: 25, pop: 80, sat: 0.9, mini: 'qte', color: ['#0f4c81', '#d4af37'] },
  { id: 'impostor', name: 'Impostores Espaciales', genre: 'Party', price: 5, req: 10, pop: 48, sat: 0.45, mini: 'chat', color: ['#c51111', '#132ed1'] },
  { id: 'asilo', name: 'Noche en el Asilo', genre: 'Terror', price: 18, req: 32, pop: 55, sat: 0.35, mini: 'qte', color: ['#1a0f0f', '#7a0000'], horror: true },
  { id: 'tactic', name: 'Tactic Strike 2', genre: 'Shooter', price: 0, req: 40, pop: 85, sat: 0.9, mini: 'aim', color: ['#d98e04', '#2b2b2b'] },
  { id: 'speed', name: 'Saltarín Speedrun', genre: 'Plataformas', price: 15, req: 15, pop: 34, sat: 0.2, mini: 'timing', color: ['#00c9a7', '#845ec2'] },
  { id: 'futbol', name: 'Fútbol Pro 26', genre: 'Deportes', price: 60, req: 45, pop: 72, sat: 0.7, mini: 'timing', color: ['#0a8a2a', '#ffffff'] },
  { id: 'turbo', name: 'Turbo Racing X', genre: 'Carreras', price: 40, req: 50, pop: 46, sat: 0.4, mini: 'timing', color: ['#ff6a00', '#111111'] },
  { id: 'ember', name: 'Dark Ember', genre: 'Souls-like', price: 50, req: 58, pop: 66, sat: 0.5, mini: 'qte', color: ['#3b1f0e', '#ff7b00'] },
  { id: 'streamsim', name: 'Simulador de Streamer', genre: 'Simulación', price: 25, req: 30, pop: 40, sat: 0.3, mini: 'chat', color: ['#9146ff', '#00f0ff'] },
  { id: 'gca', name: 'Gran Ciudad Auto VI', genre: 'Mundo abierto', price: 70, req: 70, pop: 98, sat: 0.85, mini: 'aim', color: ['#ff4fa3', '#ffb800'] },
  { id: 'cyber', name: 'Cyber Neón 2088', genre: 'RPG', price: 60, req: 80, pop: 70, sat: 0.45, mini: 'aim', color: ['#fcee09', '#00f0ff'] },
  { id: 'estrellas', name: 'Estrellas Infinitas', genre: 'Espacial', price: 55, req: 88, pop: 60, sat: 0.25, mini: 'qte', color: ['#0b0033', '#8e7dff'] },
];

export const GAME = Object.fromEntries(GAMES.map((g) => [g.id, g]));

// Tendencia diaria (0.5 - 1.7): se recalcula cada día con un paseo aleatorio.
export function updateTrends(S, force = false) {
  for (const g of GAMES) {
    let t = S.trends[g.id];
    if (t == null || force) t = 0.8 + Math.random() * 0.5;
    t += (Math.random() - 0.5) * 0.3;
    // Evento: lanzamiento/actualización viral
    if (Math.random() < 0.04) t += 0.6;
    t += (1 - t) * 0.12; // vuelve a la media
    S.trends[g.id] = Math.max(0.45, Math.min(1.8, t));
  }
}

// Descubribilidad: juegos saturados son difíciles para canales pequeños.
export function discoverability(g, trend, followers) {
  const big = Math.min(1, followers / 8000);
  const satPenalty = g.sat * (1 - big) * 0.75;
  return (g.pop / 100) * trend * (1 - satPenalty);
}
