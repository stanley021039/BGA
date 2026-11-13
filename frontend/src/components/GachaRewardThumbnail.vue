<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GachaKind } from '../contracts/gacha';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ kind: GachaKind; effect: string; compact?: boolean }>();
const posters: Readonly<Record<string, readonly [string, string]>> = {
  'attacks:sakura_swarm': [
    '/assets/attacks/gacha/sakura_swarm.webp',
    '/assets/attacks/gacha/sakura_swarm-256.webp',
  ],
  'attacks:sakura_swarm_alt': [
    '/assets/attacks/gacha/sakura_swarm_alt.webp',
    '/assets/attacks/gacha/sakura_swarm_alt-256.webp',
  ],
  'attacks:shield': ['/assets/attacks/gacha/shield.webp', '/assets/attacks/gacha/shield-256.webp'],
  'attacks:chains': ['/assets/attacks/gacha/chains.webp', '/assets/attacks/gacha/chains-256.webp'],
  'attacks:sphere': ['/assets/attacks/gacha/sphere.webp', '/assets/attacks/gacha/sphere-256.webp'],
  'attacks:orbital': [
    '/assets/attacks/gacha/orbital.webp',
    '/assets/attacks/gacha/orbital-256.webp',
  ],
  'attacks:funnel': ['/assets/attacks/gacha/funnel.webp', '/assets/attacks/gacha/funnel-256.webp'],
  'attacks:singularity': [
    '/assets/attacks/gacha/singularity.webp',
    '/assets/attacks/gacha/singularity-256.webp',
  ],
  'attacks:blade_aura': [
    '/assets/attacks/gacha/blade_aura.webp',
    '/assets/attacks/gacha/blade_aura-256.webp',
  ],
  'attacks:blade_aura_crimson': [
    '/assets/attacks/gacha/blade_aura_crimson.webp',
    '/assets/attacks/gacha/blade_aura_crimson-256.webp',
  ],
  'attacks:chain_lightning': [
    '/assets/attacks/gacha/chain_lightning.webp',
    '/assets/attacks/gacha/chain_lightning-256.webp',
  ],
  'attacks:frost_spikes': [
    '/assets/attacks/gacha/frost_spikes.webp',
    '/assets/attacks/gacha/frost_spikes-256.webp',
  ],
  'attacks:arrow_volley': [
    '/assets/attacks/gacha/arrow_volley.webp',
    '/assets/attacks/gacha/arrow_volley-256.webp',
  ],
  'attacks:flame_vortex': [
    '/assets/attacks/gacha/flame_vortex.webp',
    '/assets/attacks/gacha/flame_vortex-256.webp',
  ],
  'attacks:explosion': [
    '/assets/attacks/gacha/explosion.webp',
    '/assets/attacks/gacha/explosion-256.webp',
  ],
  'attacks:guanyin_barrage': [
    '/assets/attacks/gacha/guanyin_barrage.webp',
    '/assets/attacks/gacha/guanyin_barrage-256.webp',
  ],
  'attacks:solar_phoenix': [
    '/assets/attacks/gacha/solar_phoenix.webp',
    '/assets/attacks/gacha/solar_phoenix-256.webp',
  ],
  'attacks:dimension_cleave': [
    '/assets/attacks/gacha/dimension_cleave.webp',
    '/assets/attacks/gacha/dimension_cleave-256.webp',
  ],
  'attacks:bijuu_beam': [
    '/assets/attacks/gacha/bijuu_beam.webp',
    '/assets/attacks/gacha/bijuu_beam-256.webp',
  ],
  'attacks:giga_drill': [
    '/assets/attacks/gacha/giga_drill.webp',
    '/assets/attacks/gacha/giga_drill-256.webp',
  ],
  'attacks:gate_of_babylon': [
    '/assets/attacks/gacha/gate_of_babylon.webp',
    '/assets/attacks/gacha/gate_of_babylon-256.webp',
  ],
  'attacks:excalibur': [
    '/assets/attacks/gacha/excalibur.webp',
    '/assets/attacks/gacha/excalibur-256.webp',
  ],
  'attacks:giant_orange_cat': [
    '/assets/attacks/gacha/giant_orange_cat.webp',
    '/assets/attacks/gacha/giant_orange_cat-256.webp',
  ],
  'attacks:shaohua_devour': [
    '/assets/attacks/gacha/shaohua_devour.webp',
    '/assets/attacks/gacha/shaohua_devour-256.webp',
  ],
  'attacks:shaohua_devour_alt': [
    '/assets/attacks/gacha/shaohua_devour_alt.webp',
    '/assets/attacks/gacha/shaohua_devour_alt-256.webp',
  ],
  'attacks:reaper_seal': [
    '/assets/attacks/gacha/reaper_seal.webp',
    '/assets/attacks/gacha/reaper_seal-256.webp',
  ],
  'attacks:reaper_seal_alt': [
    '/assets/attacks/gacha/reaper_seal_alt.webp',
    '/assets/attacks/gacha/reaper_seal_alt-256.webp',
  ],
  'attacks:returning_moon': [
    '/assets/attacks/gacha/returning_moon.webp',
    '/assets/attacks/gacha/returning_moon-256.webp',
  ],
  'attacks:returning_moon_alt': [
    '/assets/attacks/gacha/returning_moon_alt.webp',
    '/assets/attacks/gacha/returning_moon_alt-256.webp',
  ],
  'attacks:tidal_blades': [
    '/assets/attacks/gacha/tidal_blades.webp',
    '/assets/attacks/gacha/tidal_blades-256.webp',
  ],
  'attacks:tidal_blades_alt': [
    '/assets/attacks/gacha/tidal_blades_alt.webp',
    '/assets/attacks/gacha/tidal_blades_alt-256.webp',
  ],
  'attacks:magnetic_disc': [
    '/assets/attacks/gacha/magnetic_disc.webp',
    '/assets/attacks/gacha/magnetic_disc-256.webp',
  ],
  'attacks:magnetic_disc_alt': [
    '/assets/attacks/gacha/magnetic_disc_alt.webp',
    '/assets/attacks/gacha/magnetic_disc_alt-256.webp',
  ],
  'attacks:venom_thorn': [
    '/assets/attacks/gacha/venom_thorn.webp',
    '/assets/attacks/gacha/venom_thorn-256.webp',
  ],
  'attacks:venom_thorn_alt': [
    '/assets/attacks/gacha/venom_thorn_alt.webp',
    '/assets/attacks/gacha/venom_thorn_alt-256.webp',
  ],
  'attacks:quicksand_trap': [
    '/assets/attacks/gacha/quicksand_trap.webp',
    '/assets/attacks/gacha/quicksand_trap-256.webp',
  ],
  'attacks:quicksand_trap_alt': [
    '/assets/attacks/gacha/quicksand_trap_alt.webp',
    '/assets/attacks/gacha/quicksand_trap_alt-256.webp',
  ],
  'attacks:refracting_prism': [
    '/assets/attacks/gacha/refracting_prism.webp',
    '/assets/attacks/gacha/refracting_prism-256.webp',
  ],
  'attacks:refracting_prism_alt': [
    '/assets/attacks/gacha/refracting_prism_alt.webp',
    '/assets/attacks/gacha/refracting_prism_alt-256.webp',
  ],
  'attacks:bell_shockwave': [
    '/assets/attacks/gacha/bell_shockwave.webp',
    '/assets/attacks/gacha/bell_shockwave-256.webp',
  ],
  'attacks:bell_shockwave_alt': [
    '/assets/attacks/gacha/bell_shockwave_alt.webp',
    '/assets/attacks/gacha/bell_shockwave_alt-256.webp',
  ],
  'attacks:shadow_lunge': [
    '/assets/attacks/gacha/shadow_lunge.webp',
    '/assets/attacks/gacha/shadow_lunge-256.webp',
  ],
  'attacks:shadow_lunge_alt': [
    '/assets/attacks/gacha/shadow_lunge_alt.webp',
    '/assets/attacks/gacha/shadow_lunge_alt-256.webp',
  ],
  'attacks:seeking_talismans': [
    '/assets/attacks/gacha/seeking_talismans.webp',
    '/assets/attacks/gacha/seeking_talismans-256.webp',
  ],
  'attacks:seeking_talismans_alt': [
    '/assets/attacks/gacha/seeking_talismans_alt.webp',
    '/assets/attacks/gacha/seeking_talismans_alt-256.webp',
  ],
  'attacks:crystal_reflection': [
    '/assets/attacks/gacha/crystal_reflection.webp',
    '/assets/attacks/gacha/crystal_reflection-256.webp',
  ],
  'attacks:crystal_reflection_alt': [
    '/assets/attacks/gacha/crystal_reflection_alt.webp',
    '/assets/attacks/gacha/crystal_reflection_alt-256.webp',
  ],
  'attacks:black_coffin': [
    '/assets/attacks/gacha/black_coffin.webp',
    '/assets/attacks/gacha/black_coffin-256.webp',
  ],
  'attacks:black_coffin_alt': [
    '/assets/attacks/gacha/black_coffin_alt.webp',
    '/assets/attacks/gacha/black_coffin_alt-256.webp',
  ],
  'attacks:world_stasis': [
    '/assets/attacks/gacha/world_stasis.webp',
    '/assets/attacks/gacha/world_stasis-256.webp',
  ],
  'attacks:world_stasis_alt': [
    '/assets/attacks/gacha/world_stasis_alt.webp',
    '/assets/attacks/gacha/world_stasis_alt-256.webp',
  ],
  'attacks:human_malice': [
    '/assets/attacks/gacha/human_malice.webp',
    '/assets/attacks/gacha/human_malice-256.webp',
  ],
  'attacks:human_malice_alt': [
    '/assets/attacks/gacha/human_malice_alt.webp',
    '/assets/attacks/gacha/human_malice_alt-256.webp',
  ],
  'attacks:starburst_stream': [
    '/assets/attacks/gacha/starburst_stream.webp',
    '/assets/attacks/gacha/starburst_stream-256.webp',
  ],
  'attacks:starburst_stream_alt': [
    '/assets/attacks/gacha/starburst_stream_alt.webp',
    '/assets/attacks/gacha/starburst_stream_alt-256.webp',
  ],
  'attacks:rainbow_bear': [
    '/assets/attacks/gacha/rainbow_bear.webp',
    '/assets/attacks/gacha/rainbow_bear-256.webp',
  ],
  'attacks:rainbow_bear_alt': [
    '/assets/attacks/gacha/rainbow_bear_alt.webp',
    '/assets/attacks/gacha/rainbow_bear_alt-256.webp',
  ],
  'attacks:zero_equation': [
    '/assets/attacks/gacha/zero_equation.webp',
    '/assets/attacks/gacha/zero_equation-256.webp',
  ],
  'attacks:zero_equation_alt': [
    '/assets/attacks/gacha/zero_equation_alt.webp',
    '/assets/attacks/gacha/zero_equation_alt-256.webp',
  ],
  'attacks:susanoo': [
    '/assets/attacks/gacha/susanoo.webp',
    '/assets/attacks/gacha/susanoo-256.webp',
  ],
  'attacks:susanoo_alt': [
    '/assets/attacks/gacha/susanoo_alt.webp',
    '/assets/attacks/gacha/susanoo_alt-256.webp',
  ],
  'attacks:railgun': [
    '/assets/attacks/gacha/railgun.webp',
    '/assets/attacks/gacha/railgun-256.webp',
  ],
  'attacks:railgun_alt': [
    '/assets/attacks/gacha/railgun_alt.webp',
    '/assets/attacks/gacha/railgun_alt-256.webp',
  ],
  'attacks:plasma_pulse': [
    '/assets/attacks/gacha/plasma_pulse.webp',
    '/assets/attacks/gacha/plasma_pulse-256.webp',
  ],
  'attacks:plasma_pulse_alt': [
    '/assets/attacks/gacha/plasma_pulse_alt.webp',
    '/assets/attacks/gacha/plasma_pulse_alt-256.webp',
  ],
  'attacks:micro_missiles': [
    '/assets/attacks/gacha/micro_missiles.webp',
    '/assets/attacks/gacha/micro_missiles-256.webp',
  ],
  'attacks:micro_missiles_alt': [
    '/assets/attacks/gacha/micro_missiles_alt.webp',
    '/assets/attacks/gacha/micro_missiles_alt-256.webp',
  ],
  'attacks:photon_sniper': [
    '/assets/attacks/gacha/photon_sniper.webp',
    '/assets/attacks/gacha/photon_sniper-256.webp',
  ],
  'attacks:photon_sniper_alt': [
    '/assets/attacks/gacha/photon_sniper_alt.webp',
    '/assets/attacks/gacha/photon_sniper_alt-256.webp',
  ],
  'attacks:gate_of_heroes': [
    '/assets/attacks/gacha/gate_of_heroes.webp',
    '/assets/attacks/gacha/gate_of_heroes-256.webp',
  ],
  'attacks:gate_of_heroes_alt': [
    '/assets/attacks/gacha/gate_of_heroes_alt.webp',
    '/assets/attacks/gacha/gate_of_heroes_alt-256.webp',
  ],
  'entrances:stitch-senbonzakura': [
    '/assets/entrances/gacha/stitch-senbonzakura.webp',
    '/assets/entrances/gacha/stitch-senbonzakura-256.webp',
  ],
  'entrances:stitch-hyorinmaru': [
    '/assets/entrances/gacha/stitch-hyorinmaru.webp',
    '/assets/entrances/gacha/stitch-hyorinmaru-256.webp',
  ],
  'entrances:stitch-minazuki': [
    '/assets/entrances/gacha/stitch-minazuki.webp',
    '/assets/entrances/gacha/stitch-minazuki-256.webp',
  ],
  'entrances:stitch-zanka': [
    '/assets/entrances/gacha/stitch-zanka.webp',
    '/assets/entrances/gacha/stitch-zanka-256.webp',
  ],
  'entrances:stitch-gilgamesh': [
    '/assets/entrances/gacha/stitch-gilgamesh.webp',
    '/assets/entrances/gacha/stitch-gilgamesh-256.webp',
  ],
  'entrances:stitch-purple': [
    '/assets/entrances/gacha/stitch-purple.webp',
    '/assets/entrances/gacha/stitch-purple-256.webp',
  ],
  'entrances:stitch-blue-eyes': [
    '/assets/entrances/gacha/stitch-blue-eyes.webp',
    '/assets/entrances/gacha/stitch-blue-eyes-256.webp',
  ],
  'entrances:stitch-black-coffin': [
    '/assets/entrances/gacha/stitch-black-coffin.webp',
    '/assets/entrances/gacha/stitch-black-coffin-256.webp',
  ],
  'entrances:stitch-grail-mud': [
    '/assets/entrances/gacha/stitch-grail-mud.webp',
    '/assets/entrances/gacha/stitch-grail-mud-256.webp',
  ],
  'entrances:stitch-stand-fists': [
    '/assets/entrances/gacha/stitch-stand-fists.webp',
    '/assets/entrances/gacha/stitch-stand-fists-256.webp',
  ],
  'entrances:stitch-stand-time': [
    '/assets/entrances/gacha/stitch-stand-time.webp',
    '/assets/entrances/gacha/stitch-stand-time-256.webp',
  ],
  'entrances:stitch-stand-emerald': [
    '/assets/entrances/gacha/stitch-stand-emerald.webp',
    '/assets/entrances/gacha/stitch-stand-emerald-256.webp',
  ],
  'entrances:stitch-ulquiorra': [
    '/assets/entrances/gacha/stitch-ulquiorra.webp',
    '/assets/entrances/gacha/stitch-ulquiorra-256.webp',
  ],
  'entrances:stitch-saiyan': [
    '/assets/entrances/gacha/stitch-saiyan.webp',
    '/assets/entrances/gacha/stitch-saiyan-256.webp',
  ],
  'entrances:stitch-lightning': [
    '/assets/entrances/gacha/stitch-lightning.webp',
    '/assets/entrances/gacha/stitch-lightning-256.webp',
  ],
  'entrances:stitch-exodia': [
    '/assets/entrances/gacha/stitch-exodia.webp',
    '/assets/entrances/gacha/stitch-exodia-256.webp',
  ],
  'entrances:stitch-water-breathing': [
    '/assets/entrances/gacha/stitch-water-breathing.webp',
    '/assets/entrances/gacha/stitch-water-breathing-256.webp',
  ],
  'entrances:stitch-explosion': [
    '/assets/entrances/gacha/stitch-explosion.webp',
    '/assets/entrances/gacha/stitch-explosion-256.webp',
  ],
  'entrances:stitch-starburst': [
    '/assets/entrances/gacha/stitch-starburst.webp',
    '/assets/entrances/gacha/stitch-starburst-256.webp',
  ],
  'entrances:stitch-black-moon': [
    '/assets/entrances/gacha/stitch-black-moon.webp',
    '/assets/entrances/gacha/stitch-black-moon-256.webp',
  ],
  'entrances:stitch-pup-parade': [
    '/assets/entrances/gacha/stitch-pup-parade.webp',
    '/assets/entrances/gacha/stitch-pup-parade-256.webp',
  ],
  'entrances:stitch-gentle-kitty': [
    '/assets/entrances/gacha/stitch-gentle-kitty.webp',
    '/assets/entrances/gacha/stitch-gentle-kitty-256.webp',
  ],
  'entrances:stitch-chibaku-tensei': [
    '/assets/entrances/gacha/stitch-chibaku-tensei.webp',
    '/assets/entrances/gacha/stitch-chibaku-tensei-256.webp',
  ],
  'entrances:stitch-bungee-gum': [
    '/assets/entrances/gacha/stitch-bungee-gum.webp',
    '/assets/entrances/gacha/stitch-bungee-gum-256.webp',
  ],
  'backgrounds:castle': [
    '/assets/backgrounds/gacha/castle.webp',
    '/assets/backgrounds/gacha/castle-256.webp',
  ],
  'backgrounds:garden': [
    '/assets/backgrounds/gacha/garden.webp',
    '/assets/backgrounds/gacha/garden-256.webp',
  ],
  'backgrounds:courtroom': [
    '/assets/backgrounds/gacha/courtroom.webp',
    '/assets/backgrounds/gacha/courtroom-256.webp',
  ],
  'backgrounds:cosmic': [
    '/assets/backgrounds/gacha/cosmic.webp',
    '/assets/backgrounds/gacha/cosmic-256.webp',
  ],
  'backgrounds:ballroom': [
    '/assets/backgrounds/gacha/ballroom.webp',
    '/assets/backgrounds/gacha/ballroom-256.webp',
  ],
  'backgrounds:classroom': [
    '/assets/backgrounds/gacha/classroom.webp',
    '/assets/backgrounds/gacha/classroom-256.webp',
  ],
  'backgrounds:prison': [
    '/assets/backgrounds/gacha/prison.webp',
    '/assets/backgrounds/gacha/prison-256.webp',
  ],
  'backgrounds:lab': [
    '/assets/backgrounds/gacha/lab.webp',
    '/assets/backgrounds/gacha/lab-256.webp',
  ],
  'backgrounds:aurora': [
    '/assets/backgrounds/gacha/aurora.webp',
    '/assets/backgrounds/gacha/aurora-256.webp',
  ],
  'attacks:barrage_alt': [
    '/assets/attacks/gacha/barrage_alt.webp',
    '/assets/attacks/gacha/barrage_alt-256.webp',
  ],
  'attacks:beam_alt': [
    '/assets/attacks/gacha/beam_alt.webp',
    '/assets/attacks/gacha/beam_alt-256.webp',
  ],
  'attacks:shield_alt': [
    '/assets/attacks/gacha/shield_alt.webp',
    '/assets/attacks/gacha/shield_alt-256.webp',
  ],
  'attacks:chains_alt': [
    '/assets/attacks/gacha/chains_alt.webp',
    '/assets/attacks/gacha/chains_alt-256.webp',
  ],
  'attacks:sphere_alt': [
    '/assets/attacks/gacha/sphere_alt.webp',
    '/assets/attacks/gacha/sphere_alt-256.webp',
  ],
  'attacks:orbital_alt': [
    '/assets/attacks/gacha/orbital_alt.webp',
    '/assets/attacks/gacha/orbital_alt-256.webp',
  ],
  'attacks:funnel_alt': [
    '/assets/attacks/gacha/funnel_alt.webp',
    '/assets/attacks/gacha/funnel_alt-256.webp',
  ],
  'attacks:singularity_alt': [
    '/assets/attacks/gacha/singularity_alt.webp',
    '/assets/attacks/gacha/singularity_alt-256.webp',
  ],
  'attacks:chain_lightning_alt': [
    '/assets/attacks/gacha/chain_lightning_alt.webp',
    '/assets/attacks/gacha/chain_lightning_alt-256.webp',
  ],
  'attacks:frost_spikes_alt': [
    '/assets/attacks/gacha/frost_spikes_alt.webp',
    '/assets/attacks/gacha/frost_spikes_alt-256.webp',
  ],
  'attacks:arrow_volley_alt': [
    '/assets/attacks/gacha/arrow_volley_alt.webp',
    '/assets/attacks/gacha/arrow_volley_alt-256.webp',
  ],
  'attacks:flame_vortex_alt': [
    '/assets/attacks/gacha/flame_vortex_alt.webp',
    '/assets/attacks/gacha/flame_vortex_alt-256.webp',
  ],
  'attacks:explosion_alt': [
    '/assets/attacks/gacha/explosion_alt.webp',
    '/assets/attacks/gacha/explosion_alt-256.webp',
  ],
  'attacks:guanyin_barrage_alt': [
    '/assets/attacks/gacha/guanyin_barrage_alt.webp',
    '/assets/attacks/gacha/guanyin_barrage_alt-256.webp',
  ],
  'attacks:solar_phoenix_alt': [
    '/assets/attacks/gacha/solar_phoenix_alt.webp',
    '/assets/attacks/gacha/solar_phoenix_alt-256.webp',
  ],
  'attacks:dimension_cleave_alt': [
    '/assets/attacks/gacha/dimension_cleave_alt.webp',
    '/assets/attacks/gacha/dimension_cleave_alt-256.webp',
  ],
  'attacks:bijuu_beam_alt': [
    '/assets/attacks/gacha/bijuu_beam_alt.webp',
    '/assets/attacks/gacha/bijuu_beam_alt-256.webp',
  ],
  'attacks:giga_drill_alt': [
    '/assets/attacks/gacha/giga_drill_alt.webp',
    '/assets/attacks/gacha/giga_drill_alt-256.webp',
  ],
  'attacks:gate_of_babylon_alt': [
    '/assets/attacks/gacha/gate_of_babylon_alt.webp',
    '/assets/attacks/gacha/gate_of_babylon_alt-256.webp',
  ],
  'attacks:excalibur_alt': [
    '/assets/attacks/gacha/excalibur_alt.webp',
    '/assets/attacks/gacha/excalibur_alt-256.webp',
  ],
  'attacks:giant_orange_cat_alt': [
    '/assets/attacks/gacha/giant_orange_cat_alt.webp',
    '/assets/attacks/gacha/giant_orange_cat_alt-256.webp',
  ],
  'entrances:classic-alt': [
    '/assets/entrances/gacha/classic-alt.webp',
    '/assets/entrances/gacha/classic-alt-256.webp',
  ],
  'entrances:smoke': [
    '/assets/entrances/gacha/smoke.webp',
    '/assets/entrances/gacha/smoke-256.webp',
  ],
  'entrances:sparks': [
    '/assets/entrances/gacha/sparks.webp',
    '/assets/entrances/gacha/sparks-256.webp',
  ],
  'entrances:rift': ['/assets/entrances/gacha/rift.webp', '/assets/entrances/gacha/rift-256.webp'],
  'entrances:smoke-alt': [
    '/assets/entrances/gacha/smoke-alt.webp',
    '/assets/entrances/gacha/smoke-alt-256.webp',
  ],
  'entrances:sparks-alt': [
    '/assets/entrances/gacha/sparks-alt.webp',
    '/assets/entrances/gacha/sparks-alt-256.webp',
  ],
  'entrances:ink-alt': [
    '/assets/entrances/gacha/ink-alt.webp',
    '/assets/entrances/gacha/ink-alt-256.webp',
  ],
  'entrances:runes-alt': [
    '/assets/entrances/gacha/runes-alt.webp',
    '/assets/entrances/gacha/runes-alt-256.webp',
  ],
  'entrances:rift-alt': [
    '/assets/entrances/gacha/rift-alt.webp',
    '/assets/entrances/gacha/rift-alt-256.webp',
  ],
  'entrances:particles-alt': [
    '/assets/entrances/gacha/particles-alt.webp',
    '/assets/entrances/gacha/particles-alt-256.webp',
  ],
  'entrances:stitch-senbonzakura-alt': [
    '/assets/entrances/gacha/stitch-senbonzakura-alt.webp',
    '/assets/entrances/gacha/stitch-senbonzakura-alt-256.webp',
  ],
  'entrances:stitch-hyorinmaru-alt': [
    '/assets/entrances/gacha/stitch-hyorinmaru-alt.webp',
    '/assets/entrances/gacha/stitch-hyorinmaru-alt-256.webp',
  ],
  'entrances:stitch-minazuki-alt': [
    '/assets/entrances/gacha/stitch-minazuki-alt.webp',
    '/assets/entrances/gacha/stitch-minazuki-alt-256.webp',
  ],
  'entrances:stitch-zanka-alt': [
    '/assets/entrances/gacha/stitch-zanka-alt.webp',
    '/assets/entrances/gacha/stitch-zanka-alt-256.webp',
  ],
  'entrances:stitch-gilgamesh-alt': [
    '/assets/entrances/gacha/stitch-gilgamesh-alt.webp',
    '/assets/entrances/gacha/stitch-gilgamesh-alt-256.webp',
  ],
  'entrances:stitch-purple-alt': [
    '/assets/entrances/gacha/stitch-purple-alt.webp',
    '/assets/entrances/gacha/stitch-purple-alt-256.webp',
  ],
  'entrances:stitch-blue-eyes-alt': [
    '/assets/entrances/gacha/stitch-blue-eyes-alt.webp',
    '/assets/entrances/gacha/stitch-blue-eyes-alt-256.webp',
  ],
  'entrances:stitch-black-coffin-alt': [
    '/assets/entrances/gacha/stitch-black-coffin-alt.webp',
    '/assets/entrances/gacha/stitch-black-coffin-alt-256.webp',
  ],
  'entrances:stitch-grail-mud-alt': [
    '/assets/entrances/gacha/stitch-grail-mud-alt.webp',
    '/assets/entrances/gacha/stitch-grail-mud-alt-256.webp',
  ],
  'entrances:stitch-stand-fists-alt': [
    '/assets/entrances/gacha/stitch-stand-fists-alt.webp',
    '/assets/entrances/gacha/stitch-stand-fists-alt-256.webp',
  ],
  'entrances:stitch-stand-time-alt': [
    '/assets/entrances/gacha/stitch-stand-time-alt.webp',
    '/assets/entrances/gacha/stitch-stand-time-alt-256.webp',
  ],
  'entrances:stitch-stand-emerald-alt': [
    '/assets/entrances/gacha/stitch-stand-emerald-alt.webp',
    '/assets/entrances/gacha/stitch-stand-emerald-alt-256.webp',
  ],
  'entrances:stitch-ulquiorra-alt': [
    '/assets/entrances/gacha/stitch-ulquiorra-alt.webp',
    '/assets/entrances/gacha/stitch-ulquiorra-alt-256.webp',
  ],
  'entrances:stitch-saiyan-alt': [
    '/assets/entrances/gacha/stitch-saiyan-alt.webp',
    '/assets/entrances/gacha/stitch-saiyan-alt-256.webp',
  ],
  'entrances:stitch-lightning-alt': [
    '/assets/entrances/gacha/stitch-lightning-alt.webp',
    '/assets/entrances/gacha/stitch-lightning-alt-256.webp',
  ],
  'entrances:stitch-exodia-alt': [
    '/assets/entrances/gacha/stitch-exodia-alt.webp',
    '/assets/entrances/gacha/stitch-exodia-alt-256.webp',
  ],
  'entrances:stitch-water-breathing-alt': [
    '/assets/entrances/gacha/stitch-water-breathing-alt.webp',
    '/assets/entrances/gacha/stitch-water-breathing-alt-256.webp',
  ],
  'entrances:stitch-explosion-alt': [
    '/assets/entrances/gacha/stitch-explosion-alt.webp',
    '/assets/entrances/gacha/stitch-explosion-alt-256.webp',
  ],
  'entrances:stitch-starburst-alt': [
    '/assets/entrances/gacha/stitch-starburst-alt.webp',
    '/assets/entrances/gacha/stitch-starburst-alt-256.webp',
  ],
  'entrances:stitch-black-moon-alt': [
    '/assets/entrances/gacha/stitch-black-moon-alt.webp',
    '/assets/entrances/gacha/stitch-black-moon-alt-256.webp',
  ],
  'entrances:stitch-pup-parade-alt': [
    '/assets/entrances/gacha/stitch-pup-parade-alt.webp',
    '/assets/entrances/gacha/stitch-pup-parade-alt-256.webp',
  ],
  'entrances:stitch-gentle-kitty-alt': [
    '/assets/entrances/gacha/stitch-gentle-kitty-alt.webp',
    '/assets/entrances/gacha/stitch-gentle-kitty-alt-256.webp',
  ],
  'entrances:stitch-chibaku-tensei-alt': [
    '/assets/entrances/gacha/stitch-chibaku-tensei-alt.webp',
    '/assets/entrances/gacha/stitch-chibaku-tensei-alt-256.webp',
  ],
  'entrances:stitch-bungee-gum-alt': [
    '/assets/entrances/gacha/stitch-bungee-gum-alt.webp',
    '/assets/entrances/gacha/stitch-bungee-gum-alt-256.webp',
  ],
};
const source = computed(() => posters[props.kind + ':' + props.effect]?.[props.compact ? 1 : 0]);
const failedSource = ref('');
const fallback = {
  attacks: 'attack-up',
  entrances: 'emoji',
  backgrounds: 'landscape',
  frames: 'frame',
  media: 'video',
  sounds: 'sound',
};
</script>

<template>
  <div
    class="gacha-reward-thumbnail"
    :data-kind="kind"
    :class="{ 'is-compact': compact }"
    aria-hidden="true"
  >
    <picture v-if="source && failedSource !== source" :key="source">
      <source
        v-if="compact && kind === 'backgrounds' && effect === 'castle'"
        media="(max-width: 640px)"
        srcset="/assets/backgrounds/gacha/castle-96.webp"
      />
      <img
        :src="source"
        alt=""
        draggable="false"
        :width="compact ? 160 : 192"
        :height="compact ? 90 : 108"
        loading="lazy"
        decoding="async"
        @error="failedSource = source"
      />
    </picture>
    <UiIcon v-else :name="fallback[kind]" />
  </div>
</template>

<style scoped>
.gacha-reward-thumbnail {
  display: grid;
  place-items: center;
  inline-size: min(100%, 192px);
  aspect-ratio: 16 / 9;
  border-radius: var(--stitch-radius-panel);
  overflow: hidden;
  background: var(--stitch-artwork-preview-bg);
}
.gacha-reward-thumbnail[data-kind='entrances'] {
  border-radius: 0;
  background: transparent;
}
.gacha-reward-thumbnail.is-compact {
  inline-size: min(100%, 160px);
}
.gacha-reward-thumbnail :is(picture, img) {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}
.gacha-reward-thumbnail img {
  object-fit: contain;
}
</style>
