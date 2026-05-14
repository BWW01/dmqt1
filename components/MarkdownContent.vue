<script setup lang="ts">
import MarkdownIt from 'markdown-it';
const md = new MarkdownIt({ html: true, linkify: true });

const props = defineProps<{ content: string }>();

// Szétválasztjuk a <think> részt a többitől
const parsed = computed(() => {
  const thinkMatch = props.content.match(/<think>([\s\S]*?)<\/think>/);
  const thought = thinkMatch ? thinkMatch[1].trim() : null;
  const mainContent = props.content.replace(/<think>[\s\S]*?<\/think>/, "").trim();

  return {
    thought,
    mainHtml: md.render(mainContent)
  };
});
</script>

<template>
  <div class="space-y-4 font-mono">
    <div v-if="parsed.thought" class="relative p-4 bg-zinc-900/50 border-l-4 border-red-800">
      <span class="absolute -top-3 left-2 bg-black px-2 text-[10px] text-red-600 font-black uppercase tracking-[0.2em]">
        System_Thought_Process
      </span>
      <div class="text-zinc-500 italic text-sm leading-relaxed whitespace-pre-wrap">
        {{ parsed.thought }}
      </div>
    </div>

    <div
        class="prose prose-invert prose-red max-w-none
             prose-headings:uppercase prose-headings:tracking-widest
             prose-a:text-red-500 prose-strong:text-red-600"
        v-html="parsed.mainHtml"
    ></div>
  </div>
</template>