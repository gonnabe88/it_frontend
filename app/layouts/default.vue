<template>
  <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white">
    <AppSidebar class="print:hidden" />
    <div class="flex-1 flex flex-col min-w-0 relative print:h-auto print:overflow-visible print:block">
      <AppHeader class="print:hidden" />
      <main class="flex-1 overflow-auto p-6 scroll-smooth print:overflow-visible print:p-0 print:h-auto">
        <slot />
      </main>
      <footer class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0 print:hidden">
        &copy; 2026 IT Portal System. All rights reserved.
      </footer>
    </div>
  </div>
</template>
