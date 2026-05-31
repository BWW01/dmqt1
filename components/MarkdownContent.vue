<script setup lang="ts">
import 'katex/dist/katex.min.css';
import MarkdownIt from 'markdown-it';
import katex from 'katex';

const md = new MarkdownIt({ html: true, linkify: true });

const props = defineProps<{ content: string }>();

function renderLatex(content: string): string {
  // Block math $$...$$ — must be processed before inline
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: 'html' });
    } catch {
      return `<pre>$$${math}$$</pre>`;
    }
  });
  // Inline math $...$ — single line only, no empty matches
  content = content.replace(/\$([^\n$]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
    } catch {
      return `$${math}$`;
    }
  });
  return content;
}

function wrapBareImages(content: string): string {
  content = content.replace(
    /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp))(\s*)$/gim,
    '![]($1)$2'
  );
  content = content.replace(
    /^(data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/]+=*)(\s*)$/gim,
    '![]($1)$2'
  );
  return content;
}

const parsed = computed(() => {
  const thinkMatch = props.content.match(/<think>([\s\S]*?)<\/think>/);
  const thought = thinkMatch ? thinkMatch[1].trim() : null;
  const cleaned = props.content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
  const mainContent = wrapBareImages(renderLatex(cleaned));

  return {
    thought,
    mainHtml: md.render(mainContent),
  };
});
</script>

<template>
  <div class="space-y-4 font-mono">
    <div v-if="parsed.thought" class="relative p-4 bg-zinc-900 border-l-4 border-zinc-700">
      <span class="absolute -top-3 left-2 bg-zinc-950 px-2 text-[10px] text-orange-400 font-black uppercase tracking-[0.2em]">
        System_Thought_Process
      </span>
      <div class="text-zinc-400 italic text-sm leading-relaxed whitespace-pre-wrap">
        {{ parsed.thought }}
      </div>
    </div>

    <div
        class="prose prose-invert max-w-none overflow-x-auto
               prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-zinc-100
               prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
               prose-strong:text-orange-400
               prose-code:text-orange-400 prose-code:bg-zinc-800 prose-code:px-1
               prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-700
               prose-blockquote:border-l-orange-500 prose-blockquote:text-zinc-400
               prose-img:max-w-full prose-img:rounded"
        v-html="parsed.mainHtml"
    ></div>
  </div>
</template>
