import { cn } from "@/lib/utils";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      {/* Outer orbit arcs */}
      <path
        d="M32 8c-11.5 0-21.5 6.5-25.5 16 5-3.5 11.5-5.5 18-4 9.5 2 17 9.5 18.5 19 1 6.5-.5 13-4 18C48 48 55 41 58 32 60 20 48 8 32 8Z"
        fill="url(#logoGradient)"
        opacity="0.92"
      />
      <path
        d="M32 56c11.5 0 21.5-6.5 25.5-16-5 3.5-11.5 5.5-18 4-9.5-2-17-9.5-18.5-19-1-6.5.5-13 4-18C16 16 9 23 6 32 4 44 16 56 32 56Z"
        fill="#15803d"
        opacity="0.32"
      />
      {/* Inner lens */}
      <circle cx="32" cy="32" r="12" fill="#ffffff" />
      <circle cx="32" cy="32" r="8" fill="url(#logoGradient)" />
      {/* Play triangle */}
      <path d="M29.5 28.5l7 3.5-7 3.5v-7z" fill="#ffffff" />
    </svg>
  );
}

export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return <Logo className={className} size={size} />;
}
