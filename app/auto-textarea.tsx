'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';

// Resize on text changes, responsive wrapping, and when a closed details opens.
export default function AutoTextarea(props: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      if (!element.clientWidth) return;
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
    };
    resize();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === element.clientWidth) return;
      width = element.clientWidth;
      resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  return (
    <textarea
      {...props}
      ref={ref}
      className={`auto-textarea ${props.className ?? ''}`}
    />
  );
}
