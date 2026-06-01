<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const PIXEL = 7;

const FRAMES = {
  normal: [
    '...GGG...',
    '...GGG...',
    '.G.GGG...',
    '.G.GGe...',
    'GG.GGG...',
    '...GGGGGG',
    '...GGG...',
    '...GGG...',
    '...GGG...',
    '.BBBBBBB.',
    '..BBBBB..',
    '...BBB...',
  ],
  drinking: [
    '...GGG...',
    '...GGG...',
    '.G.GGG...',
    '.G.GGe...',
    'GG.GGG...',
    '...GGGGCC',
    '...GGG..C',
    '...GGG...',
    '...GGG...',
    '.BBBBBBB.',
    '..BBBBB..',
    '...BBB...',
  ],
  blinking: [
    '...GGG...',
    '...GGG...',
    '.G.GGG...',
    '.G.GGG...',
    'GG.GGG...',
    '...GGGGGG',
    '...GGG...',
    '...GGG...',
    '...GGG...',
    '.BBBBBBB.',
    '..BBBBB..',
    '...BBB...',
  ],
};

const COLORS: Record<string, string> = {
  G: '#22c55e',
  B: '#92400e',
  C: '#f97316',
  e: '#166534',
};

const COLS = FRAMES.normal[0].length;
const ROWS = FRAMES.normal.length;

const isDrinking = ref(false);
const isBlinking = ref(false);

const frame = computed(() => {
  if (isBlinking.value) return FRAMES.blinking;
  if (isDrinking.value) return FRAMES.drinking;
  return FRAMES.normal;
});

// Flat list of colored pixels — Vue reactivity updates SVG automatically
const pixels = computed(() =>
  frame.value.flatMap((row, ri) =>
    row.split('').flatMap((char, ci) => {
      const color = COLORS[char];
      return color ? [{ key: `${ri}-${ci}`, x: ci * PIXEL, y: ri * PIXEL, color }] : [];
    })
  )
);

function triggerBlink() {
  isBlinking.value = true;
  setTimeout(() => { isBlinking.value = false; }, 110);
}
function triggerDrink() {
  if (isDrinking.value) return;
  isDrinking.value = true;
  setTimeout(() => { isDrinking.value = false; }, 2800);
}

let drinkTimer: ReturnType<typeof setInterval>;
let blinkTimer: ReturnType<typeof setInterval>;

onMounted(() => {
  blinkTimer = setInterval(() => { if (Math.random() < 0.65) triggerBlink(); }, 3500);
  drinkTimer = setInterval(() => { if (Math.random() < 0.45) triggerDrink(); }, 9000);
  setTimeout(triggerBlink, 800);
});
onUnmounted(() => {
  clearInterval(drinkTimer);
  clearInterval(blinkTimer);
});
</script>

<template>
  <div class="flex flex-col items-center gap-2 select-none">
    <div class="relative">
      <!-- SVG pixel art — works on SSR + client, no canvas/JS needed to be visible -->
      <svg
          :width="COLS * PIXEL"
          :height="ROWS * PIXEL"
          style="display: block; shape-rendering: crispEdges;"
          xmlns="http://www.w3.org/2000/svg"
      >
        <rect
            v-for="p in pixels"
            :key="p.key"
            :x="p.x"
            :y="p.y"
            :width="PIXEL"
            :height="PIXEL"
            :fill="p.color"
        />
      </svg>

      <!-- Steam above the cup (col 7 × 7px = 49px, row 5 × 7px = 35px) -->
      <Transition name="steam-fade">
        <div
            v-if="isDrinking"
            class="absolute pointer-events-none"
            style="top: 14px; left: 48px; display: flex; gap: 3px;"
        >
          <div class="steam-puff" style="animation-delay: 0ms;"></div>
          <div class="steam-puff" style="animation-delay: 320ms;"></div>
        </div>
      </Transition>
    </div>

    <Transition name="label-fade">
      <div v-if="isDrinking" class="text-[9px] font-black text-orange-400 uppercase tracking-widest">
        ...slurp...
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.steam-puff {
  width: 3px;
  height: 3px;
  background: #a1a1aa;
  border-radius: 50%;
  opacity: 0;
  animation: steamRise 0.95s ease-in-out infinite;
}
@keyframes steamRise {
  0%   { opacity: 0;   transform: translateY(0)     scaleX(1);   }
  40%  { opacity: 0.6; transform: translateY(-6px)   scaleX(1.4); }
  100% { opacity: 0;   transform: translateY(-14px)  scaleX(0.6); }
}
.steam-fade-enter-active, .steam-fade-leave-active { transition: opacity 0.4s; }
.steam-fade-enter-from,   .steam-fade-leave-to     { opacity: 0; }
.label-fade-enter-active, .label-fade-leave-active { transition: opacity 0.3s; }
.label-fade-enter-from,   .label-fade-leave-to     { opacity: 0; }
</style>
