// Misiones guiadas (historia/tutorial) y logros.

export const QUESTS = [
  { id: 'eat', title: 'Desayuna algo', desc: 'Ve a la nevera de la cocina y come algo. [E] para interactuar.', check: (S) => S.stats._ate, reward: 20 },
  { id: 'pc', title: 'Enciende tu PC', desc: 'Siéntate en tu escritorio de streaming y usa la computadora.', check: (S) => S.stats._usedPC, reward: 20 },
  { id: 'stream1', title: 'Tu primer directo', desc: 'Abre Streamix en la PC y haz tu primera transmisión (al menos 30 min).', check: (S) => S.stats.streams >= 1, reward: 50 },
  { id: 'f10', title: 'Los primeros 10', desc: 'Consigue 10 seguidores.', check: (S) => S.stats.followers >= 10, reward: 60 },
  { id: 'job', title: 'Trabajo extra', desc: 'Acepta un pedido de armado/reparación en el Correo y entrégalo desde el banco de trabajo.', check: (S) => S.stats.pcsBuilt + S.stats.pcsRepaired >= 1, reward: 80 },
  { id: 'cam', title: 'Ponle cara', desc: 'Compra una webcam en TecnoMarket (llega a tu puerta).', check: (S) => !!S.peripherals.webcam, reward: 40 },
  { id: 'social', title: 'Hazte notar', desc: 'Publica en Chirper para anunciar un directo.', check: (S) => S.social.posts.length >= 1, reward: 30 },
  { id: 'aff', title: 'Afiliado', desc: 'Llega a 50 seguidores y 3 directos para desbloquear suscripciones y anuncios.', check: (S) => S.flags.affiliate, reward: 100 },
  { id: 'video', title: 'Creador de contenido', desc: 'Edita un VOD y sube un video con VidCut.', check: (S) => S.stats.videosUploaded >= 1, reward: 80 },
  { id: 'upgrade', title: 'Mejora tu PC', desc: 'Arma en el banco de trabajo una PC con rendimiento 50+ e instálala en tu escritorio.', check: (S) => S._pcScore >= 50, reward: 150 },
  { id: 'f250', title: 'Comunidad creciente', desc: 'Llega a 250 seguidores.', check: (S) => S.stats.followers >= 250, reward: 200 },
  { id: 'sponsor', title: 'Primer patrocinio', desc: 'Completa un contrato de patrocinio.', check: (S) => S.stats._sponsorsDone >= 1, reward: 150 },
  { id: 'partner', title: 'Socio oficial', desc: 'Llega a 1.000 seguidores con 25+ espectadores de media para ser Partner.', check: (S) => S.flags.partner, reward: 500 },
  { id: 'f10k', title: 'Placa de plata', desc: 'Llega a 10.000 seguidores.', check: (S) => S.stats.followers >= 10000, reward: 2000 },
  { id: 'f100k', title: 'Leyenda del streaming', desc: 'Llega a 100.000 seguidores. ¡Lo lograste!', check: (S) => S.stats.followers >= 100000, reward: 10000 },
];

export const ACHIEVEMENTS = [
  { id: 'first_follow', name: 'Alguien me ve', desc: 'Primer seguidor', icon: '👀', check: (S) => S.stats.followers >= 1 },
  { id: 'first_don', name: 'Primer donativo', desc: 'Recibe una donación', icon: '💸', check: (S) => S.stats.donations > 0 },
  { id: 'peak50', name: 'Sala llena', desc: '50 espectadores a la vez', icon: '🏟️', check: (S) => S.stats.peakViewers >= 50 },
  { id: 'peak500', name: 'Estadio', desc: '500 espectadores a la vez', icon: '🎆', check: (S) => S.stats.peakViewers >= 500 },
  { id: 'marathon', name: 'Maratón', desc: 'Transmite 6 horas seguidas', icon: '⏱️', check: (S) => S.stats._longest >= 360 },
  { id: 'builder', name: 'Ensamblador', desc: 'Arma 5 PCs para clientes', icon: '🔧', check: (S) => S.stats.pcsBuilt >= 5 },
  { id: 'doctor', name: 'Doctor PC', desc: 'Repara 5 PCs', icon: '🩺', check: (S) => S.stats.pcsRepaired >= 5 },
  { id: 'banhammer', name: 'Martillo de ban', desc: 'Banea 20 trolls', icon: '🔨', check: (S) => S.stats.bans >= 20 },
  { id: 'rich', name: 'Rico', desc: 'Ten $10.000 en el banco', icon: '💰', check: (S) => S.money >= 10000 },
  { id: 'beast', name: 'Bestia', desc: 'PC con rendimiento 90+', icon: '🐉', check: (S) => S._pcScore >= 90 },
  { id: 'raided', name: '¡Raid!', desc: 'Recibe una raid', icon: '⚔️', check: (S) => S.stats.raidsReceived >= 1 },
  { id: 'viral', name: 'Viral', desc: 'Un video con 100.000 vistas', icon: '📈', check: (S) => S.videos.some((v) => v.views >= 100000) },
  { id: 'chef', name: 'Chef', desc: 'Cocina 5 comidas caseras', icon: '👨‍🍳', check: (S) => (S.stats._cooked || 0) >= 5 },
  { id: 'max', name: 'Maestro', desc: 'Una habilidad al nivel 10', icon: '🎓', check: (S) => Object.values(S.skills).some((x) => x >= 3240) },
  { id: 'decor', name: 'Decorador', desc: 'Compra 6 decoraciones', icon: '🛋️', check: (S) => S.inventory.deco.length >= 6 },
];
