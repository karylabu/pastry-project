import React from 'react';

export default function PageShell({
  children,
  className = '',
  innerClassName = '',
  background = 'bg-white',
  minHeight = 'min-h-screen',
  padding = 'px-6 md:px-10 py-10',
}) {
  return (
    <main className={`${background} ${minHeight} ${padding} font-['DM_Sans'] ${className}`.trim()}>
      <div className={`mx-auto w-full max-w-7xl ${innerClassName}`.trim()}>{children}</div>
    </main>
  );
}
