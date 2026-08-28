import type { SVGProps } from "react";

export function PluginIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...props}>
      <path
        d="M12 2.5 5.75 10h3.1L4.5 15.5h4.4L6 21.5h12L15.1 15.5h4.4L15.15 10h3.1L12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
