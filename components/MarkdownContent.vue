<script setup lang="ts">
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: true });

const props = defineProps<{ content: string }>();

const parsed = computed(() => {
  const thinkMatch = props.content.match(/<think>([\s\S]*?)<\/think>/);
  const thought = thinkMatch ? thinkMatch[1].trim() : null;
  const mainContent = props.content
      .replace(/<think>[\s\S]*?<\/think>/, "")
      .trim();

  return {
    thought,
    mainHtml: md.render(mainContent),
  };
});
</script>

<template>
  <div class="space-y-4 font-mono">
    <div
        v-if="parsed.thought"
        class="relative p-4 bg-stone-100 border-l-4 border-stone-300"
    >
      <span
          class="absolute -top-3 left-2 bg-white px-2 text-[10px] text-green-700 font-black uppercase tracking-[0.2em]"
      >
        System_Thought_Process
      </span>
      <div
          class="text-stone-500 italic text-sm leading-relaxed whitespace-pre-wrap"
      >
        {{ parsed.thought }}
      </div>
    </div>

    <div
        class="prose prose-stone max-w-none
             prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-stone-800
             prose-a:text-green-700 prose-a:no-underline hover:prose-a:underline
             prose-strong:text-green-800
             prose-code:text-green-700 prose-code:bg-stone-100 prose-code:px-1
             prose-pre:bg-stone-100 prose-pre:border prose-pre:border-stone-300
             prose-blockquote:border-l-green-600 prose-blockquote:text-stone-500"
        v-html="parsed.mainHtml"
    ></div>
  </div>
</template>